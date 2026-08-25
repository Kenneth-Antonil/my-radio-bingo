package online.radiogames.rblive

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.GridOn
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.SportsEsports
import androidx.compose.material.icons.outlined.Store
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import online.radiogames.rblive.ui.AppViewModel
import online.radiogames.rblive.ui.beats.BeatsScreen
import online.radiogames.rblive.ui.bingo.BingoScreen
import online.radiogames.rblive.ui.chat.InboxScreen
import online.radiogames.rblive.ui.chat.LiveChatScreen
import online.radiogames.rblive.ui.chat.ThreadScreen
import online.radiogames.rblive.ui.games.GameActivity
import online.radiogames.rblive.ui.games.GamesScreen
import online.radiogames.rblive.ui.home.HomeScreen
import online.radiogames.rblive.ui.login.LoginScreen
import online.radiogames.rblive.ui.me.MeScreen
import online.radiogames.rblive.ui.store.StoreScreen
import online.radiogames.rblive.ui.theme.Accent
import online.radiogames.rblive.ui.theme.Bg
import online.radiogames.rblive.ui.theme.RbLiveTheme
import online.radiogames.rblive.ui.theme.Text2
import online.radiogames.rblive.ui.theme.Text3

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()
    private val notifPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }
    private val googleLegacyLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        vm.onLegacyGoogleResult(result.data)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 33) {
            notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        enableEdgeToEdge()
        setContent {
            RbLiveTheme {
                val state by vm.uiState.collectAsStateWithLifecycle()
                if (state.user == null) {
                    LoginScreen(
                        loading = state.authLoading,
                        error = state.authError,
                        onGoogleSignIn = {
                            vm.signIn(this@MainActivity) { intent ->
                                googleLegacyLauncher.launch(intent)
                            }
                        },
                    )
                } else {
                    MainShell(vm = vm, state = state, openGame = { id, title ->
                        startActivity(
                            Intent(this, GameActivity::class.java)
                                .putExtra(GameActivity.EXTRA_ID, id)
                                .putExtra(GameActivity.EXTRA_TITLE, title)
                        )
                    })
                }
            }
        }
    }
}

