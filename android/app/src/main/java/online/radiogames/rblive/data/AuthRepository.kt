package online.radiogames.rblive.data

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.util.Base64
import androidx.credentials.Credential
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.database.FirebaseDatabase
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import online.radiogames.rblive.R
import java.security.SecureRandom
import kotlin.random.Random

class SignInCancelled : Exception("Kinancel ang Google sign-in.")

class AuthRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val db: FirebaseDatabase = FirebaseDatabase.getInstance(),
) {
    val currentUser: FirebaseUser? get() = auth.currentUser

    val authState: Flow<FirebaseUser?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { trySend(it.currentUser) }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    @Volatile
    private var legacyWaiter: CompletableDeferred<Intent?>? = null

    fun completeLegacySignIn(data: Intent?) {
        legacyWaiter?.complete(data)
    }

    suspend fun signInWithGoogle(context: Context, launchLegacy: (Intent) -> Unit) {
        val activity = context.findActivity()
            ?: error("Google sign-in needs the app screen, not a background context")
        val webClientId = context.getString(R.string.default_web_client_id)

        try {
            signInWithCredentialManager(activity, webClientId)
            return
        } catch (e: GetCredentialCancellationException) {
            throw SignInCancelled()
        } catch (_: Exception) {
            // Fall through to the Play Services account picker, which works on
            // more sideloaded APKs than Credential Manager alone.
        }

        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(webClientId)
            .requestEmail()
            .build()
        val client = GoogleSignIn.getClient(activity, gso)
        runCatching { client.signOut().await() }
        val waiter = CompletableDeferred<Intent?>()
        legacyWaiter = waiter
        launchLegacy(client.signInIntent)
        val data = try {
            waiter.await()
        } finally {
            legacyWaiter = null
        }
        if (data == null) throw SignInCancelled()
        val account = try {
            GoogleSignIn.getSignedInAccountFromIntent(data).await()
        } catch (e: ApiException) {
            if (e.statusCode == 12501) throw SignInCancelled()
            throw e
        }
        val idToken = account.idToken
            ?: throw IllegalStateException("Hindi nakuha ang Google token. Subukan ulit.")
        finishFirebaseSignIn(idToken)
    }

    private suspend fun signInWithCredentialManager(activity: Activity, webClientId: String) {
        val manager = CredentialManager.create(activity)
        val options = listOf(
            GetGoogleIdOption.Builder()
                .setServerClientId(webClientId)
                .setFilterByAuthorizedAccounts(false)
                .setAutoSelectEnabled(false)
                .build(),
            GetSignInWithGoogleOption.Builder(webClientId)
                .setNonce(newNonce())
                .build(),
        )
        var last: Exception? = null
        for (option in options) {
            try {
                val result = manager.getCredential(
                    activity,
                    GetCredentialRequest.Builder().addCredentialOption(option).build(),
                )
                finishFirebaseSignIn(idTokenFrom(result.credential))
                return
            } catch (e: GetCredentialCancellationException) {
                throw e
            } catch (e: GetCredentialException) {
                last = e
            } catch (e: Exception) {
                last = e
            }
        }
        throw last ?: NoCredentialException("Walang Google account sa phone")
    }

    private suspend fun finishFirebaseSignIn(idToken: String) {
        val firebaseCred = GoogleAuthProvider.getCredential(idToken, null)
        val user = auth.signInWithCredential(firebaseCred).await().user
            ?: throw IllegalStateException("Hindi makapag-login sa Firebase. Subukan ulit.")
        ensureUserProfile(user)
    }

    private fun idTokenFrom(credential: Credential): String {
        if (credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            return GoogleIdTokenCredential.createFrom(credential.data).idToken
        }
        throw IllegalStateException("Google sign-in did not return an ID token")
    }

    private fun newNonce(): String {
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.NO_WRAP or Base64.NO_PADDING or Base64.URL_SAFE)
    }

    private fun Context.findActivity(): Activity? {
        var ctx: Context = this
        while (ctx is ContextWrapper) {
            if (ctx is Activity) return ctx
            ctx = ctx.baseContext
        }
        return this as? Activity
    }

    private suspend fun ensureUserProfile(user: FirebaseUser) {
        val ref = db.getReference("users").child(user.uid)
        val snap = ref.get().await()
        if (!snap.exists()) {
            val refCode = Random.nextInt(100000, 999999).toString(36).uppercase()
            ref.setValue(
                mapOf(
                    "name" to (user.displayName ?: "Player"),
                    "photo" to (user.photoUrl?.toString() ?: ""),
                    "points" to 200,
                    "refCode" to refCode,
                    "last_seen" to System.currentTimeMillis(),
                    "cardTimestamp" to System.currentTimeMillis(),
                    "lastLoginDate" to java.util.Date().toString().take(10),
                    "hasWonBringMeThisRound" to false,
                    "ownedSkins" to listOf("default"),
                    "equippedSkin" to "default",
                ),
            ).await()
        } else {
            ref.updateChildren(
                mapOf(
                    "last_seen" to System.currentTimeMillis(),
                    "name" to (snap.child("name").getValue(String::class.java) ?: user.displayName),
                    "photo" to (snap.child("photo").getValue(String::class.java) ?: user.photoUrl?.toString()),
                ),
            ).await()
        }
    }

    fun signOut() = auth.signOut()
}

fun friendlySignInError(error: Throwable): String {
    val msg = (error.message ?: "").lowercase()
    return when {
        error is SignInCancelled || "cancel" in msg -> "Kinancel ang Google sign-in."
        error is NoCredentialException || "no credential" in msg || "cannot find" in msg ->
            "Walang Google account sa phone. Magdagdag muna sa Settings, tapos subukan ulit."
        "network" in msg || "timeout" in msg || "unable to resolve" in msg || "unreachable" in msg ->
            "Walang internet. Tingnan ang connection at subukan ulit."
        "10:" in msg || "developer_error" in msg || "api_not_connected" in msg ->
            "Hindi ma-verify ang app. I-install ang latest RB Live APK."
        "12500" in msg || "play services" in msg || "service_invalid" in msg ->
            "I-update ang Google Play Services, tapos subukan ulit."
        else -> "Hindi makapag-login sa Google. Subukan ulit."
    }
}
