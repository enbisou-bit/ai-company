# dev-check.ps1 - Node stop / start / API check
# Stop only the server node (port 3000), not npm itself
param()

$base = "http://localhost:3000"

Write-Host "--- ENBISOU dev-check ---"

$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
}
Write-Host "[1] server stopped"

$dir = (Get-Location).Path
Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $dir -WindowStyle Hidden -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Write-Host "[2] node started"

$r1 = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
Write-Host "[localhost:3000] $($r1.StatusCode)"

$r2 = Invoke-WebRequest -Uri "$base/api/task-history" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
Write-Host "[task-history] $($r2.StatusCode)"

$r3 = Invoke-WebRequest -Uri "$base/api/workflow-dashboard" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
Write-Host "[workflow-dashboard] $($r3.StatusCode)"

Write-Host "--- done ---"
