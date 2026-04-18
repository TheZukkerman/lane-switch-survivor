# Android USB attach helper for WSL

This folder contains a deliberately narrow Windows-side helper for one job only:

- find Android-like USB devices exposed through `usbipd`
- optionally bind the selected device
- attach it to WSL for Flutter / `adb` deploy work

It is **not** a general host command broker.
It does **not** run arbitrary commands.
It only wraps the `usbipd` Android attach flow.

## Files

- `Attach-AndroidUsbToWsl.ps1` - PowerShell helper for Android-only attach

## One-time manual setup on Windows

Do this once on the Windows host:

1. Install `usbipd-win`
   - easiest: `winget install dorssel.usbipd-win`
   - or install from the official release page: <https://github.com/dorssel/usbipd-win>
2. Make sure WSL is installed and your target distro starts normally.
3. Connect the Android phone by USB.
4. On the phone:
   - enable Developer options
   - enable USB debugging
   - accept the computer trust / RSA prompt when it appears
5. Open **PowerShell as Administrator** once and test:

   ```powershell
   usbipd list
   ```

   You should see the phone listed.
6. Save or copy this folder somewhere stable on Windows, for example:

   ```text
   C:\Users\<you>\android-usbipd\
   ```

### Optional but practical

Create a desktop shortcut or PowerShell profile alias that points to:

```powershell
powershell.exe -ExecutionPolicy Bypass -File C:\Users\<you>\android-usbipd\Attach-AndroidUsbToWsl.ps1
```

That keeps the operator action to a single trusted script, instead of free-form shell access.

## Regular usage after setup

Run from an elevated PowerShell window on Windows:

```powershell
./Attach-AndroidUsbToWsl.ps1
```

Behavior:

- if exactly one Android-like USB device is found, it binds and attaches it to WSL
- if several Android-like devices are found, it stops and asks for explicit `-BusId`
- if no Android-like device is found, it fails clearly

### Explicit device selection

First list candidates:

```powershell
./Attach-AndroidUsbToWsl.ps1 -ListOnly
```

Then attach a specific one:

```powershell
./Attach-AndroidUsbToWsl.ps1 -BusId 1-7
```

### Attach to a specific distro

```powershell
./Attach-AndroidUsbToWsl.ps1 -BusId 1-7 -Distro Ubuntu
```

### Skip bind if it is already shared

```powershell
./Attach-AndroidUsbToWsl.ps1 -BusId 1-7 -SkipBind
```

## What manager can rely on later

After the one-time Windows setup, the ongoing flow can stay narrow:

1. human plugs in Android phone
2. human runs the trusted Windows script above
3. WSL gets the phone attached through `usbipd`
4. manager can continue from WSL side with normal deploy commands like `adb devices` and `flutter run`

So the manual Windows step becomes a small, explicit bridge instead of broad host execution.

## Notes and limits

- `usbipd bind` and `usbipd attach --wsl` typically require elevated PowerShell.
- Device-name detection is intentionally conservative and Android-focused.
- If the phone shows up under an unexpected vendor/description, use `-ListOnly` and then `-BusId`.
- This helper does not try to install drivers, manage `adb`, or expose other host actions.
