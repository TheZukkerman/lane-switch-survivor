# Lane-Switch Survivor prototype

Current direction: a fixed 3-lane mastery game, not endless survival.

## Fastest mobile test strategy

Keep the prototype as a plain static web game, then serve it either:

- over local Wi-Fi from the dev machine, or
- over USB with `adb reverse` if phone and computer are connected

That is the quickest low-friction Android path right now, without rebuilding it as a full Flutter app.

## Start the prototype

From this folder:

```bash
./serve-mobile.sh
```

Default port is `4173`.

If you want a different port:

```bash
./serve-mobile.sh 8080
```

## Test on Android

### Option A, same Wi-Fi

1. Start the server:
   ```bash
   ./serve-mobile.sh
   ```
2. Note the LAN URL printed in the terminal, for example:
   ```
   http://192.168.1.23:4173
   ```
3. Make sure the Android phone is on the same Wi-Fi.
4. Open that URL in Chrome on the phone.
5. Play with:
   - tap left or right half of the playfield
   - swipe horizontally on the playfield
   - optional on-screen buttons under the canvas

### Option B, USB with ADB reverse

Use this if local network access is annoying or blocked.

1. Connect the Android phone with USB.
2. Confirm ADB sees it:
   ```bash
   adb devices
   ```
3. Start the server:
   ```bash
   ./serve-mobile.sh
   ```
4. In another terminal, forward the port to the phone:
   ```bash
   adb reverse tcp:4173 tcp:4173
   ```
5. Open this on the phone:
   ```
   http://localhost:4173
   ```

## Local desktop run

If you only want to test locally on the computer:

```bash
./serve-mobile.sh
```

Then open <http://localhost:4173>.

## Controls

- Left / Right arrow
- A / D
- Tap left or right side of the playfield
- Swipe horizontally on the playfield
- Restart button, or Space after game over

## Current build, first fixed level

- one authored level that lasts about 24 seconds
- exact same obstacle sequence every attempt
- clear ready state before the run starts
- fail state on any collision
- quick restart after fail
- simple level complete state when the final sequence is cleared
- sparse scripted corrupted lane moments, no random corruption

## Mobile tweaks included

- mobile viewport and theme color metadata
- safe-area friendly layout for Android phones
- bigger tap targets for touch controls
- canvas sizing that fits better inside phone-height constraints
- more reliable swipe handling via pointer capture
