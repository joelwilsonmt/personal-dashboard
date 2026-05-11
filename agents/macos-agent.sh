#!/bin/bash
# macOS device agent — reports CPU, RAM, disk, battery to the dashboard.
# Schedule with launchd every 30 seconds.
#
# Usage:
#   AGENT_TOKEN=<your-token> DASHBOARD_HOST=http://localhost:53117 ./macos-agent.sh

DASHBOARD_HOST="${DASHBOARD_HOST:-http://localhost:53117}"
AGENT_TOKEN="${AGENT_TOKEN:-}"

if [ -z "$AGENT_TOKEN" ]; then
  echo "Error: AGENT_TOKEN is required" >&2
  exit 1
fi

# CPU usage (1-second sample)
cpu=$(top -l 1 -s 0 | awk '/CPU usage/ {print $3}' | tr -d '%')
if [ -z "$cpu" ]; then
  cpu=$(ps -A -o %cpu | awk '{s+=$1} END {printf "%.0f", s}')
fi

# RAM usage
ram=$(vm_stat | awk '
  /Pages active/ { active=$3 }
  /Pages wired/ { wired=$4 }
  /Pages occupied by compressor/ { compressed=$5 }
  /Pages free/ { free=$3 }
  END {
    used = active + wired + compressed
    total = used + free
    if (total > 0) printf "%.0f", (used / total) * 100
    else print 0
  }
' | tr -d '.')

# Disk usage for /
disk=$(df -l / | tail -1 | awk '{print $5}' | tr -d '%')

# Battery (if available)
battery_json=""
battery=$(pmset -g batt 2>/dev/null | grep -Eo '[0-9]+%' | head -1 | tr -d '%')
if [ -n "$battery" ]; then
  battery_json=", \"battery\": $battery"
fi

payload="{\"cpu\": ${cpu:-0}, \"ram\": ${ram:-0}, \"disk\": ${disk:-0}${battery_json}}"

curl -s -X POST "$DASHBOARD_HOST/agent/report" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Token: $AGENT_TOKEN" \
  -d "$payload" \
  > /dev/null || echo "agent: curl failed (exit $?)" >&2
