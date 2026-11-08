#!/usr/bin/env bash
# Post a CI test summary to Grafana. Skips quietly when unconfigured, so a
# repository without GRAFANA_URL/GRAFANA_TOKEN keeps a green build.
#
# Usage: ci-annotate.sh <results.json> <seconds> <suite> <tag>
#
# The results file is either Vitest's JSON reporter (numPassedTests /
# numFailedTests) or Playwright's (stats.expected, stats.flaky, stats.unexpected).
set -euo pipefail

results=${1:?usage: ci-annotate.sh <results.json> <seconds> <suite> <tag>}
seconds=${2:-}
suite=${3:-tests}
tag=${4:-api-tests}

if [ -z "${GRAFANA_URL:-}" ] ||
  { [ -z "${GRAFANA_TOKEN:-}" ] && [ -z "${GRAFANA_PASSWORD:-}" ]; }; then
  echo "GRAFANA_URL with GRAFANA_TOKEN or GRAFANA_PASSWORD is not configured; skipping the annotation."
  exit 0
fi

if [ ! -f "$results" ]; then
  echo "No test result file at $results; skipping the annotation."
  exit 0
fi

counts=$(node -e '
const results = require(process.argv[1]);
const passed =
  results.numPassedTests ?? (results.stats?.expected ?? 0) + (results.stats?.flaky ?? 0);
const failed = results.numFailedTests ?? (results.stats?.unexpected ?? 0);
process.stdout.write(`${passed} ${failed}`);
' "$results")

passed=${counts% *}
failed=${counts#* }

bash "$(dirname "$0")/record-test-run.sh" "$passed" "$failed" "$seconds" "$suite" "$tag"
