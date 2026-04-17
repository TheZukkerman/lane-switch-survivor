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

```bash
cd flutter_app
flutter run
```

If a device is connected, Flutter will install and launch the build.

### Build APK

```bash
cd flutter_app
flutter build apk --debug
```

APK output:

```bash
flutter_app/build/app/outputs/flutter-apk/app-debug.apk
```

## Controls

- Tap left half of the arena to move left
- Tap right half of the arena to move right
- Swipe horizontally to chain lane switches
- Retry button instantly resets the run

## Web prototype

The earlier browser prototype is still here for reference:

```bash
./playtest.sh
```
