#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  The Stagwell.AI demo kit's acceptance suite, in one command.
#
#    ./tests/run-all.sh              run everything against http://localhost:8199
#    BRIDGE_URL=http://host:port ./tests/run-all.sh
#    ./tests/run-all.sh journeys     run one file (journeys | diagnostics | contract)
#
#  Prerequisite: a static server for the repo root that also answers
#  POST /api/ask. See tests/README.md — the suite itself emulates the two
#  vercel.json rewrites ("/" and "/p/:campaign") with page.route, so a plain
#  static server is enough.
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_URL="${BRIDGE_URL:-http://localhost:8199}"
NODE_BIN="${NODE_BIN:-node}"
export BRIDGE_URL

echo "═══════════════════════════════════════════════════════════════════════"
echo " Stagwell.AI · acceptance suite"
echo "   bridge      : $BRIDGE_URL"
echo "   node        : $($NODE_BIN -v 2>/dev/null || echo 'NOT FOUND')"
echo "   artifacts   : $HERE/artifacts  (gitignored)"
echo "═══════════════════════════════════════════════════════════════════════"

# ── prerequisite check: the bridge must be serving the repo ───────────────
if ! curl -sfo /dev/null "$BRIDGE_URL/machine/b.html"; then
  echo
  echo "FATAL: $BRIDGE_URL is not serving the repo."
  echo "       Expected $BRIDGE_URL/machine/b.html to return 200."
  echo "       Start a static server on the repo root (and proxy POST /api/ask"
  echo "       to the deployed function for live research). See tests/README.md."
  exit 2
fi
echo "  bridge serving the repo      : ok"

# Advisory only — the suite passes whether research goes live or falls back.
# Two tries, because one slow or dropped upstream call is not a verdict.
ASK_LIVE=no
for _ in 1 2; do
  if curl -sf -m 30 -X POST "$BRIDGE_URL/api/ask" -H 'Content-Type: application/json' \
       --data '{"mode":"classify","prompt":"reach better audiences"}' 2>/dev/null | grep -q '"ok":true'; then
    ASK_LIVE=yes; break
  fi
done
if [ "$ASK_LIVE" = yes ]; then
  echo "  /api/ask probe               : answering  (research will run LIVE)"
else
  echo "  /api/ask probe               : no answer  (research will likely fall back"
  echo "                                  to seeded fiction — the suite passes either"
  echo "                                  way; each case reports the mode it got)"
fi
echo

FILES=("journeys.js" "diagnostics-name-free.js" "json-contract.js")
if [ "$#" -gt 0 ]; then
  case "$1" in
    journeys)    FILES=("journeys.js") ;;
    diagnostics) FILES=("diagnostics-name-free.js") ;;
    contract)    FILES=("json-contract.js") ;;
    *)           FILES=("$1") ;;
  esac
fi

FAILED=()
for f in "${FILES[@]}"; do
  "$NODE_BIN" "$HERE/$f"
  if [ $? -ne 0 ]; then FAILED+=("$f"); fi
done

echo
echo "═══════════════════════════════════════════════════════════════════════"
if [ ${#FAILED[@]} -eq 0 ]; then
  echo " ALL GREEN — ${#FILES[@]} file(s) passed"
  echo "═══════════════════════════════════════════════════════════════════════"
  exit 0
fi
echo " FAILED: ${FAILED[*]}"
echo " Screenshots of the failing step are in $HERE/artifacts/"
echo "═══════════════════════════════════════════════════════════════════════"
exit 1
