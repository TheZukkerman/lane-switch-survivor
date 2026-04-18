# lane_switch_survivor

Flutter app for Lane Switch Survivor.

## Fast Android debug delivery

If you just want the latest debug build on a phone, use:

```bash
./share-android-debug.sh
```

The script:
- runs `flutter build apk --debug`
- copies the APK into a small local share folder
- starts or reuses a local HTTP server
- prints a LAN URL you can open directly on the phone

Typical flow:
1. Run `./share-android-debug.sh` on the dev machine.
2. On the phone, open the printed `http://<your-lan-ip>:<port>` URL while on the same Wi-Fi.
3. Tap **Download APK**.
4. If Android warns the first time, allow installs from that browser.
5. Install or update the app.

This avoids adb for the normal build-install-test loop.

## Manual commands

Run directly on a connected device:

```bash
flutter run
```

Build only:

```bash
flutter build apk --debug
```

APK output:

```bash
build/app/outputs/flutter-apk/app-debug.apk
```

Shared APK output created by the helper:

```bash
.android-debug-share/public/lane-switch-survivor-debug.apk
```

## Notes and limitations

- The phone must be able to reach the dev machine over the local network.
- First install from browser may require enabling "install unknown apps" for that browser once.
- This ships debug APKs only, meant for quick testing, not store distribution.
