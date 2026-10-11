[CmdletBinding()]
param(
  [string]$Domain = 'example.invalid'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$statusUrl = "https://$Domain/buyunlu-api/pay/status"
$healthUrl = "https://$Domain/buyunlu-api/health"

function Pass([string]$Text) { Write-Host "[PASS] $Text" -ForegroundColor Green }
function Manual([string]$Text) { Write-Host "[MANUAL] $Text" -ForegroundColor Yellow }
function Fail([string]$Text) { throw "[FAIL] $Text" }

Write-Host 'Buyunlu virtual-payment release verification' -ForegroundColor Cyan

Push-Location $projectRoot
try {
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { Fail 'Local test suite failed' }
  Pass 'Local source and regression tests'
}
finally { Pop-Location }

try {
  $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 15
} catch { Fail "Health endpoint is unavailable: $($_.Exception.Message)" }
if (-not $health.ok) { Fail 'Health endpoint did not return ok=true' }
Pass 'HTTPS backend health endpoint'

try {
  $status = Invoke-RestMethod -Uri $statusUrl -Method Get -TimeoutSec 15
} catch { Fail "Payment endpoint is unavailable. Deploy the payment build first: $($_.Exception.Message)" }
if (-not $status.ok -or -not $status.enabled) { Fail "Payment is disabled. Missing: $($status.missing -join ', ')" }
if ([int]$status.env -ne 0) { Fail "Production env must be 0, actual: $($status.env)" }
if ([string]::IsNullOrWhiteSpace([string]$status.productId)) { Fail 'Product ID is empty' }
if ([int]$status.goodsPrice -le 0 -or [int]$status.cardsPerUnit -le 0) { Fail 'Price or card quantity is invalid' }
Pass "Production payment route (env 0, product $($status.productId), $($status.goodsPrice) cents, $($status.cardsPerUnit) cards)"

$project = Get-Content (Join-Path $projectRoot 'project.config.json') -Raw | ConvertFrom-Json
if ($project.appid -ne '') { Fail "Unexpected AppID: $($project.appid)" }
Pass 'Mini Program AppID '

Write-Host ''
Manual 'Confirm personal subject, mainland ID, Tools category, certification and ICP filing in MP console.'
Manual 'Confirm virtual payment is activated, the product is published, and its ID/price match the PASS line.'
Manual 'Confirm message push URL and Token are saved, using XML and plaintext mode.'
Manual 'On a real device complete one small purchase: payment -> notify -> delivery -> balance, then reconcile the backend order.'
Manual 'If supporting iOS, confirm mini-program short name and Apple IAP are enabled; test WeChat 8.0.68 or later.'
Write-Host ''
Write-Host 'Automated checks passed. Manual/platform checks above are still required before release.' -ForegroundColor Cyan
