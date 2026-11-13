#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

OPEN_BROWSER=1

for arg in "$@"; do
  case "$arg" in
    --no-browser) OPEN_BROWSER=0 ;;
    -h|--help)
      echo "Usage: $0 [--no-browser]"
      exit 0
      ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 1 ;;
  esac
done

PORT=3000
URL="http://127.0.0.1:${PORT}"

if [ ! -f .env.local ]; then
  echo "Hinweis: .env.local fehlt – DEEPSEEK_API_KEY eintragen (siehe .env.example)." >&2
fi

if [ ! -d node_modules ]; then
  echo "Installiere Abhängigkeiten …"
  npm install
fi

if lsof -ti "tcp:${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${PORT} ist bereits belegt – bitte den belegenden Prozess beenden." >&2
  exit 1
fi

echo "Starte Rate Your Picture auf ${URL} …"
npm run dev -- --port "$PORT" &
SERVER_PID=$!
OPENER_PID=""

cleanup() {
  trap - INT TERM
  kill "$SERVER_PID" 2>/dev/null || true
  if [ -n "$OPENER_PID" ]; then
    kill "$OPENER_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Sobald der Dev-Server antwortet, den Browser öffnen.
if [ "$OPEN_BROWSER" -eq 1 ]; then
  (
    for _ in $(seq 1 60); do
      curl -fsS -m 2 "$URL" >/dev/null 2>&1 && break
      sleep 1
    done
    if command -v open >/dev/null 2>&1; then
      open "$URL" >/dev/null 2>&1 || true
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$URL" >/dev/null 2>&1 || true
    fi
  ) &
  OPENER_PID=$!
fi

wait "$SERVER_PID"
