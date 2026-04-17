# Lane-Switch Survivor prototype

Current direction: a small authored progression test with a softer early curve.

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

### Option B, USB with ADB reverse

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

```bash
./serve-mobile.sh
```

Then open <http://localhost:4173>.

## Controls

- Left / Right arrow
- A / D
- Tap left or right side of the playfield
- Swipe horizontally on the playfield
- Reset button, or Space when not actively running

## Current build, soft progression slice

- Level 1 is a gentle onboarding route with wider timing gaps and one light corruption moment
- Level 2 activates immediately after clearing Level 1, no extra selection click needed
- every level now has a pre-level briefing panel with:
  - level name
  - clear goal
  - mastery goal
  - reward preview
- progression now uses a simple `clear` vs `mastery` structure
  - clear advances progression
  - mastery gives a better placeholder reward/status
- rewards are intentionally lightweight placeholders, shown as stars and a badge in UI
- both levels stay replayable so testers can compare clear versus mastery runs
- localStorage persists progression between refreshes

## Suggested playtest checks

1. Start Level 1 and confirm it feels readable on first attempt.
2. Clear Level 1 and make sure the game lands directly on the Level 2 pre-level overlay.
3. Read the overlay before each level and confirm the goals are understandable without explanation.
4. Clear both levels once, then replay them to see if mastery feels like optional extra credit rather than a punishment.
5. Watch the level cards after clears and mastery to confirm rewards/status update cleanly.

## Resetting progress for repeat tests

Open the browser console and run:

```js
localStorage.removeItem('laneSwitchProgressV3')
```

Then refresh.
