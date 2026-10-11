[CmdletBinding()]
param(
  [string]$HostAddress = '192.0.2.1',
  [string]$User = 'root',
  [int]$Port = 22,
  [string]$StatusUrl = 'https://example.invalid/buyunlu-api/pay/status'
)

$ErrorActionPreference = 'Stop'

# ASCII only: PowerShell 5.1 reads a BOM-less .ps1 as ANSI/GBK.
#
# Transport: the remote script is a SINGLE LINE sent through stdin to 'bash -s',
# never as an ssh argv. Two production failures forced this:
#   1) PowerShell 5.1 does not escape embedded double quotes when building a
#      native command line, so a long command passed as an argv arrived at sshd
#      mangled / effectively empty. The run then printed only the MOTD, ssh
#      exited 0, and this script falsely reported success while nothing on the
#      server changed.
#   2) PowerShell pipes to native commands end with CRLF, which is what made
#      'base64 -d' reject a piped payload. Embedding the payload inside the
#      script (printf '%s' '<b64>') removes stdin from the equation entirely.
# The line deliberately ends with a comment so the trailing CR is swallowed.

function Read-PlainSecret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Require-SingleLine([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { throw "$Name cannot be empty" }
  if ($Value -match "[`r`n]") { throw "$Name must be a single line" }
  return $Value.Trim()
}

if (-not (Get-Command ssh.exe -ErrorAction SilentlyContinue)) {
  throw 'OpenSSH ssh.exe was not found; install Windows OpenSSH Client'
}

Write-Host 'Configure Buyunlu virtual payment (production)' -ForegroundColor Cyan
Write-Host 'Secrets are hidden while typing and travel only through the SSH connection.' -ForegroundColor DarkGray

$appSecret = Require-SingleLine 'AppSecret' (Read-PlainSecret 'Mini Program AppSecret')
$offerId = Require-SingleLine 'OfferID' (Read-Host 'Virtual Payment OfferID')
$appKey = Require-SingleLine 'AppKey' (Read-PlainSecret 'Virtual Payment production AppKey')
$productId = Require-SingleLine 'Product ID' (Read-Host 'Published item Product ID')
$priceInput = Read-Host 'Item price in cents [100]'
$cardsInput = Read-Host 'Ad-free cards per purchase [10]'
$goodsPrice = if ([string]::IsNullOrWhiteSpace($priceInput)) { 100 } else { [int]$priceInput }
$cardsPerUnit = if ([string]::IsNullOrWhiteSpace($cardsInput)) { 10 } else { [int]$cardsInput }
if ($goodsPrice -le 0 -or $cardsPerUnit -le 0) { throw 'Price and card quantity must be positive integers' }

function New-HexToken([int]$ByteCount = 32) {
  $bytes = New-Object byte[] $ByteCount
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

$adminToken = New-HexToken 32
$messageToken = New-HexToken 16

$lines = @(
  'WX_APPID='
  "WX_APPSECRET=$appSecret"
  "WX_XPAY_OFFER_ID=$offerId"
  "WX_XPAY_APP_KEY=$appKey"
  "WX_XPAY_PRODUCT_ID=$productId"
  "WX_XPAY_GOODS_PRICE=$goodsPrice"
  "WX_XPAY_CARDS_PER_UNIT=$cardsPerUnit"
  'WX_XPAY_ENV=0'
  "WX_MESSAGE_TOKEN=$messageToken"
  "WX_PAY_ADMIN_TOKEN=$adminToken"
)
$payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($lines -join "`n") + "`n"))

