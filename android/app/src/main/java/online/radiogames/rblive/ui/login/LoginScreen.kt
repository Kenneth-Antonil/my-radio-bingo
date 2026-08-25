package online.radiogames.rblive.ui.login

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import online.radiogames.rblive.R
import online.radiogames.rblive.ui.theme.Accent
import online.radiogames.rblive.ui.theme.Bg
import online.radiogames.rblive.ui.theme.Gold
import online.radiogames.rblive.ui.theme.Text1
import online.radiogames.rblive.ui.theme.Text2

@Composable
fun LoginScreen(
    loading: Boolean,
    error: String?,
    onGoogleSignIn: () -> Unit,
) {
    val ctx = LocalContext.current
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg),
    ) {
        Box(
            Modifier
                .size(340.dp)
                .offset(x = 80.dp, y = (-90).dp)
                .align(Alignment.TopEnd)
                .background(
                    Brush.radialGradient(listOf(Color(0x335B8AF5), Color.Transparent)),
                    CircleShape,
                ),
        )
        Box(
            Modifier
                .size(280.dp)
                .offset(x = (-70).dp, y = 40.dp)
                .align(Alignment.CenterStart)
                .background(
                    Brush.radialGradient(listOf(Color(0x227C6CF5), Color.Transparent)),
                    CircleShape,
                ),
        )
        Box(
            Modifier
                .size(240.dp)
                .offset(x = 40.dp, y = 80.dp)
                .align(Alignment.BottomEnd)
                .background(
                    Brush.radialGradient(listOf(Color(0x1AE5A531), Color.Transparent)),
                    CircleShape,
                ),
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding(),
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 28.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(50.dp))
                        .background(Color(0x145B8AF5))
                        .border(1.dp, Color(0x335B8AF5), RoundedCornerShape(50.dp))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Text(
                        "LIVE NOW",
                        color = Color(0xFF8EB0FF),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.4.sp,
                    )
                }
                Spacer(Modifier.height(22.dp))
                AsyncImage(
                    model = "https://i.imgur.com/4nljOtR.png",
                    contentDescription = "RB Live",
                    modifier = Modifier
                        .size(108.dp)
                        .clip(RoundedCornerShape(26.dp)),
                    contentScale = ContentScale.Crop,
                    placeholder = painterResource(R.drawable.ic_launcher_foreground),
                    error = painterResource(R.drawable.ic_launcher_foreground),
                )
                Spacer(Modifier.height(18.dp))
                Text("RB Live", color = Color.White, fontWeight = FontWeight.Black, fontSize = 32.sp)
                Spacer(Modifier.height(8.dp))
                Text(
                    "Connect. Play. Win Rewards.\nJoin the RB Live community.",
                    color = Text2,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp,
                    fontSize = 15.sp,
                )
                Spacer(Modifier.height(22.dp))
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FeaturePill("Live Bingo")
                    FeaturePill("Earn Points")
                    FeaturePill("My Shop")
                    FeaturePill("Leaderboard")
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
                    .background(Color(0xF20B0E14))
                    .border(
                        1.dp,
                        Color(0x14FFFFFF),
                        RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
                    )
                    .padding(horizontal = 22.dp, vertical = 22.dp),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0x1AE5A531))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0x33E5A531)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("🎁", fontSize = 20.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("200 pts Free on Sign Up", color = Gold, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
                        Text("New accounts only · Limited time", color = Text2, fontSize = 12.sp)
                    }
                }
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = onGoogleSignIn,
                    enabled = !loading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = Color(0xFF111827),
                        disabledContainerColor = Color(0xFFE5E7EB),
                    ),
                ) {
                    if (loading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(22.dp),
                            strokeWidth = 2.5.dp,
                            color = Accent,
                        )
                    } else {
                        Image(
                            painter = painterResource(R.drawable.ic_google_g),
                            contentDescription = null,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(10.dp))
                        Text("Continue with Google", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
                if (!error.isNullOrBlank()) {
                    Spacer(Modifier.height(12.dp))
                    Text(error, color = Color(0xFFFB7185), textAlign = TextAlign.Center, fontSize = 13.sp, modifier = Modifier.fillMaxWidth())
                }
                Spacer(Modifier.height(16.dp))
                Text(
                    "Secured by Firebase Auth",
                    color = Text2,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "For entertainment purposes only · No real money betting",
                    color = Text2,
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Text(
                        "Terms",
                        color = Color(0xFF8EB0FF),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable {
                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://radiogames.online/terms.html")))
                        },
                    )
                    Text("  ·  ", color = Text2, fontSize = 12.sp)
                    Text(
                        "Privacy Policy",
                        color = Color(0xFF8EB0FF),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable {
                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://radiogames.online/privacy.html")))
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun FeaturePill(label: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0x14FFFFFF))
            .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(20.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(label, color = Text1, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}
