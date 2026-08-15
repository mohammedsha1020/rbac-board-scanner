# setup_build_environment.ps1
# Automates Flutter & Android SDK toolchain downloads, environment path variables setup, and APK compilation.
# Run in PowerShell as Administrator.

Write-Host "=============================================" -ForegroundColor Green
Write-Host "  BoardScanner Toolchain Setup & APK Builder  " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# 1. Create tools folders inside workspace
$ToolsDir = "D:\tg-app\tools"
if (!(Test-Path $ToolsDir)) {
    New-Item -Path $ToolsDir -ItemType Directory | Out-Null
    Write-Host "[+] Created tools directory at $ToolsDir"
}

# 2. Download and Configure local Java JDK 17 (Required for Android SDK tools)
$JdkHome = "$ToolsDir\jdk-17"
if (!(Test-Path "$JdkHome\bin\java.exe")) {
    Write-Host "[*] Downloading JDK 17 zip (Adoptium Temurin) via curl..." -ForegroundColor Yellow
    $JdkUrl = "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
    $JdkZip = "$ToolsDir\jdk17.zip"
    
    # Run native curl.exe with follow redirects (-L)
    & curl.exe -L -o $JdkZip $JdkUrl
    
    Write-Host "[+] Download complete. Extracting JDK 17..." -ForegroundColor Yellow
    $TempJdk = "$ToolsDir\temp_jdk"
    Expand-Archive -Path $JdkZip -DestinationPath $TempJdk -Force
    
    # Get the extracted directory (e.g. jdk-17.0.11+9) and move it
    $ExtractedFolder = Get-ChildItem -Path $TempJdk -Directory | Select-Object -First 1
    Move-Item -Path $ExtractedFolder.FullName -Destination $JdkHome -Force
    
    Remove-Item -Path $JdkZip -Force
    Remove-Item -Path $TempJdk -Recurse -Force
    Write-Host "[+] JDK 17 configured locally at $JdkHome" -ForegroundColor Green
} else {
    Write-Host "[+] JDK 17 is already configured locally at $JdkHome" -ForegroundColor Green
}

# Explicitly assign JAVA_HOME and Path variables for this build process
# Append Git cmd AND Git bin directories to make sure the Git shell is fully linked
$env:JAVA_HOME = $JdkHome
$env:PATH = "$JdkHome\bin;C:\Users\sha\AppData\Local\Programs\Git\cmd;C:\Users\sha\AppData\Local\Programs\Git\bin;" + $env:PATH

# Confirm java version in current process
Write-Host "[*] Validating Java Runtime Version..."
& java -version

# Configure Git safe directory status to bypass directory ownership restrictions
Write-Host "[*] Configuring Git Safe Directory Permissions..."
& git config --global --add safe.directory "*"

# Confirm git is operational
Write-Host "[*] Confirming Git CLI status..."
& git --version

# 3. Download & Configure Android SDK CLI Command Line Tools
$AndroidHome = "$ToolsDir\android-sdk"
$SdkManager = "$AndroidHome\cmdline-tools\latest\bin\sdkmanager.bat"

if (!(Test-Path $SdkManager)) {
    Write-Host "[*] Downloading Android SDK command line tools via curl..." -ForegroundColor Yellow
    $AndroidCliUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    $ZipFile = "$ToolsDir\cmdline-tools.zip"
    
    & curl.exe -L -o $ZipFile $AndroidCliUrl
    
    Write-Host "[+] Download complete. Extracting Android command line tools..." -ForegroundColor Yellow
    $TempExtract = "$ToolsDir\temp_sdk"
    Expand-Archive -Path $ZipFile -DestinationPath $TempExtract -Force
    
    New-Item -Path "$AndroidHome\cmdline-tools" -ItemType Directory -Force | Out-Null
    Move-Item -Path "$TempExtract\cmdline-tools" -Destination "$AndroidHome\cmdline-tools\latest" -Force
    
    Remove-Item -Path $ZipFile -Force
    Remove-Item -Path $TempExtract -Recurse -Force
    Write-Host "[+] Android SDK Manager configured." -ForegroundColor Green
} else {
    Write-Host "[+] Android SDK Manager already configured." -ForegroundColor Green
}

# Install Android Platform, Build-Tools, and Licenses
$env:ANDROID_HOME = $AndroidHome
$env:PATH += ";$AndroidHome\platform-tools;$AndroidHome\cmdline-tools\latest\bin"

Write-Host "[*] Updating Android Platform Tools & Build tools (API 34)..." -ForegroundColor Yellow
& $SdkManager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Accept SDK licenses automatically
Write-Host "[*] Accepting Android SDK Licenses..."
$LicensesFile = "$AndroidHome\licenses"
if (!(Test-Path $LicensesFile)) {
    # Pipe 'y' to accept licenses
    $yes = , "y" * 10
    $yes | & $SdkManager --licenses
}

# 4. Download & Configure Flutter SDK
$FlutterRoot = "$ToolsDir\flutter"
$FlutterBin = "$FlutterRoot\bin\flutter.bat"

if (!(Test-Path $FlutterBin)) {
    Write-Host "[*] Downloading Flutter SDK (Stable release) via curl..." -ForegroundColor Yellow
    $FlutterUrl = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.19.6-stable.zip"
    $FlutterZip = "$ToolsDir\flutter.zip"
    
    & curl.exe -L -o $FlutterZip $FlutterUrl
    
    Write-Host "[+] Download complete. Extracting Flutter..." -ForegroundColor Yellow
    Expand-Archive -Path $FlutterZip -DestinationPath $ToolsDir -Force
    Remove-Item -Path $FlutterZip -Force
    Write-Host "[+] Flutter SDK configured." -ForegroundColor Green
} else {
    Write-Host "[+] Flutter SDK already configured." -ForegroundColor Green
}

# 5. Set Environment Variables for Current Process
$env:PATH += ";$FlutterRoot\bin"

# Configure Android SDK location inside Flutter
Write-Host "[*] Configuring Flutter Android SDK path linkage..."
& $FlutterBin config --android-sdk $AndroidHome

# Confirm installations
Write-Host "[*] Validating Flutter Environment Status..."
& $FlutterBin doctor

# 6. Build the Android App APK
Write-Host "[*] Navigating to Flutter Frontend Directory..."
cd "D:\tg-app\frontend"

Write-Host "[*] Installing Flutter packages..."
& $FlutterBin pub get

Write-Host "[*] Compiling APK bundle..." -ForegroundColor Yellow
& $FlutterBin build apk --release

Write-Host "=============================================" -ForegroundColor Green
Write-Host "  APK Compiling Finished!  " -ForegroundColor Green
Write-Host "  File Location: D:\tg-app\frontend\build\app\outputs\flutter-apk\app-release.apk" -ForegroundColor Green
Write-Host "  Copy this APK file to your phone to install." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
