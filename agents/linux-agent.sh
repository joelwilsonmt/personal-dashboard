#!/bin/bash
# Linux device agent — reports CPU, RAM, disk to the dashboard.
# Schedule with systemd timer or cron every 30 seconds.
#
# Example cron (every minute as closest interval):
#   * * * * * AGENT_TOKEN=<token> /path/to/linux-agent.sh
#
# Example systemd service + timer: see README for unit file templates.

DASHBOARD_HOST="${DASHBOARD_HOST:-http://localhost:53117}"
AGENT_TOKEN="${AGENT_TOKEN:-}"

if [ -z "$AGENT_TOKEN" ]; then
  echo "Error: AGENT_TOKEN is required" >&2
  exit 1
fi

# CPU usage (1-second average via /proc/stat)
read -r cpu_line < /proc/stat
set -- $cpu_line
idle1=$5; total1=$(( $2 + $3 + $4 + $5 + $6 + $7 + $8 ))
sleep 1
read -r cpu_line < /proc/stat
set -- $cpu_line
idle2=$5; total2=$(( $2 + $3 + $4 + $5 + $6 + $7 + $8 ))
cpu=$(( 100 * (total2 - total1 - (idle2 - idle1)) / (total2 - total1) ))

# RAM usage
ram=$(free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}')

# Disk usage for /
disk=$(df -l / | tail -1 | awk '{print $5}' | tr -d '%')

payload="{\"cpu\": ${cpu:-0}, \"ram\": ${ram:-0}, \"disk\": ${disk:-0}}"

curl -s -X POST "$DASHBOARD_HOST/agent/report" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Token: $AGENT_TOKEN" \
  -d "$payload" \
  > /dev/null
