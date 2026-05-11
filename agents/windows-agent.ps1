# Windows device agent — reports CPU, RAM, disk to the dashboard.
# Schedule with Task Scheduler every 30 seconds.
#
# Usage:
#   $env:AGENT_TOKEN = "<your-token>"
#   $env:DASHBOARD_HOST = "http://localhost:53117"  # optional
#   .\windows-agent.ps1

param(
    [string]$AgentToken = $env:AGENT_TOKEN,
    [string]$DashboardHost = ($env:DASHBOARD_HOST ?? "http://localhost:53117")
)

if (-not $AgentToken) {
    Write-Error "AGENT_TOKEN is required"
    exit 1
}

# CPU usage (average over 1 second)
$cpu = [math]::Round((Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average)

# RAM usage
$os = Get-CimInstance Win32_OperatingSystem
$ram = [math]::Round((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100)

# Disk usage for C:
$disk_info = Get-PSDrive C
$disk = [math]::Round(($disk_info.Used / ($disk_info.Used + $disk_info.Free)) * 100)

# Battery (if available)
$battery_json = ""
try {
    $battery = (Get-CimInstance Win32_Battery).EstimatedChargeRemaining
    if ($null -ne $battery) {
        $battery_json = ", `"battery`": $battery"
    }
} catch {}

$payload = "{`"cpu`": $cpu, `"ram`": $ram, `"disk`": $disk$battery_json}"

$headers = @{
    "Content-Type"  = "application/json"
    "X-Agent-Token" = $AgentToken
}

Invoke-RestMethod -Method POST -Uri "$DashboardHost/agent/report" -Headers $headers -Body $payload -ErrorAction SilentlyContinue | Out-Null
