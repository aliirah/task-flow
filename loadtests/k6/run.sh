#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <k6-script> [extra k6 args...]" >&2
  exit 1
fi

SCRIPT_NAME=$1
shift
SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_NAME"
if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "k6 script '$SCRIPT_NAME' not found under $SCRIPT_DIR" >&2
  exit 1
fi

if command -v k6 >/dev/null 2>&1; then
  echo "[k6-runner] Using local k6 binary"
  (cd "$SCRIPT_DIR" && k6 run "$SCRIPT_NAME" "$@")
  exit 0
fi

IMAGE=${K6_DOCKER_IMAGE:-grafana/k6:0.47.0}
UNAME=$(uname -s)
if [[ -z "${BASE_URL:-}" ]]; then
  if [[ "$UNAME" == "Darwin" ]]; then
    export BASE_URL=${K6_BASE_URL_FALLBACK:-http://host.docker.internal:8081}
  else
    export BASE_URL=${K6_BASE_URL_FALLBACK:-http://localhost:8081}
  fi
fi
if [[ -z "${WS_URL:-}" ]]; then
  HOST_PART=""
  if [[ "$BASE_URL" == http://* ]]; then
    HOST_PART=${BASE_URL#http://}
    HOST_PART=${HOST_PART%%/*}
    DEFAULT_WS="ws://$HOST_PART/api/ws"
  elif [[ "$BASE_URL" == https://* ]]; then
    HOST_PART=${BASE_URL#https://}
    HOST_PART=${HOST_PART%%/*}
    DEFAULT_WS="wss://$HOST_PART/api/ws"
  else
    DEFAULT_WS="ws://host.docker.internal:8081/api/ws"
  fi
  export WS_URL=$DEFAULT_WS
fi

TMP_ENV=$(mktemp)
trap 'rm -f "$TMP_ENV"' EXIT
env >"$TMP_ENV"

echo "[k6-runner] Local k6 not found, using container $IMAGE"
DOCKER_CMD=(docker run --rm)
if [[ "$UNAME" != "Darwin" ]]; then
  DOCKER_CMD+=(--network host)
fi
"${DOCKER_CMD[@]}" \
  --env-file "$TMP_ENV" \
  -v "$SCRIPT_DIR":/scripts \
  -w /scripts \
  "$IMAGE" run "$SCRIPT_NAME" "$@"
