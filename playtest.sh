#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${ROOT_DIR}/.playtest"
PID_FILE="${STATE_DIR}/server.pid"
PORT_FILE="${STATE_DIR}/server.port"
LOG_FILE="${STATE_DIR}/server.log"
DEFAULT_PORT="${PLAYTEST_PORT:-4173}"
PORT_SCAN_LIMIT="${PLAYTEST_PORT_SCAN_LIMIT:-25}"
HOST_BIND="0.0.0.0"

mkdir -p "${STATE_DIR}"

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

cleanup_stale_state

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
    cd "${ROOT_DIR}"
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
    echo "Playtest server failed to start. Check ${LOG_FILE}" >&2
    exit 1
  fi
fi

LOCAL_URL="http://localhost:${PORT}"
HOST_IP="$(get_host_ip || true)"

if open_browser "${LOCAL_URL}"; then
  OPENED_BROWSER=1
else
  OPENED_BROWSER=0
fi

if [[ "${REUSED_SERVER}" -eq 1 ]]; then
  echo "Reusing existing playtest server on port ${PORT}."
else
  echo "Started playtest server on port ${PORT}."
fi

echo
echo "Local playtest:"
echo "  ${LOCAL_URL}"

if [[ -n "${HOST_IP}" ]]; then
  echo
echo "Same Wi-Fi mobile playtest:"
  echo "  http://${HOST_IP}:${PORT}"
fi

echo
echo "Server log:"
echo "  ${LOG_FILE}"

if [[ "${OPENED_BROWSER}" -eq 1 ]]; then
  echo
echo "Opened the game in your browser."
else
  echo
echo "Couldn't auto-open a browser here, open this URL manually:"
  echo "  ${LOCAL_URL}"
fi
