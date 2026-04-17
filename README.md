# Lane-Switch Survivor prototype

Current direction: a small authored progression test, not endless survival.

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

## Current build, simple progression slice

- Level 1 starts open and playable until you clear it
- clearing Level 1 marks it done and permanently retires it
- Level 2 unlocks only after Level 1 is cleared
- completed levels cannot be started again
- the level list clearly shows `OPEN`, `LOCKED`, and `DONE`
- the goal card explains what clears the currently selected level
- localStorage persists progression between refreshes
- Level 2 is a modest step up, not a giant jump

## Resetting progress for repeat tests

Open the browser console and run:

```js
localStorage.removeItem('laneSwitchProgressV2')
```

Then refresh.
