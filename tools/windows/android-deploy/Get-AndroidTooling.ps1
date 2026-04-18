Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-ExistingPath {
    param([string[]]$Candidates)

    foreach ($candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        $expanded = [Environment]::ExpandEnvironmentVariables($candidate)
        if (Test-Path $expanded) {
            return (Resolve-Path $expanded).Path
        }
    }

    return $null
}

function Resolve-CommandPath {
    param([string]$CommandName)

    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Get-AndroidSdkRoot {
    $sdkRoot = Resolve-ExistingPath @(
        $env:ANDROID_SDK_ROOT,
        $env:ANDROID_HOME,
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:USERPROFILE\AppData\Local\Android\Sdk"
    )

    if (-not $sdkRoot) {
        throw "Could not find Android SDK. Set ANDROID_SDK_ROOT or install Android Studio."
    }

    return $sdkRoot
}

function Get-AdbPath {
    $fromPath = Resolve-CommandPath 'adb.exe'
    if ($fromPath) { return $fromPath }

    $sdkRoot = Get-AndroidSdkRoot
    $adb = Resolve-ExistingPath @(
        (Join-Path $sdkRoot 'platform-tools\adb.exe')
    )

    if (-not $adb) {
        throw "Could not find adb.exe in PATH or Android SDK platform-tools."
    }

    return $adb
}

function Get-EmulatorPath {
    $sdkRoot = Get-AndroidSdkRoot
    return Resolve-ExistingPath @(
        (Join-Path $sdkRoot 'emulator\emulator.exe')
    )
}

function Get-FlutterPath {
    $fromPath = Resolve-CommandPath 'flutter.bat'
    if ($fromPath) { return $fromPath }

    return Resolve-ExistingPath @(
        "$env:FLUTTER_ROOT\bin\flutter.bat",
        "$env:USERPROFILE\flutter\bin\flutter.bat",
        "$env:USERPROFILE\dev\flutter\bin\flutter.bat",
        "$env:LOCALAPPDATA\Programs\Flutter\bin\flutter.bat"
    )
}

function Get-AndroidTooling {
    $sdkRoot = Get-AndroidSdkRoot
    $adbPath = Get-AdbPath
    $emulatorPath = Get-EmulatorPath
    $flutterPath = Get-FlutterPath

    [pscustomobject]@{
        AndroidSdkRoot = $sdkRoot
        AdbPath = $adbPath
        EmulatorPath = $emulatorPath
        FlutterPath = $flutterPath
    }
}
