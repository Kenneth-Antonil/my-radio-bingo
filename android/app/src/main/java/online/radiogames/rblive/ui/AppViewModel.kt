package online.radiogames.rblive.ui

import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import com.google.firebase.messaging.FirebaseMessaging
import online.radiogames.rblive.data.AuthRepository
import online.radiogames.rblive.data.SignInCancelled
import online.radiogames.rblive.data.friendlySignInError
import online.radiogames.rblive.data.BingoRepository
import online.radiogames.rblive.data.FeedRepository
import online.radiogames.rblive.data.SocialRepository
import online.radiogames.rblive.model.AppNotif
import online.radiogames.rblive.model.BingoState
import online.radiogames.rblive.model.CashoutItem
import online.radiogames.rblive.model.ChatLine
import online.radiogames.rblive.model.RankRow
import online.radiogames.rblive.model.TournamentRow
import online.radiogames.rblive.model.Comment
import online.radiogames.rblive.model.Conversation
import online.radiogames.rblive.model.DirectMessage
import online.radiogames.rblive.model.FriendRequest
import online.radiogames.rblive.model.SocialPost
import online.radiogames.rblive.model.SupportTicket
import online.radiogames.rblive.model.StoryItem
import online.radiogames.rblive.model.TxItem
import online.radiogames.rblive.model.UserProfile

data class AppUiState(
    val user: FirebaseUser? = null,
    val profile: UserProfile? = null,
    val posts: List<SocialPost> = emptyList(),
    val bingo: BingoState = BingoState(),
    val stories: List<StoryItem> = emptyList(),
    val beats: List<SocialPost> = emptyList(),
    val liveChat: List<ChatLine> = emptyList(),
    val inbox: List<Conversation> = emptyList(),
    val comments: List<Comment> = emptyList(),
    val thread: List<DirectMessage> = emptyList(),
    val openCommentsFor: String? = null,
    val openThread: Conversation? = null,
    val cashoutMessage: String? = null,
    val authLoading: Boolean = false,
    val posting: Boolean = false,
    val authError: String? = null,
    val bingoNotice: String? = null,
    val ranks: List<RankRow> = emptyList(),
    val tournaments: List<TournamentRow> = emptyList(),
    val cashouts: List<CashoutItem> = emptyList(),
    val friendRequests: List<FriendRequest> = emptyList(),
    val notifications: List<AppNotif> = emptyList(),
    val postError: String? = null,
    val friendsCount: Int = 0,
    val history: List<TxItem> = emptyList(),
    val meNotice: String? = null,
    val tickets: List<SupportTicket> = emptyList(),
)

