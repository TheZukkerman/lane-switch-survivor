#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-4173}"

if command -v hostname >/dev/null 2>&1; then
  HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
else
  HOST_IP=""
fi

cat <<EOF
Starting Lane-Switch Survivor on 0.0.0.0:${PORT}

Open on this computer:
  http://localhost:${PORT}
EOF

if [[ -n "${HOST_IP}" ]]; then
  cat <<EOF

Open on Android on the same Wi-Fi:
  http://${HOST_IP}:${PORT}
EOF
fi

cat <<EOF

ADB fallback (USB):
  adb reverse tcp:${PORT} tcp:${PORT}
  Then open http://localhost:${PORT} on the phone.
EOF

exec python3 -m http.server "${PORT}" --bind 0.0.0.0