# Single line, single quotes only, payload embedded, trailing comment eats the CR.
$remoteScript = "test -f /opt/buyunlu-leaderboard/virtual-pay.js || { echo PAYMENT_MODULE_MISSING_RUN_DEPLOY_SERVER >&2; exit 9; }; install -d -m 0700 /etc/buyunlu; printf '%s' '$payload' | base64 -d --ignore-garbage > /etc/buyunlu/pay.env.tmp || { echo DECODE_FAILED >&2; exit 11; }; grep -q '^WX_XPAY_APP_KEY=' /etc/buyunlu/pay.env.tmp || { echo DECODE_EMPTY_ABORTED >&2; rm -f /etc/buyunlu/pay.env.tmp; exit 11; }; grep -q '^WX_APPSECRET=' /etc/buyunlu/pay.env.tmp || { echo DECODE_EMPTY_ABORTED >&2; rm -f /etc/buyunlu/pay.env.tmp; exit 11; }; chmod 0600 /etc/buyunlu/pay.env.tmp; mv /etc/buyunlu/pay.env.tmp /etc/buyunlu/pay.env; echo PAY_ENV_LINES: `$(wc -l < /etc/buyunlu/pay.env); echo PAY_ENV_COMMENT_LINES: `$(grep -c '^#' /etc/buyunlu/pay.env || true); systemctl daemon-reload; systemctl restart buyunlu-leaderboard.service; sleep 4; NEWPID=`$(systemctl show -p MainPID buyunlu-leaderboard.service | cut -d= -f2); echo NEW_PID: `$NEWPID; echo STARTED_AT: `$(systemctl show -p ExecMainStartTimestamp buyunlu-leaderboard.service | cut -d= -f2-); WXC=`$(tr '\0' '\n' < /proc/`$NEWPID/environ 2>/dev/null | grep -c '^WX_' || true); echo WX_VAR_COUNT: `${WXC:-0}; if [ `${WXC:-0} -lt 6 ]; then echo WX_VARS_STILL_MISSING >&2; exit 12; fi; PAY_PORT=`$(systemctl show -p Environment buyunlu-leaderboard.service | grep -o 'PORT=[0-9]*' | head -1 | cut -d= -f2); echo LOCAL_STATUS: `$(curl -fsS --max-time 5 http://127.0.0.1:`$PAY_PORT/api/pay/status || echo CURL_FAILED); exit 0 #"

$target = "$User@$HostAddress"
$notifyUrl = 'https://example.invalid/buyunlu-api/pay/notify'
$installed = $false
try {
  Write-Host "Connecting to $target (enter the SSH password)..." -ForegroundColor Cyan
  $remoteScript | & ssh.exe -T -p $Port $target 'bash -s'
  $exit = $LASTEXITCODE
  if ($exit -eq 0) {
    $installed = $true
    Write-Host 'Payment configuration installed and verified on the server.' -ForegroundColor Green
  } elseif ($exit -eq 12) {
    $installed = $true
    Write-Host 'pay.env was written and the service restarted, but the process still has no WX_ variables.' -ForegroundColor Yellow
    Write-Host 'Look at PAY_ENV_LINES / PAY_ENV_COMMENT_LINES / WX_VAR_COUNT in the output above.' -ForegroundColor Yellow
  } else {
    throw "Payment configuration failed, exit code $exit"
  }
}
finally {
  if ($installed) {
    Write-Host "Message push URL:   $notifyUrl" -ForegroundColor Yellow
    Write-Host "Message push Token: $messageToken" -ForegroundColor Yellow
    Write-Host 'Set message format to XML and data format to plaintext in the Mini Program console.' -ForegroundColor Yellow
  }
  $appSecret = $null
  $appKey = $payload = $messageToken = $null
  $adminToken = $null
}

if ($installed) {
  Write-Host ''
  Write-Host "Public check: $StatusUrl" -ForegroundColor Cyan
  try {
    $status = Invoke-RestMethod -Uri $StatusUrl -Method Get -TimeoutSec 20
    if ($status.enabled) {
      Write-Host ('enabled=true  product={0}  price={1}  cards={2}' -f $status.productId, $status.goodsPrice, $status.cardsPerUnit) -ForegroundColor Green
    } else {
      Write-Host ('enabled=false  missing={0}' -f ($status.missing -join ',')) -ForegroundColor Red
    }
  } catch {
    Write-Host "Public check failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}
