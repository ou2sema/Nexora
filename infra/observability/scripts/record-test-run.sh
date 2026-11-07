#!/usr/bin/env bash
# Record a test run as an annotation on the Nexora API dashboard.
#
# Usage:
#   GRAFANA_PASSWORD=<admin password> ./record-test-run.sh <passed> <failed> [seconds] [suite]
#
# Example:
#   GRAFANA_PASSWORD=... ./record-test-run.sh 352 0 119 api
#
# In CI, set GRAFANA_URL and use a Grafana service-account token:
#   GRAFANA_TOKEN=<token> ./record-test-run.sh 352 0 119 api
set -euo pipefail

passed=${1:?usage: record-test-run.sh <passed> <failed> [seconds] [suite]}
failed=${2:?usage: record-test-run.sh <passed> <failed> [seconds] [suite]}
seconds=${3:-}
suite=${4:-api}

url=${GRAFANA_URL:-http://localhost:3001}
time_ms=$(($(date +%s) * 1000))

status=passed
if [ "$failed" -gt 0 ]; then
  status=failed
fi

text="$suite tests: $passed passed, $failed failed"
if [ -n "$seconds" ]; then
  text="$text in ${seconds}s"
fi

if [ -n "${GRAFANA_TOKEN:-}" ]; then
  auth=(-H "Authorization: Bearer $GRAFANA_TOKEN")
else
  : "${GRAFANA_PASSWORD:?Set GRAFANA_PASSWORD or GRAFANA_TOKEN}"
  auth=(-u "${GRAFANA_USER:-admin}:$GRAFANA_PASSWORD")
fi

curl -fsS "${auth[@]}" \
  -H 'content-type: application/json' \
  -X POST "$url/api/annotations" \
  -d "{\"text\":\"$text\",\"tags\":[\"api-tests\",\"$status\"],\"time\":$time_ms}"
echo