@Composable
private fun MainShell(
    vm: AppViewModel,
    state: online.radiogames.rblive.ui.AppUiState,
    openGame: (String, String) -> Unit,
) {
    val nav = rememberNavController()
    val route = nav.currentBackStackEntryAsState().value?.destination?.route ?: "home"
    val tabs = listOf(
        "home" to ("Home" to Icons.Outlined.Home),
        "bingo" to ("Bingo" to Icons.Outlined.GridOn),
        "store" to ("Store" to Icons.Outlined.Store),
        "beats" to ("Beats" to Icons.Outlined.MusicNote),
        "me" to ("Me" to Icons.Outlined.Person),
    )
    val hideBar = route in setOf("inbox", "thread", "livechat", "games")
    Scaffold(
        containerColor = Bg,
        bottomBar = {
            if (!hideBar) {
                NavigationBar(containerColor = Color(0xF506070C), contentColor = Text2, tonalElevation = 0.dp) {
                    tabs.forEach { (id, meta) ->
                        NavigationBarItem(
                            selected = route == id,
                            onClick = { nav.navigate(id) { launchSingleTop = true } },
                            icon = { Icon(meta.second, contentDescription = meta.first) },
                            label = { Text(meta.first, fontSize = 9.sp, fontWeight = FontWeight.SemiBold) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Color(0xFF8EB0FF),
                                selectedTextColor = Color(0xFFF1F4FB),
                                unselectedIconColor = Color(0xFF5C6478),
                                unselectedTextColor = Color(0xFF5C6478),
                                indicatorColor = Color.Transparent,
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(navController = nav, startDestination = "home", modifier = Modifier.padding(padding)) {
            composable("home") {
                HomeScreen(
                    me = state.profile,
                    posts = state.posts,
                    stories = state.stories,
                    comments = state.comments,
                    commentsOpen = state.openCommentsFor != null,
                    posting = state.posting,
                    cashouts = state.cashouts,
                    friendRequests = state.friendRequests,
                    notifications = state.notifications,
                    inboxUnread = state.inbox.size,
                    postError = state.postError,
                    onPost = { text, mood, img, vid, vis, pq, po ->
                        vm.createPost(text, mood, img, vid, vis, pq, po)
                    },
                    onLike = vm::like,
                    onReact = vm::react,
                    onAddFriend = vm::addFriend,
                    onAcceptFriend = vm::acceptFriend,
                    onDeclineFriend = vm::declineFriend,
                    onOpenComments = vm::openComments,
                    onCloseComments = vm::closeComments,
                    onSendComment = vm::sendComment,
                    onPublishStory = vm::publishStory,
                    onMarkStorySeen = vm::markStorySeen,
                    onVotePoll = vm::votePoll,
                    onBookmark = vm::toggleBookmark,
                    onDeletePost = vm::deletePost,
                    onNavigate = { dest ->
                        when (dest) {
                            "home", "bingo", "beats", "games", "me", "store", "inbox", "livechat" ->
                                nav.navigate(dest) { launchSingleTop = true }
                        }
                    },
                    onMarkNotifsRead = vm::markNotifsRead,
                )
            }
            composable("bingo") {
                BingoScreen(
                    me = state.profile,
                    state = state.bingo,
                    notice = state.bingoNotice,
                    ranks = state.ranks,
                    tournaments = state.tournaments,
                    onNewCard = vm::newCard,
                    onBuyExtra = vm::buyExtraCard,
                    onChangeExtra = vm::changeExtraCard,
                    onToggleSkip = vm::setSkip,
                    onSponsor = vm::submitSponsor,
                    onLoadLeaderboard = vm::loadLeaderboard,
                    onLoadTournaments = vm::loadTournaments,
                    onOpenChat = { nav.navigate("livechat") },
                    onClearNotice = vm::clearBingoNotice,
                )
            }
            composable("beats") {
                BeatsScreen(
                    beats = state.beats,
                    onLike = vm::like,
                    onComment = { vm.openComments(it); nav.navigate("home") },
                    onUpload = { uri -> vm.createPost("", null, null, uri, "public", null, null) },
                )
            }
            composable("games") {
                GamesScreen { g -> openGame(g.id, g.title) }
            }
            composable("me") {
                MeScreen(
                    me = state.profile,
                    posts = state.posts,
                    friendsCount = state.friendsCount,
                    history = state.history,
                    notice = state.meNotice,
                    onOpenStore = { nav.navigate("store") },
                    onOpenInbox = { nav.navigate("inbox") },
                    onOpenLiveChat = { nav.navigate("livechat") },
                    onOpenNotifs = { /* Home handles sheet; reuse inbox for now */ nav.navigate("inbox") },
                    onSignOut = vm::signOut,
                    onSaveProfile = vm::saveProfile,
                    onClaimReferral = vm::claimReferral,
                    onRequestVerification = vm::requestVerification,
                    onClearNotice = vm::clearMeNotice,
                    onOpenComments = vm::openComments,
                    comments = state.comments,
                    commentsOpen = state.openCommentsFor != null,
                    onSendComment = vm::sendComment,
                    onCloseComments = vm::closeComments,
                    onSendSupport = vm::sendSupport,
                )
            }
            composable("store") {
                StoreScreen(
                    me = state.profile,
                    message = state.cashoutMessage,
                    onCashout = vm::cashout,
                    onBuySkin = vm::buyOrEquipSkin,
                    onInvite = { nav.navigate("me") },
                    onOpenHome = { nav.navigate("home") },
                )
            }
            composable("inbox") {
                InboxScreen(conversations = state.inbox) { conv ->
                    vm.openThread(conv)
                    nav.navigate("thread")
                }
            }
            composable("thread") {
                val conv = state.openThread
                ThreadScreen(
                    title = conv?.name ?: "Chat",
                    myUid = state.profile?.uid,
                    messages = state.thread,
                    onBack = { vm.closeThread(); nav.popBackStack() },
                    onSend = vm::sendPm,
                )
            }
            composable("livechat") {
                LiveChatScreen(lines = state.liveChat, onSend = vm::sendLiveChat)
            }
        }
    }
}
