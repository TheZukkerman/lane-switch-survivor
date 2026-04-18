[CmdletBinding()]
param(
    [ValidateSet('run','install','devices','doctor')]
    [string]$Action = 'run',

    [string]$RepoRoot,
    [string]$FlutterProject = 'flutter_app',
    [string]$DeviceId,
    [string]$Flavor,
    [switch]$StartEmulator,
    [string]$AvdName,
    [switch]$BuildOnly,
    [switch]$SkipBuild,
    [switch]$Release
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Get-AndroidTooling.ps1')

function Fail($Message) {
    Write-Error $Message
    exit 1
}

function Invoke-Step {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory
    )

    Write-Host ''
    Write-Host "> $FilePath $($ArgumentList -join ' ')" -ForegroundColor Cyan

    Push-Location $WorkingDirectory
    try {
        & $FilePath @ArgumentList
        if ($LASTEXITCODE -ne 0) {
            Fail "Command failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Get-ResolvedRepoRoot {
    param([string]$ProvidedRoot)

    if ($ProvidedRoot) {
        return (Resolve-Path $ProvidedRoot).Path
    }

    return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Get-FlutterProjectRoot {
    param([string]$BaseRepoRoot, [string]$ProjectDir)

    $root = Join-Path $BaseRepoRoot $ProjectDir
    if (-not (Test-Path (Join-Path $root 'pubspec.yaml'))) {
        Fail "Flutter project not found at $root"
    }

    return $root
}

function Get-ApkPath {
    param([string]$ProjectRoot, [bool]$UseRelease)

    $name = if ($UseRelease) { 'app-release.apk' } else { 'app-debug.apk' }
    $apkPath = Join-Path $ProjectRoot "build\app\outputs\flutter-apk\$name"
    if (-not (Test-Path $apkPath)) {
        Fail "APK not found at $apkPath"
    }

    return $apkPath
}

function Get-ConnectedDevices {
    param([string]$AdbPath)

    $lines = & $AdbPath devices | Select-Object -Skip 1
    $devices = @()
    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line -match '^(?<id>\S+)\s+device$') {
            $devices += $Matches['id']
        }
    }
    return $devices
}

function Ensure-EmulatorStarted {
    param($Tooling, [string]$RequestedAvd)

    if (-not $Tooling.EmulatorPath) {
        Fail 'Android emulator.exe was not found. Install Android SDK Emulator from Android Studio.'
    }

    $devices = Get-ConnectedDevices -AdbPath $Tooling.AdbPath
    if ($devices | Where-Object { $_ -like 'emulator-*' }) {
        Write-Host 'An Android emulator is already running.' -ForegroundColor Green
        return
    }

    $avdToUse = $RequestedAvd
    if (-not $avdToUse) {
        $avdToUse = (& $Tooling.EmulatorPath '-list-avds' | Select-Object -First 1)
    }

    if (-not $avdToUse) {
        Fail 'No Android Virtual Device found. Create one in Android Studio Device Manager first.'
    }

    Write-Host "Starting emulator $avdToUse ..." -ForegroundColor Yellow
    Start-Process -FilePath $Tooling.EmulatorPath -ArgumentList @('-avd', $avdToUse) | Out-Null

    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 2
        $devices = Get-ConnectedDevices -AdbPath $Tooling.AdbPath
        if ($devices | Where-Object { $_ -like 'emulator-*' }) {
            Write-Host 'Emulator connected.' -ForegroundColor Green
            return
        }
    }

    Fail 'Emulator did not come online within 2 minutes.'
}

$tooling = Get-AndroidTooling
$repoRoot = Get-ResolvedRepoRoot -ProvidedRoot $RepoRoot
$projectRoot = Get-FlutterProjectRoot -BaseRepoRoot $repoRoot -ProjectDir $FlutterProject
$buildMode = if ($Release) { 'release' } else { 'debug' }

switch ($Action) {
    'doctor' {
        Write-Host "RepoRoot:        $repoRoot"
        Write-Host "FlutterProject:  $projectRoot"
        Write-Host "AndroidSdkRoot:  $($tooling.AndroidSdkRoot)"
        Write-Host "adb.exe:         $($tooling.AdbPath)"
        Write-Host "emulator.exe:    $($tooling.EmulatorPath)"
        Write-Host "flutter.bat:     $($tooling.FlutterPath)"
        $devices = Get-ConnectedDevices -AdbPath $tooling.AdbPath
        if ($devices.Count -gt 0) {
            Write-Host "Connected:       $($devices -join ', ')"
        }
        else {
            Write-Host 'Connected:       none'
        }
        exit 0
    }
    'devices' {
        Invoke-Step -FilePath $tooling.AdbPath -ArgumentList @('devices', '-l') -WorkingDirectory $projectRoot
        exit 0
    }
}

if ($StartEmulator) {
    Ensure-EmulatorStarted -Tooling $tooling -RequestedAvd $AvdName
}

if ($Action -eq 'run') {
    if (-not $tooling.FlutterPath) {
        Fail 'flutter.bat not found. Install Flutter on Windows or add it to PATH.'
    }

    $args = @('run')
    if ($DeviceId) { $args += @('-d', $DeviceId) }
    if ($Flavor) { $args += @('--flavor', $Flavor) }
    if ($Release) { $args += '--release' }

    Invoke-Step -FilePath $tooling.FlutterPath -ArgumentList $args -WorkingDirectory $projectRoot
    exit 0
}

if (-not $SkipBuild) {
    if (-not $tooling.FlutterPath) {
        Fail 'flutter.bat not found. Install Flutter on Windows or add it to PATH.'
    }

    $buildArgs = @('build', 'apk', "--$buildMode")
    if ($Flavor) { $buildArgs += @('--flavor', $Flavor) }
    Invoke-Step -FilePath $tooling.FlutterPath -ArgumentList $buildArgs -WorkingDirectory $projectRoot
}

if ($BuildOnly) {
    exit 0
}

$apkPath = Get-ApkPath -ProjectRoot $projectRoot -UseRelease:$Release
$adbArgs = @('install', '-r', $apkPath)
if ($DeviceId) { $adbArgs = @('-s', $DeviceId) + $adbArgs }
Invoke-Step -FilePath $tooling.AdbPath -ArgumentList $adbArgs -WorkingDirectory $projectRoot

Write-Host ''
Write-Host "Installed APK: $apkPath" -ForegroundColor Green
