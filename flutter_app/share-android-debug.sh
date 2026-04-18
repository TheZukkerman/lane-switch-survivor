#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${ROOT_DIR}/.android-debug-share"
SERVE_DIR="${STATE_DIR}/public"
PID_FILE="${STATE_DIR}/server.pid"
PORT_FILE="${STATE_DIR}/server.port"
LOG_FILE="${STATE_DIR}/server.log"
DEFAULT_PORT="${ANDROID_SHARE_PORT:-8765}"
PORT_SCAN_LIMIT="${ANDROID_SHARE_PORT_SCAN_LIMIT:-25}"
HOST_BIND="0.0.0.0"
APK_SOURCE="${ROOT_DIR}/build/app/outputs/flutter-apk/app-debug.apk"
APK_NAME="lane-switch-survivor-debug.apk"
APK_TARGET="${SERVE_DIR}/${APK_NAME}"
INDEX_FILE="${SERVE_DIR}/index.html"

mkdir -p "${SERVE_DIR}"

port_is_free() {
  python3 - "$1" <<'PY'
import socket, sys
port = int(sys.argv[1])
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("0.0.0.0", port))
    except OSError:
        sys.exit(1)
sys.exit(0)
PY
}

server_responding() {
  python3 - "$1" <<'PY'
import sys, urllib.request
port = sys.argv[1]
url = f"http://127.0.0.1:{port}/"
try:
    with urllib.request.urlopen(url, timeout=1.5) as response:
        sys.exit(0 if response.status < 500 else 1)
except Exception:
    sys.exit(1)
PY
}

find_port() {
  local start_port="$1"
  local end_port=$((start_port + PORT_SCAN_LIMIT - 1))
  local port

  for ((port = start_port; port <= end_port; port++)); do
    if port_is_free "${port}"; then
      echo "${port}"
      return 0
    fi
  done

  echo "Couldn't find a free port between ${start_port} and ${end_port}." >&2
  exit 1
}

get_host_ip() {
  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}'
  fi
}

open_browser() {
  local url="$1"

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${url}" >/dev/null 2>&1 &
    return 0
  fi

  if command -v open >/dev/null 2>&1; then
    open "${url}" >/dev/null 2>&1 &
    return 0
  fi

  if command -v wslview >/dev/null 2>&1; then
    wslview "${url}" >/dev/null 2>&1 &
    return 0
  fi

  return 1
}

cleanup_stale_state() {
  if [[ -f "${PID_FILE}" ]]; then
    local old_pid
    old_pid="$(cat "${PID_FILE}")"
    if [[ -n "${old_pid}" ]] && kill -0 "${old_pid}" >/dev/null 2>&1; then
      return 0
    fi
  fi

  rm -f "${PID_FILE}" "${PORT_FILE}"
}

write_index() {
  local built_at="$1"
  cat >"${INDEX_FILE}" <<EOF
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Lane Switch Survivor Android debug build</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        max-width: 42rem;
        margin: 0 auto;
        padding: 2rem 1.25rem 4rem;
        line-height: 1.5;
        background: #0f172a;
        color: #e2e8f0;
      }
      a.button {
        display: inline-block;
        margin: 1rem 0;
        padding: 0.9rem 1.2rem;
        border-radius: 0.8rem;
        background: #22c55e;
        color: #052e16;
        text-decoration: none;
        font-weight: 700;
      }
      code {
        background: rgba(148, 163, 184, 0.15);
        padding: 0.15rem 0.35rem;
        border-radius: 0.35rem;
      }
      .card {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 1rem;
        padding: 1rem 1.1rem;
        margin-top: 1rem;
      }
      ul {
        padding-left: 1.2rem;
      }
    </style>
  </head>
  <body>
    <h1>Lane Switch Survivor, Android debug build</h1>
    <p>Latest build time: <strong>${built_at}</strong></p>
    <p><a class="button" href="./${APK_NAME}">Download APK</a></p>
    <div class="card">
      <strong>Install steps on Android</strong>
      <ul>
        <li>Open this page on the phone, on the same Wi-Fi as the dev machine.</li>
        <li>Tap <em>Download APK</em>.</li>
        <li>If Android blocks the install the first time, allow installs from the browser you used.</li>
        <li>Open the downloaded APK and install or update the app.</li>
      </ul>
    </div>
    <div class="card">
      <strong>File</strong><br>
      <code>${APK_NAME}</code>
    </div>
  </body>
</html>
EOF
}

cleanup_stale_state

echo "Building fresh debug APK..."
(
  cd "${ROOT_DIR}"
  flutter build apk --debug
)

if [[ ! -f "${APK_SOURCE}" ]]; then
  echo "Build finished, but ${APK_SOURCE} was not found." >&2
  exit 1
fi

cp "${APK_SOURCE}" "${APK_TARGET}"
BUILT_AT="$(date '+%Y-%m-%d %H:%M:%S %Z')"
write_index "${BUILT_AT}"

if [[ -f "${PID_FILE}" && -f "${PORT_FILE}" ]]; then
  EXISTING_PID="$(cat "${PID_FILE}")"
  EXISTING_PORT="$(cat "${PORT_FILE}")"

  if kill -0 "${EXISTING_PID}" >/dev/null 2>&1 && server_responding "${EXISTING_PORT}"; then
    PORT="${EXISTING_PORT}"
    REUSED_SERVER=1
  else
    rm -f "${PID_FILE}" "${PORT_FILE}"
    REUSED_SERVER=0
  fi
else
  REUSED_SERVER=0
fi

if [[ "${REUSED_SERVER}" -eq 0 ]]; then
  PORT="$(find_port "${DEFAULT_PORT}")"
  (
    cd "${SERVE_DIR}"
    exec python3 -m http.server "${PORT}" --bind "${HOST_BIND}"
  ) >"${LOG_FILE}" 2>&1 &
  SERVER_PID=$!
  echo "${SERVER_PID}" >"${PID_FILE}"
  echo "${PORT}" >"${PORT_FILE}"

  for _ in {1..20}; do
    if server_responding "${PORT}"; then
      break
    fi
    sleep 0.25
  done

  if ! server_responding "${PORT}"; then
    echo "Android share server failed to start. Check ${LOG_FILE}" >&2
    exit 1
  fi
fi

LOCAL_URL="http://localhost:${PORT}"
HOST_IP="$(get_host_ip || true)"
if [[ -n "${HOST_IP}" ]]; then
  PHONE_URL="http://${HOST_IP}:${PORT}"
else
  PHONE_URL="${LOCAL_URL}"
fi

if open_browser "${LOCAL_URL}"; then
  OPENED_BROWSER=1
else
  OPENED_BROWSER=0
fi

if [[ "${REUSED_SERVER}" -eq 1 ]]; then
  echo "Reusing existing Android share server on port ${PORT}."
else
  echo "Started Android share server on port ${PORT}."
fi

echo
echo "Open on this computer:"
echo "  ${LOCAL_URL}"
echo
echo "Open on Android on the same Wi-Fi:"
echo "  ${PHONE_URL}"
echo
echo "Direct APK link:"
echo "  ${PHONE_URL}/${APK_NAME}"
echo
echo "Server log:"
echo "  ${LOG_FILE}"

if [[ "${OPENED_BROWSER}" -eq 1 ]]; then
  echo
  echo "Opened the share page in your browser."
fi