@OptIn(ExperimentalCoroutinesApi::class)
class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val authRepo = AuthRepository()
    private val feedRepo = FeedRepository()
    private val bingoRepo = BingoRepository()
    private val socialRepo = SocialRepository()

    private val authLoading = MutableStateFlow(false)
    private val posting = MutableStateFlow(false)
    private val authError = MutableStateFlow<String?>(null)
    private val openCommentsFor = MutableStateFlow<String?>(null)
    private val openThread = MutableStateFlow<Conversation?>(null)
    private val cashoutMessage = MutableStateFlow<String?>(null)
    private val bingoNotice = MutableStateFlow<String?>(null)
    private val ranks = MutableStateFlow<List<RankRow>>(emptyList())
    private val tournaments = MutableStateFlow<List<TournamentRow>>(emptyList())

    private val profile = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(null) else {
            bingoRepo.startPresence(user.uid)
            bingoRepo.observeUser()
        }
    }

    private val posts = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else feedRepo.observeFeed()
    }

    private val bingo = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(BingoState()) else bingoRepo.observeBingo()
    }

    private val stories = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else socialRepo.observeStories()
    }
    private val beats = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else socialRepo.observeBeats()
    }
    private val liveChat = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else socialRepo.observeLiveChat()
    }
    private val inbox = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else socialRepo.observeInbox()
    }
    private val comments = openCommentsFor.flatMapLatest { key ->
        if (key == null) flowOf(emptyList()) else socialRepo.observeComments(key)
    }
    private val thread = openThread.flatMapLatest { conv ->
        if (conv == null) flowOf(emptyList()) else socialRepo.observeThread(conv.partnerUid)
    }

    private val session = combine(authRepo.authState, profile, posts, bingo) { user, profile, posts, bingo ->
        Session(user, profile, posts, bingo)
    }

    init {
        viewModelScope.launch {
            profile.collect { me ->
                me?.uid?.let { uid ->
                    bingoRepo.updatePresenceProfile(uid, me.name, me.photo, me.points)
                    FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                        val root = com.google.firebase.database.FirebaseDatabase.getInstance()
                        root.getReference("users").child(uid)
                            .updateChildren(mapOf("fcmToken" to token, "fcmUpdatedAt" to System.currentTimeMillis()))
                        root.getReference("fcmTokens").child(uid).setValue(token)
                    }
                }
            }
        }
    }

    private val cashouts = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else feedRepo.observeCashouts()
    }
    private val friendRequests = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else feedRepo.observeFriendRequests()
    }
    private val notifications = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else socialRepo.observeNotifications()
    }
    private val postError = MutableStateFlow<String?>(null)
    private val meNotice = MutableStateFlow<String?>(null)
    private val tickets = MutableStateFlow<List<SupportTicket>>(emptyList())
    private val friendsCount = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(0) else feedRepo.observeFriendCount()
    }
    private val history = authRepo.authState.flatMapLatest { user ->
        if (user == null) flowOf(emptyList()) else feedRepo.observeHistory()
    }

    private val extras = combine(stories, beats, liveChat, inbox) { st, be, chat, box ->
        Extra(st, be, chat, box)
    }
    private val sheets = combine(comments, thread, openCommentsFor, openThread, cashoutMessage) { c, t, oc, ot, cm ->
        Sheets(c, t, oc, ot, cm)
    }
    private val homeBits = combine(cashouts, friendRequests, notifications, postError) { c, f, n, e ->
        HomeBits(c, f, n, e)
    }
    private val meBits = combine(friendsCount, history, meNotice, tickets) { f, h, n, t ->
        MeBits(f, h, n, t)
    }

    val uiState: StateFlow<AppUiState> = combine(
        combine(session, extras, sheets) { s, e, sh -> Triple(s, e, sh) },
        combine(authLoading, posting, authError) { a, b, c -> Triple(a, b, c) },
        combine(bingoNotice, ranks, tournaments) { n, r, t -> Triple(n, r, t) },
        homeBits,
        meBits,
    ) { pack, flags, bx, home, me ->
        val s = pack.first
        val e = pack.second
        val sh = pack.third
        AppUiState(
            user = s.user,
            profile = s.profile,
            posts = s.posts,
            bingo = s.bingo,
            stories = e.stories,
            beats = e.beats,
            liveChat = e.liveChat,
            inbox = e.inbox,
            comments = sh.comments,
            thread = sh.thread,
            openCommentsFor = sh.openCommentsFor,
            openThread = sh.openThread,
            cashoutMessage = sh.cashoutMessage,
            authLoading = flags.first,
            posting = flags.second,
            authError = flags.third,
            bingoNotice = bx.first,
            ranks = bx.second,
            tournaments = bx.third,
            cashouts = home.cashouts,
            friendRequests = home.friendRequests,
            notifications = home.notifications,
            postError = home.postError,
            friendsCount = me.friendsCount,
            history = me.history,
            meNotice = me.meNotice,
            tickets = me.tickets,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppUiState())

    fun signIn(context: Context, launchLegacy: (Intent) -> Unit) {
        viewModelScope.launch {
            authLoading.value = true
            authError.value = null
            try {
                authRepo.signInWithGoogle(context, launchLegacy)
            } catch (e: SignInCancelled) {
                authError.value = null
            } catch (e: Exception) {
                authError.value = friendlySignInError(e)
            } finally {
                authLoading.value = false
            }
        }
    }

    fun onLegacyGoogleResult(data: Intent?) {
        authRepo.completeLegacySignIn(data)
    }

    fun signOut() = authRepo.signOut()

    fun createPost(
        text: String,
        mood: String? = null,
        imageUri: Uri? = null,
        videoUri: Uri? = null,
        visibility: String = "public",
        pollQuestion: String? = null,
        pollOptions: List<String>? = null,
    ) {
        viewModelScope.launch {
            posting.value = true
            postError.value = null
            try {
                val ctx = getApplication<Application>()
                val imageUrl = imageUri?.let { feedRepo.uploadMedia(ctx, it, "image") }
                val videoUrl = videoUri?.let { feedRepo.uploadMedia(ctx, it, "video") }
                feedRepo.createPost(text, mood, imageUrl, videoUrl, visibility, pollQuestion, pollOptions)
            } catch (e: Exception) {
                postError.value = e.message ?: "Could not post"
            } finally {
                posting.value = false
            }
        }
    }

    fun like(post: SocialPost) {
        viewModelScope.launch { runCatching { feedRepo.toggleLike(post) } }
    }

    fun react(post: SocialPost, emoji: String) {
        viewModelScope.launch { runCatching { feedRepo.react(post, emoji) } }
    }

    fun votePoll(postKey: String, index: Int) {
        viewModelScope.launch { runCatching { feedRepo.votePoll(postKey, index) } }
    }

    fun toggleBookmark(postKey: String) {
        viewModelScope.launch { runCatching { feedRepo.toggleBookmark(postKey) } }
    }

    fun deletePost(postKey: String) {
        viewModelScope.launch { runCatching { feedRepo.deletePost(postKey) } }
    }

    fun acceptFriend(uid: String) {
        viewModelScope.launch { runCatching { feedRepo.acceptFriend(uid) } }
    }

    fun declineFriend(uid: String) {
        viewModelScope.launch { runCatching { feedRepo.declineFriend(uid) } }
    }

    fun markNotifsRead() {
        viewModelScope.launch { runCatching { socialRepo.markNotifsRead() } }
    }

    fun markStorySeen(key: String) {
        viewModelScope.launch { runCatching { socialRepo.markStorySeen(key) } }
    }

    fun addFriend(uid: String) {
        viewModelScope.launch { runCatching { feedRepo.sendFriendRequest(uid) } }
    }

    fun newCard() {
        viewModelScope.launch { runCatching { bingoRepo.generateNewCard() } }
    }

    fun buyExtraCard() {
        viewModelScope.launch {
            bingoNotice.value = runCatching { bingoRepo.buyExtraCard() }.getOrElse { it.message }
        }
    }

    fun changeExtraCard(index: Int) {
        viewModelScope.launch {
            bingoNotice.value = runCatching { bingoRepo.changeExtraCard(index) }.getOrElse { it.message }
        }
    }

    fun setSkip(skip: Boolean) {
        viewModelScope.launch {
            bingoNotice.value = runCatching { bingoRepo.setSkip(skip) }.getOrElse { it.message }
        }
    }

    fun submitSponsor(amount: Long) {
        viewModelScope.launch {
            bingoNotice.value = runCatching { bingoRepo.submitSponsor(amount) }.getOrElse { it.message }
        }
    }

    fun loadLeaderboard(tab: String) {
        val field = when (tab) {
            "points" -> "points"
            "streak" -> "longestStreak"
            else -> "bingoWins"
        }
        viewModelScope.launch {
            ranks.value = runCatching { bingoRepo.loadLeaderboard(field) }.getOrDefault(emptyList())
        }
    }

    fun loadTournaments() {
        viewModelScope.launch {
            tournaments.value = runCatching { bingoRepo.loadTournaments() }.getOrDefault(emptyList())
        }
    }

    fun clearBingoNotice() { bingoNotice.value = null }

    fun openComments(postKey: String) { openCommentsFor.value = postKey }
    fun closeComments() { openCommentsFor.value = null }
    fun sendComment(text: String) {
        val key = openCommentsFor.value ?: return
        viewModelScope.launch { runCatching { socialRepo.addComment(key, text) } }
    }

    fun publishStory(text: String) {
        viewModelScope.launch { runCatching { socialRepo.publishTextStory(text) } }
    }

    fun sendLiveChat(text: String) {
        val me = uiState.value.profile ?: return
        viewModelScope.launch { runCatching { socialRepo.sendLiveChat(text, me.name, me.photo) } }
    }

    fun openThread(conv: Conversation) { openThread.value = conv }
    fun closeThread() { openThread.value = null }
    fun sendPm(text: String) {
        val conv = openThread.value ?: return
        viewModelScope.launch { runCatching { socialRepo.sendPm(conv.partnerUid, text) } }
    }

    fun saveProfile(name: String, bio: String, photoUri: Uri?, coverUri: Uri?) {
        viewModelScope.launch {
            meNotice.value = runCatching {
                val ctx = getApplication<Application>()
                val photo = photoUri?.let { feedRepo.uploadMedia(ctx, it, "image") }
                val cover = coverUri?.let { feedRepo.uploadMedia(ctx, it, "image") }
                feedRepo.saveProfile(name, bio, photo, cover)
                "Profile updated!"
            }.getOrElse { it.message }
        }
    }

    fun claimReferral(code: String) {
        viewModelScope.launch {
            meNotice.value = runCatching { feedRepo.claimReferral(code) }.getOrElse { it.message }
        }
    }

    fun requestVerification() {
        viewModelScope.launch {
            meNotice.value = runCatching { feedRepo.requestVerification() }.getOrElse { it.message }
        }
    }

    fun clearMeNotice() { meNotice.value = null }

    fun loadTickets() {
        viewModelScope.launch { tickets.value = runCatching { socialRepo.loadTickets() }.getOrDefault(emptyList()) }
    }

    fun sendSupport(subject: String, message: String) {
        viewModelScope.launch {
            meNotice.value = runCatching { socialRepo.sendSupport(subject, message) }.getOrElse { it.message }
            loadTickets()
        }
    }

    fun buyOrEquipSkin(id: String, cost: Long) {
        viewModelScope.launch {
            cashoutMessage.value = runCatching { socialRepo.buyOrEquipSkin(id, cost) }.getOrElse { it.message }
        }
    }

    fun cashout(method: String, account: String, name: String, pesos: Double) {
        viewModelScope.launch {
            val err = runCatching { socialRepo.submitCashout(method, account, name, pesos) }.getOrElse { it.message }
            cashoutMessage.value = err ?: "Sent! Cashout is pending review."
        }
    }

    private data class Extra(
        val stories: List<StoryItem>,
        val beats: List<SocialPost>,
        val liveChat: List<ChatLine>,
        val inbox: List<Conversation>,
    )
    private data class HomeBits(
        val cashouts: List<CashoutItem>,
        val friendRequests: List<FriendRequest>,
        val notifications: List<AppNotif>,
        val postError: String?,
    )
    private data class MeBits(
        val friendsCount: Int,
        val history: List<TxItem>,
        val meNotice: String?,
        val tickets: List<SupportTicket>,
    )
    private data class Sheets(
        val comments: List<Comment>,
        val thread: List<DirectMessage>,
        val openCommentsFor: String?,
        val openThread: Conversation?,
        val cashoutMessage: String?,
    )

    private data class Session(
        val user: FirebaseUser?,
        val profile: UserProfile?,
        val posts: List<SocialPost>,
        val bingo: BingoState,
    )
}
