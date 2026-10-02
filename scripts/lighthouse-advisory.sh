#!/usr/bin/env bash
# Advisory Lighthouse runner for CI.
# - Collects reports against Landing (/)
# - Runs assert with §8 budgets from lighthouserc.cjs
# - Emits GitHub Actions ::warning:: annotations on misses
# - Always exits 0 so the check stays green
set -u

CONFIG="${LHCI_CONFIG:-./lighthouserc.cjs}"
LHCI=(npx --yes @lhci/cli@0.14.0)

emit_warning() {
  # Escape newlines for workflow command safety
  local msg="${1//$'\n'/ }"
  msg="${msg//$'\r'/ }"
  echo "::warning title=Lighthouse advisory::${msg}"
}

echo "==> Lighthouse collect (Landing)"
set +e
COLLECT_LOG="$(mktemp)"
"${LHCI[@]}" collect --config="$CONFIG" >"$COLLECT_LOG" 2>&1
COLLECT_CODE=$?
set -e
cat "$COLLECT_LOG"

if [[ "$COLLECT_CODE" -ne 0 ]]; then
  emit_warning "Collect failed (exit ${COLLECT_CODE}). Budgets not evaluated; see logs/artifact. Job stays green by design."
  rm -f "$COLLECT_LOG"
  exit 0
fi

echo "==> Lighthouse assert (advisory — never fails the job)"
set +e
ASSERT_LOG="$(mktemp)"
"${LHCI[@]}" assert --config="$CONFIG" >"$ASSERT_LOG" 2>&1
ASSERT_CODE=$?
set -e
cat "$ASSERT_LOG"

# Surface interesting assert lines as annotations (cap to avoid spam)
MISS_COUNT=0
while IFS= read -r line; do
  # LHCI prints ✘ / failed / expected on budget misses
  if echo "$line" | grep -Eqi '✘|failed assertion|expected |Assertion failed|does not (meet|pass)'; then
    emit_warning "$line"
    MISS_COUNT=$((MISS_COUNT + 1))
    if [[ "$MISS_COUNT" -ge 25 ]]; then
      emit_warning "Additional budget misses truncated — see full assert log / artifact."
      break
    fi
  fi
done <"$ASSERT_LOG"

if [[ "$ASSERT_CODE" -ne 0 || "$MISS_COUNT" -gt 0 ]]; then
  emit_warning "Landing budget misses vs TECHNICAL_SPEC §8 (advisory). See .lighthouseci artifact. Check stays green."
else
  echo "All advisory budgets passed."
fi

rm -f "$COLLECT_LOG" "$ASSERT_LOG"
exit 0
