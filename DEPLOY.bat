@echo off
title Radio Bingo - Deploy Push Notifications
chcp 65001 >nul 2>&1

echo.
echo ============================================
echo  RADIO BINGO - PUSH NOTIFICATIONS DEPLOY
echo ============================================
echo.

:: Check kung nasa tamang folder
if not exist "index.html" (
    echo ERROR: Hindi makita ang index.html!
    echo.
    echo Siguraduhin na naka-lagay ang DEPLOY.bat sa loob
    echo ng project folder katabi ng index.html.
    echo.
    pause
    exit /b 1
)

if not exist "firebase-messaging-sw.js" (
    echo ERROR: Hindi makita ang firebase-messaging-sw.js!
    echo.
    echo I-lagay muna ang lahat ng files sa project folder:
    echo   - firebase-messaging-sw.js
    echo   - firebase.json
    echo   - functions\index.js
    echo   - functions\package.json
    echo.
    pause
    exit /b 1
)

if not exist "functions\index.js" (
    echo ERROR: Hindi makita ang functions\index.js!
    echo.
    echo I-lagay muna ang functions folder sa project folder.
    echo.
    pause
    exit /b 1
)

:: Check Node.js
echo [1/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Hindi naka-install ang Node.js!
    echo.
    echo Magbubukas ng download page. I-install muna,
    echo tapos i-double click ulit ang DEPLOY.bat.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)
echo OK - Node.js found.

:: Install Firebase CLI
echo.
echo [2/5] Installing Firebase CLI...
call npm install -g firebase-tools
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Hindi ma-install ang Firebase CLI.
    echo I-right click ang DEPLOY.bat at piliin "Run as administrator".
    echo.
    pause
    exit /b 1
)
echo OK - Firebase CLI ready.

:: Install function dependencies
echo.
echo [3/5] Installing function dependencies...
cd functions
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: npm install failed sa functions folder.
    cd ..
    pause
    exit /b 1
)
cd ..
echo OK - Dependencies installed.

:: Firebase login
echo.
echo [4/5] Firebase login...
echo.
echo Magbubukas ng browser. Mag-login gamit ang Google account
echo na may access sa radiobingo-9ac29 project.
echo.
pause
call firebase login
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Firebase login failed.
    pause
    exit /b 1
)

call firebase use radiobingo-9ac29
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Hindi ma-set ang Firebase project.
    echo Siguraduhin may access ka sa radiobingo-9ac29.
    pause
    exit /b 1
)

:: Deploy
echo.
echo [5/5] Deploying Cloud Functions (2-5 minuto)...
echo.
call firebase deploy --only functions
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Deploy failed. Basahin ang error sa itaas.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  DONE! Push Notifications deployed!
echo ============================================
echo.
echo Subukan: mag-react o mag-comment sa isang
echo account - dapat makatanggap ng push notification
echo ang kabilang user.
echo.
pause
