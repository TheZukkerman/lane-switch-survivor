# Windows Android deploy helper

This folder is the new low-friction path for Android testing from **Windows**, without depending on WSL USB attach working nicely.

The idea is simple:

- run Flutter and `adb` on Windows, where the emulator and USB devices already live
- let one PowerShell script find Android SDK, `adb`, emulator, and `flutter.bat`
- keep the repeat flow to one trusted command

## Files

- `Invoke-AndroidDeploy.ps1` - main helper
- `Get-AndroidTooling.ps1` - resolves SDK / `adb` / emulator / Flutter paths
- `android-run.cmd` - quick wrapper for `flutter run`
- `android-install.cmd` - quick wrapper for `flutter build apk` + `adb install -r`

## One-time setup on Windows

1. Install **Android Studio** with:
   - Android SDK
   - platform-tools
   - emulator, if you want emulator testing
2. Install **Flutter for Windows** and make sure `flutter.bat` works, or set `FLUTTER_ROOT`.
3. Put a Windows copy of this repo somewhere local, for example:

   ```text
   C:\dev\lane-switch-survivor\
   ```

   A real Windows checkout is the safest path for Flutter/Gradle speed and avoids weird WSL file edge cases.
4. Open PowerShell in the repo and test:

   ```powershell
   .\tools\windows\android-deploy\Invoke-AndroidDeploy.ps1 -Action doctor
   ```

5. If you use a physical phone, enable Developer options and USB debugging once.
6. If you use an emulator, create one AVD once in Android Studio Device Manager.

## Normal repeat flow

### Fastest: run straight from Windows

From repo root:

```powershell
.\tools\windows\android-deploy\android-run.cmd
```

That uses `flutter run` on Windows, so hot reload and device launch happen where Android actually is.

### If you already have a device running and only want a fresh APK install

```powershell
.\tools\windows\android-deploy\android-install.cmd
```

That does:
- `flutter build apk --debug`
- `adb install -r ...app-debug.apk`

## Useful options

### See what the script found

```powershell
.\tools\windows\android-deploy\Invoke-AndroidDeploy.ps1 -Action doctor
```

### List connected Android targets

```powershell
.\tools\windows\android-deploy\Invoke-AndroidDeploy.ps1 -Action devices
```

### Target a specific device or emulator

```powershell
.\tools\windows\android-deploy\android-run.cmd -DeviceId emulator-5554
```

or:

```powershell
.\tools\windows\android-deploy\android-install.cmd -DeviceId R5CX123456A
```

### Start the first emulator automatically, then run

```powershell
.\tools\windows\android-deploy\Invoke-AndroidDeploy.ps1 -Action run -StartEmulator
```

### Start a named AVD

```powershell
.\tools\windows\android-deploy\Invoke-AndroidDeploy.ps1 -Action run -StartEmulator -AvdName Pixel_8_API_35
```

## Recommended future workflow

### Once

- keep a Windows checkout of the repo
- install Android Studio + Flutter on Windows
- create one emulator or authorize one phone

### Every test session after that

Option A, emulator:

1. Open PowerShell in the Windows checkout.
2. Run:

   ```powershell
   .\tools\windows\android-deploy\Invoke-AndroidDeploy.ps1 -Action run -StartEmulator
   ```

Option B, physical phone:

1. Plug in phone or connect it with normal Windows `adb` pairing if already set up.
2. Run:

   ```powershell
   .\tools\windows\android-deploy\android-run.cmd
   ```

That is the intended default loop going forward. No `usbipd`, no WSL USB juggling, no hunting for `adb` in PATH each time.

## Notes

- `doctor` works even if `flutter.bat` is not in PATH, as long as `FLUTTER_ROOT` points to Flutter.
- `adb.exe` is resolved from PATH first, then from `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.
- If both a phone and emulator are connected, pass `-DeviceId` to avoid Flutter picking the wrong target.
- `-Action install` is good for clean install/update loops when hot reload is not needed.
