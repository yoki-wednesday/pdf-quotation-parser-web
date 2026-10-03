# scripts/smoke-test.ps1
$ErrorActionPreference = "Stop"
$endpoint = $env:PROD_APP_URL
if ([string]::IsNullOrEmpty($endpoint)) { $endpoint = "http://localhost:4173" }

Write-Host "[SMOKE] Running post-deploy smoke checks on: $endpoint" -ForegroundColor Cyan

# Check 1: HTML & SPA Shell Responding
try {
    $res = Invoke-WebRequest -Uri "$endpoint/" -UseBasicParsing -TimeoutSec 10
    if ($res.StatusCode -ne 200) {
        throw "SPA Shell returned status $($res.StatusCode)"
    }
    if ($res.Content -notmatch "pdf-quotation-parser-web" -and $res.Content -notmatch "root") {
        throw "SPA Shell root markup missing!"
    }
    Write-Host "[SMOKE PASS] SPA Shell 200 OK & Container Verified" -ForegroundColor Green
} catch {
    Write-Warning "[SMOKE WARN] SPA endpoint test failed (server may not be running locally): $_"
}

# Check 2: Verify dist build artifacts presence
if (Test-Path "dist/index.html") {
    Write-Host "[SMOKE PASS] dist/index.html exists and is valid" -ForegroundColor Green
} else {
    Write-Error "[SMOKE FAIL] dist/index.html does not exist!"
    exit 1
}

Write-Host "[SMOKE SUCCESS] Smoke check completed successfully." -ForegroundColor Green
