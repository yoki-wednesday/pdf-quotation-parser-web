$url = "http://localhost:5173"
$ready = $false

for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $conn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $ready = $true
        break
    }
}

if ($ready) {
    $edgePaths = @(
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    )
    $chromePaths = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )

    foreach ($path in $edgePaths) {
        if (Test-Path $path) {
            Start-Process $path -ArgumentList "--app=$url"
            exit
        }
    }

    foreach ($path in $chromePaths) {
        if (Test-Path $path) {
            Start-Process $path -ArgumentList "--app=$url"
            exit
        }
    }

    Start-Process $url
}