#!/usr/bin/env bash
# Read-only UI and read-path stress for the Nexora client.
# Drives tab switches, list flings, dashboard refreshes and invalid scans
# (the scan endpoint answers 404, nothing is written). Coordinates assume a
# 1600x900 emulator; override with the environment variables below.
#
# Usage:
#   ADB="/c/Program Files (x86)/Nox/bin/nox_adb.exe" \
#   SERIAL=127.0.0.1:62001 ./tool/perf_stress.sh
#
# The app must already be installed, signed in, and showing Home.
# Measure frames with a build made with --dart-define=PERF_LOG=true and read
# the `[perf]` lines from `adb logcat -d`.

ADB=${ADB:-adb}
SERIAL=${SERIAL:-}
NAV_Y=${NAV_Y:-770}
HOME_X=${HOME_X:-160}
INV_X=${INV_X:-480}
SCAN_X=${SCAN_X:-800}
SELL_X=${SELL_X:-1120}
MORE_X=${MORE_X:-1440}

adbd() {
  if [[ -n "$SERIAL" ]]; then
    "$ADB" -s "$SERIAL" "$@"
  else
    "$ADB" "$@"
  fi
}

tap() {
  adbd shell input tap "$1" "$2" >/dev/null
  sleep "${3:-0.4}"
}

swipe() {
  adbd shell input swipe "$1" "$2" "$3" "$4" "${5:-300}" >/dev/null
  sleep "${6:-0.5}"
}

meminfo() {
  adbd shell dumpsys meminfo tn.nexora.app.dev 2>/dev/null |
    grep -E "TOTAL:" | head -1
}

mark() {
  adbd shell log -t NEXORA_PERF "$1" >/dev/null 2>&1 || true
  echo "== $1 =="
}

mark "stress start"
echo "memory before: $(meminfo)"

mark "tab switching (15 switches)"
for _ in 1 2 3; do
  tap "$HOME_X" "$NAV_Y" 0.35
  tap "$INV_X" "$NAV_Y" 0.35
  tap "$SCAN_X" "$NAV_Y" 0.35
  tap "$SELL_X" "$NAV_Y" 0.35
  tap "$MORE_X" "$NAV_Y" 0.35
done

mark "inventory flings"
tap "$INV_X" "$NAV_Y" 1.2
for _ in 1 2 3 4 5 6; do
  swipe 800 700 800 250 200 0.4
done
for _ in 1 2 3; do
  swipe 800 300 800 750 200 0.4
done

mark "counter sale screen"
tap "$SELL_X" "$NAV_Y" 1.2
swipe 800 650 800 300 250 0.5
swipe 800 300 800 650 250 0.5

mark "home refreshes (6 pull-to-refresh)"
tap "$HOME_X" "$NAV_Y" 1.2
for _ in 1 2 3 4 5 6; do
  swipe 800 180 800 720 400 1.6
done

mark "scan burst (8 invalid codes, read-only)"
tap "$SCAN_X" "$NAV_Y" 1.2
swipe 800 620 800 320 300 0.8
tap 650 540 0.8
for i in 1 2 3 4 5 6 7 8; do
  adbd shell input text "STRESS-CODE-$i" >/dev/null
  sleep 0.2
  adbd shell input keyevent 66 >/dev/null
  sleep 2
  # Move to the end of the field and delete what is there for the next code.
  adbd shell input keyevent 123 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 >/dev/null
  sleep 0.2
done

# No Back press here: with the keyboard already dismissed it would leave the
# app and send the following taps to the launcher.
tap "$HOME_X" "$NAV_Y" 1.5

echo "memory after: $(meminfo)"
mark "stress done"
