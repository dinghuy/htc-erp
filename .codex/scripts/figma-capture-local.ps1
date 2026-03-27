$ErrorActionPreference = "Stop"

$captureId = "79db4543-81b5-4aca-88aa-986bacd54ec2"
$frontendDir = "C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend"
$viteScript = '"' + (Join-Path $frontendDir "node_modules\vite\bin\vite.js") + '"'
$endpoint = "https://mcp.figma.com/mcp/capture/$captureId/submit"
$url = "http://127.0.0.1:4173/#figmacapture=$captureId&figmaendpoint=$([uri]::EscapeDataString($endpoint))&figmadelay=1000"

Start-Process -FilePath "C:\Program Files\nodejs\node.exe" `
  -WorkingDirectory $frontendDir `
  -ArgumentList @($viteScript, "--host", "127.0.0.1", "--port", "4173", "--configLoader", "native")

Start-Sleep -Seconds 4
Start-Process $url
Start-Sleep -Seconds 60
Write-Output "CAPTURE_TRIGGERED"
