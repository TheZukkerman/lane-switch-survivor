# Lane Switch Survivor

Repo status:
- `index.html` + `game.js` = earlier web prototype
- `flutter_app/` = first real Flutter / Android slice

## Flutter Android slice

What is in the first slice:
- 1 fixed authored level, about 42 seconds
- 3 lanes
- touch lane switching by tap or swipe
- 3 obstacle feels: light block, heavy block, double-lane pressure pattern
- corrupted lane windows with clear visual marking
- corrupted lane risk/reward: extra score while active, but staying there too long overloads and kills the run
- clear / fail states
- direct retry loop
- result state with time left, clean dodges, close calls, and 1 to 3 stars

What is intentionally not in yet:
- world map
- multiple levels
- unlocks, economy, upgrades
- heavy HUD
- story or meta systems
- backend

## Run on Android

### Preferred path now, Windows-side deploy

For the least fragile Android loop, run Flutter and `adb` from Windows, not from WSL.

See:

- `tools/windows/android-deploy/README.md`

Quick start from a Windows checkout of this repo:

```powershell
.\tools\windows\android-deploy\android-run.cmd
```

That is the intended default path for emulator and phone testing going forward.

### Direct Flutter run

```bash
cd flutter_app
flutter run
```

If a device is connected, Flutter will install and launch the build.

## Fast phone install flow, no USB after setup

Simplest repeatable path for Android testing:

```bash
cd flutter_app
./share-android-debug.sh
```

What it does:
- builds a fresh debug APK
- copies it into a tiny local share folder
- starts or reuses a local HTTP server
- prints a phone-friendly URL on your LAN

On the phone:
- open the printed LAN URL on the same Wi-Fi
- tap **Download APK**
- allow installs from that browser the first time Android asks
- install/update the app

This is the intended fast loop for handing a new debug build to a phone without adb or a cable every time.

### Windows + WSL USB attach helper

This is now the fallback path only.

If Android deploys are still driven from WSL but the phone is physically attached to Windows, use the narrow helper in:

- `tools/windows/android-usbipd/`

It provides an Android-only `usbipd` attach flow, documented here:

- `tools/windows/android-usbipd/README.md`

### Build APK manually

```bash
cd flutter_app
flutter build apk --debug
```

APK output:

```bash
flutter_app/build/app/outputs/flutter-apk/app-debug.apk
```

The share script above reuses this APK and serves it as:

```bash
flutter_app/.android-debug-share/public/lane-switch-survivor-debug.apk
```

## Controls

- Tap left half of the arena to move left
- Tap right half of the arena to move right
- Swipe horizontally to chain lane switches
- Retry button instantly resets the run

## Web prototype

The browser prototype is still here for fast iteration and playtests. Current focus: does corrupted-lane risk/reward make lane choice feel meaningfully more interesting?

```bash
./serve-mobile.sh
```

Then open `http://localhost:4173` locally, or the LAN URL printed by the script on mobile.
