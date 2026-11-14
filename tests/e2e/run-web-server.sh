#!/usr/bin/env bash
set -euo pipefail

PORT_VALUE=${PORT:-4173}
DATA_ROOT=${FINALFOLIO_DATA_ROOT:?FINALFOLIO_DATA_ROOT is required}

node tests/e2e/prepare.mjs
PORT="$PORT_VALUE" FINALFOLIO_DATA_ROOT="$DATA_ROOT" node tests/e2e/start-server.mjs > /tmp/finalfolio-playwright-server.log 2>&1 &
server_pid=$!

cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${PORT_VALUE}/" >/dev/null; then
    wait "$server_pid"
    exit $?
  fi
  sleep 1
done

echo "Playwright web server did not become ready on port ${PORT_VALUE}." >&2
exit 1
