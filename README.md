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

## Current build, readable mini-world slice

- the top progression area is now a path-style map instead of three cards in a row
- the first three levels are framed as a mini-journey:
  - 1. Lägerelden
  - 2. Skogsstigen
  - 3. Ruinen på kullen
- connector lines now link the nodes so the route reads like a small world path
- every node now shows:
  - number
  - place name
  - explicit status: `Current`, `Open`, `Locked`, or `Done`
- a legend/status row sits above the map for fast scanning
- state styling is more distinct:
  - `Current` = strongest highlight, "you are here"
  - `Open` = active and clearly clickable
  - `Locked` = darker with lock copy
  - `Done` = filled/checked completed stop
- the run flow is unchanged, including auto-advance after a clear
- localStorage persists progression between refreshes

## Suggested playtest checks

1. Launch the build and spend 5 to 10 seconds only looking at the map. It should already read like a tiny journey.
2. Without reading the side card much, identify where you are now, what is playable, and what is locked.
3. Clear Lägerelden and confirm Skogsstigen feels like the next stop on the same path.
4. Clear Skogsstigen and check whether Ruinen på kullen feels like a final destination instead of just card three.
5. Replay a cleared node and confirm `Done` still reads as completed while the selected node still feels `Current`.

## Resetting progress for repeat tests

Open the browser console and run:

```js
localStorage.removeItem('laneSwitchProgressV5')
```

Then refresh.

## Playtest launcher notes

- The launcher keeps the server running in the background and writes state to `.playtest/`.
- Run `./playtest.sh` again anytime to reopen the current build quickly.
- If port `4173` is busy, it tries the next ports until it finds a free one.
- Browser auto-open depends on `xdg-open`, `open`, or `wslview` being available.
