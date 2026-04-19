[CmdletBinding()]
param(
    [ValidateSet('run','install','devices','doctor','playtest')]
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

    return (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
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

function Get-AdbTargetArgs {
    param([string]$ResolvedDeviceId)

    if ($ResolvedDeviceId) {
        return @('-s', $ResolvedDeviceId)
    }

    return @()
}

function Resolve-DeviceId {
    param(
        [string]$AdbPath,
        [string]$RequestedDeviceId,
        [switch]$PreferEmulator
    )

    if ($RequestedDeviceId) {
        return $RequestedDeviceId
    }

    $devices = @(Get-ConnectedDevices -AdbPath $AdbPath)
    if ($devices.Count -eq 0) {
        Fail 'No connected Android device found. Start an emulator with -StartEmulator or connect a phone first.'
    }

    if ($PreferEmulator) {
        $emulators = @($devices | Where-Object { $_ -like 'emulator-*' })
        if ($emulators.Count -eq 1) {
            return $emulators[0]
        }
        if ($emulators.Count -gt 1) {
            Fail 'More than one emulator is online. Re-run with -DeviceId <emulator-id>.'
        }
    }

    if ($devices.Count -eq 1) {
        return $devices[0]
    }

    Fail "More than one Android device is connected ($($devices -join ', ')). Re-run with -DeviceId <id>."
}

function Wait-ForDeviceOnline {
    param(
        [string]$AdbPath,
        [string]$ResolvedDeviceId,
        [int]$TimeoutSeconds = 180
    )

    $adbTargetArgs = Get-AdbTargetArgs -ResolvedDeviceId $ResolvedDeviceId
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    Write-Host "Waiting for device $ResolvedDeviceId to appear in adb..." -ForegroundColor Yellow
    while ((Get-Date) -lt $deadline) {
        $devices = @(Get-ConnectedDevices -AdbPath $AdbPath)
        if ($devices -contains $ResolvedDeviceId) {
            & $AdbPath @adbTargetArgs wait-for-device | Out-Null
            Write-Host "Device $ResolvedDeviceId is connected." -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }

    Fail "Device $ResolvedDeviceId did not appear in adb within $TimeoutSeconds seconds."
}

function Wait-ForAndroidBoot {
    param(
        [string]$AdbPath,
        [string]$ResolvedDeviceId,
        [int]$TimeoutSeconds = 240
    )

    $adbTargetArgs = Get-AdbTargetArgs -ResolvedDeviceId $ResolvedDeviceId
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    Write-Host "Waiting for Android on $ResolvedDeviceId to finish booting..." -ForegroundColor Yellow
    while ((Get-Date) -lt $deadline) {
        $boot = (& $AdbPath @adbTargetArgs shell getprop sys.boot_completed 2>$null | Out-String).Trim()
        $anim = (& $AdbPath @adbTargetArgs shell getprop init.svc.bootanim 2>$null | Out-String).Trim()
        if ($boot -eq '1' -and ($anim -eq 'stopped' -or [string]::IsNullOrWhiteSpace($anim))) {
            Write-Host "Android boot completed on $ResolvedDeviceId." -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 3
    }

    Fail "Android on $ResolvedDeviceId did not finish booting within $TimeoutSeconds seconds."
}

function Ensure-EmulatorStarted {
    param($Tooling, [string]$RequestedAvd)

    if (-not $Tooling.EmulatorPath) {
        Fail 'Android emulator.exe was not found. Install Android SDK Emulator from Android Studio.'
    }

    $devices = @(Get-ConnectedDevices -AdbPath $Tooling.AdbPath)
    $runningEmulators = @($devices | Where-Object { $_ -like 'emulator-*' })
    if ($runningEmulators.Count -gt 0) {
        Write-Host "An Android emulator is already running ($($runningEmulators[0]))." -ForegroundColor Green
        return $runningEmulators[0]
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

    $deadline = (Get-Date).AddMinutes(3)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 2
        $devices = @(Get-ConnectedDevices -AdbPath $Tooling.AdbPath)
        $runningEmulators = @($devices | Where-Object { $_ -like 'emulator-*' })
        if ($runningEmulators.Count -gt 0) {
            Write-Host "Emulator connected as $($runningEmulators[0])." -ForegroundColor Green
            return $runningEmulators[0]
        }
    }

    Fail 'Emulator did not come online within 3 minutes.'
}

function Get-AndroidPackageName {
    param([string]$ProjectRoot)

    $gradleFile = Join-Path $ProjectRoot 'android\app\build.gradle.kts'
    if (-not (Test-Path $gradleFile)) {
        Fail "Could not find $gradleFile"
    }

    $match = Select-String -Path $gradleFile -Pattern 'applicationId\s*=\s*"([^"]+)"' | Select-Object -First 1
    if (-not $match) {
        Fail 'Could not determine Android applicationId from build.gradle.kts.'
    }

    return $match.Matches[0].Groups[1].Value
}

function Start-InstalledApp {
    param(
        [string]$AdbPath,
        [string]$ResolvedDeviceId,
        [string]$PackageName
    )

    $adbTargetArgs = Get-AdbTargetArgs -ResolvedDeviceId $ResolvedDeviceId
    Write-Host "Launching $PackageName on $ResolvedDeviceId ..." -ForegroundColor Yellow

    & $AdbPath @adbTargetArgs shell monkey -p $PackageName -c android.intent.category.LAUNCHER 1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Fail "Could not launch $PackageName on $ResolvedDeviceId."
    }
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
        $devices = @(Get-ConnectedDevices -AdbPath $tooling.AdbPath)
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

$resolvedDeviceId = $DeviceId
if ($StartEmulator) {
    $resolvedDeviceId = Ensure-EmulatorStarted -Tooling $tooling -RequestedAvd $AvdName
    Wait-ForDeviceOnline -AdbPath $tooling.AdbPath -ResolvedDeviceId $resolvedDeviceId
    Wait-ForAndroidBoot -AdbPath $tooling.AdbPath -ResolvedDeviceId $resolvedDeviceId
}
elseif ($Action -eq 'playtest') {
    $resolvedDeviceId = Resolve-DeviceId -AdbPath $tooling.AdbPath -RequestedDeviceId $DeviceId -PreferEmulator
    Wait-ForDeviceOnline -AdbPath $tooling.AdbPath -ResolvedDeviceId $resolvedDeviceId
}

if ($Action -eq 'run') {
    if (-not $tooling.FlutterPath) {
        Fail 'flutter.bat not found. Install Flutter on Windows or add it to PATH.'
    }

    $args = @('run')
    if ($resolvedDeviceId) { $args += @('-d', $resolvedDeviceId) }
    if ($Flavor) { $args += @('--flavor', $Flavor) }
    if ($Release) { $args += '--release' }

    Invoke-Step -FilePath $tooling.FlutterPath -ArgumentList $args -WorkingDirectory $projectRoot
    exit 0
}

if ($Action -eq 'playtest') {
    if (-not $tooling.FlutterPath) {
        Fail 'flutter.bat not found. Install Flutter on Windows or add it to PATH.'
    }

    if (-not $resolvedDeviceId) {
        $resolvedDeviceId = Resolve-DeviceId -AdbPath $tooling.AdbPath -RequestedDeviceId $DeviceId -PreferEmulator
    }

    Wait-ForAndroidBoot -AdbPath $tooling.AdbPath -ResolvedDeviceId $resolvedDeviceId

    $buildArgs = @('build', 'apk', "--$buildMode")
    if ($Flavor) { $buildArgs += @('--flavor', $Flavor) }
    Invoke-Step -FilePath $tooling.FlutterPath -ArgumentList $buildArgs -WorkingDirectory $projectRoot

    $apkPath = Get-ApkPath -ProjectRoot $projectRoot -UseRelease:$Release
    $adbArgs = (Get-AdbTargetArgs -ResolvedDeviceId $resolvedDeviceId) + @('install', '-r', $apkPath)
    Invoke-Step -FilePath $tooling.AdbPath -ArgumentList $adbArgs -WorkingDirectory $projectRoot

    $packageName = Get-AndroidPackageName -ProjectRoot $projectRoot
    Start-InstalledApp -AdbPath $tooling.AdbPath -ResolvedDeviceId $resolvedDeviceId -PackageName $packageName

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Green
    Write-Host "Playtest is ready in emulator/device: $resolvedDeviceId" -ForegroundColor Green
    Write-Host 'App installed and launched successfully.' -ForegroundColor Green
    Write-Host 'Now just look in the emulator and test.' -ForegroundColor Green
    Write-Host '========================================' -ForegroundColor Green
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

if (-not $resolvedDeviceId) {
    $resolvedDeviceId = Resolve-DeviceId -AdbPath $tooling.AdbPath -RequestedDeviceId $DeviceId
}

$apkPath = Get-ApkPath -ProjectRoot $projectRoot -UseRelease:$Release
$adbArgs = (Get-AdbTargetArgs -ResolvedDeviceId $resolvedDeviceId) + @('install', '-r', $apkPath)
Invoke-Step -FilePath $tooling.AdbPath -ArgumentList $adbArgs -WorkingDirectory $projectRoot

Write-Host ''
Write-Host "Installed APK: $apkPath" -ForegroundColor Green
Write-Host "Target device:  $resolvedDeviceId" -ForegroundColor Green
