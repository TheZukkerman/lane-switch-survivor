# Lane-Switch Survivor prototype

Current direction: a small authored progression test with a softer early curve.

## Start the prototype

Fastest local playtest flow:

```bash
./playtest.sh
```

What it does:
- starts a local server automatically
- reuses the existing playtest server if one is already running
- picks the first free port starting at `4173`
- opens the game in your browser when the environment supports it

If you want to prefer a different starting port:

```bash
PLAYTEST_PORT=8080 ./playtest.sh
```

The older direct server script still works too:

```bash
./serve-mobile.sh
```

## Test on Android

### Option A, same Wi-Fi

1. Start the server:
   ```bash
   ./playtest.sh
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
   ./playtest.sh
   ```
4. In another terminal, forward the same port shown by the launcher, for example:
   ```bash
   adb reverse tcp:4175 tcp:4175
   ```
5. Open the matching localhost URL on the phone, for example:
   ```
   http://localhost:4175
   ```

## Local desktop run

```bash
./playtest.sh
```

It should open automatically. If not, open the printed localhost URL manually.

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

## Playtest launcher notes

- The launcher keeps the server running in the background and writes state to `.playtest/`.
- Run `./playtest.sh` again anytime to reopen the current build quickly.
- If port `4173` is busy, it tries the next ports until it finds a free one.
- Browser auto-open depends on `xdg-open`, `open`, or `wslview` being available.
