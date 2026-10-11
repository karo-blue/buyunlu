[CmdletBinding()]
param(
  [string]$HostAddress = '192.0.2.1',
  [string]$Domain = 'example.invalid',
  [string]$User = 'root',
  [int]$Port = 22,
  [switch]$SkipSsl,
  [switch]$ConfigurePayment
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $projectRoot 'server'
$remoteDir = '/opt/buyunlu-leaderboard'
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$archive = Join-Path ([System.IO.Path]::GetTempPath()) "buyunlu-server-$stamp.tgz"
$remoteArchive = "/tmp/buyunlu-server-$stamp.tgz"
$stagingDir = $null

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

function New-HexToken([int]$ByteCount) {
  $bytes = New-Object byte[] $ByteCount
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

if (-not $User) { throw 'SSH username is required' }
if ($User -notmatch '^[A-Za-z0-9_.-]+$') { throw 'SSH username contains unsupported characters' }
if ($HostAddress -notmatch '^[A-Za-z0-9.:-]+$') { throw 'Server address contains unsupported characters' }
if ($Domain -notmatch '^[A-Za-z0-9.-]+$') { throw 'Domain contains unsupported characters' }
if (-not (Get-Command ssh.exe -ErrorAction SilentlyContinue)) { throw 'OpenSSH ssh.exe was not found; install Windows OpenSSH Client' }
if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) { throw 'tar.exe was not found; install the Windows 10/11 tar tool' }
if (-not (Test-Path (Join-Path $serverDir 'app.js'))) { throw "Server directory not found: $serverDir" }

Write-Host "Packaging server..." -ForegroundColor Cyan
# 显式列文件是为了可读；新增模块时**必须**一起加进来，否则远端 app.js 会在
# require 时找不到文件、整个服务起不来（不只是新功能失效）。
# tests/server.test.js 会核对 app.js 里每个 require('./x') 都在下面这张表里。
$serverFiles = @('app.js', 'virtual-pay.js', 'package.json', 'README.md', 'deploy-remote.sh')
foreach ($name in $serverFiles) {
  if (-not (Test-Path (Join-Path $serverDir $name))) { throw "Missing file in package list: $name" }
}

$packRoot = $serverDir
if ($ConfigurePayment) {
  Write-Host 'Collecting virtual-payment settings (secrets stay hidden)...' -ForegroundColor Cyan
  $appSecret = Require-SingleLine 'AppSecret' (Read-PlainSecret 'Mini Program AppSecret')
  $offerId = Require-SingleLine 'OfferID' (Read-Host 'Virtual Payment OfferID')
  $appKey = Require-SingleLine 'AppKey' (Read-PlainSecret 'Virtual Payment production AppKey')
  $productId = Require-SingleLine 'Product ID' (Read-Host 'Published item Product ID')
  $priceInput = Read-Host 'Item price in cents [100]'
  $cardsInput = Read-Host 'Ad-free cards per purchase [10]'
  $goodsPrice = if ([string]::IsNullOrWhiteSpace($priceInput)) { 100 } else { [int]$priceInput }
  $cardsPerUnit = if ([string]::IsNullOrWhiteSpace($cardsInput)) { 10 } else { [int]$cardsInput }
  if ($goodsPrice -le 0 -or $cardsPerUnit -le 0) { throw 'Price and card quantity must be positive integers' }
  $messageToken = New-HexToken 16
  $adminToken = New-HexToken 32
  $stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) "buyunlu-stage-$([guid]::NewGuid().ToString('N'))"
  [void](New-Item -ItemType Directory -Path $stagingDir)
  foreach ($name in $serverFiles) { Copy-Item -LiteralPath (Join-Path $serverDir $name) -Destination (Join-Path $stagingDir $name) }
  [IO.File]::WriteAllLines((Join-Path $stagingDir '.pay.env'), @(
    'WX_APPID=', "WX_APPSECRET=$appSecret", "WX_XPAY_OFFER_ID=$offerId",
    "WX_XPAY_APP_KEY=$appKey", "WX_XPAY_PRODUCT_ID=$productId", "WX_XPAY_GOODS_PRICE=$goodsPrice",
    "WX_XPAY_CARDS_PER_UNIT=$cardsPerUnit", 'WX_XPAY_ENV=0', "WX_MESSAGE_TOKEN=$messageToken",
    "WX_PAY_ADMIN_TOKEN=$adminToken"
  ), [Text.UTF8Encoding]::new($false))
  $packRoot = $stagingDir
  $serverFiles += '.pay.env'
}

$tarArgs = @('-czf', $archive, '-C', $packRoot, '--') + @($serverFiles)
& tar.exe @tarArgs
if ($LASTEXITCODE -ne 0) { throw 'Failed to create the deployment archive' }
$archiveEntries = @(& tar.exe -tzf $archive)
if ($LASTEXITCODE -ne 0 -or -not ($archiveEntries -contains 'deploy-remote.sh')) {
  Write-Host 'Created archive entries:' -ForegroundColor Yellow
  $archiveEntries | ForEach-Object { Write-Host $_ }
  throw 'Deployment archive is missing deploy-remote.sh; packaging stopped before SSH'
}
if ($ConfigurePayment -and -not ($archiveEntries -contains '.pay.env')) {
  Write-Host 'Created archive entries:' -ForegroundColor Yellow
  $archiveEntries | ForEach-Object { Write-Host $_ }
  throw 'Payment deployment archive is missing .pay.env; packaging stopped before SSH'
}
try {
  $target = "$User@$HostAddress"
  Write-Host "Connecting to $target (enter the SSH password once; it is not saved)..." -ForegroundColor Cyan
  $payload = [Convert]::ToBase64String([IO.File]::ReadAllBytes($archive))
  $rootRunner = if ($SkipSsl) { 'SKIP_SSL=1 bash' } else { 'bash' }
  $sudoRunner = if ($SkipSsl) { 'sudo env SKIP_SSL=1 bash' } else { 'sudo bash' }
  $statusUrl = if ($SkipSsl) { "http://$Domain/buyunlu-api/pay/status" } else { "https://$Domain/buyunlu-api/pay/status" }
  $healthUrl = if ($SkipSsl) { "http://$Domain/buyunlu-api/health" } else { "https://$Domain/buyunlu-api/health" }
  $remoteStage = "/tmp/buyunlu-deploy-$stamp"
  $remoteScript = "$remoteStage/deploy-remote.sh --archive=$remoteArchive --domain=$Domain --remote-dir=$remoteDir --port=18787"
  # 支付安装的末尾不再靠 curl 决定成败：公网校验由本脚本下面用 Invoke-RestMethod 做，
  # 这里 curl 失败也不该把已经写好的 pay.env 判成没装。
  $paymentInstall = if ($ConfigurePayment) { "; if [ `$(id -u) -eq 0 ]; then install -d -m 0700 /etc/buyunlu && install -m 0600 $remoteStage/.pay.env /etc/buyunlu/pay.env && rm -f $remoteDir/.pay.env && systemctl restart buyunlu-leaderboard.service; else sudo install -d -m 0700 /etc/buyunlu && sudo install -m 0600 $remoteStage/.pay.env /etc/buyunlu/pay.env && sudo rm -f $remoteDir/.pay.env && sudo systemctl restart buyunlu-leaderboard.service; fi; curl -fsS $statusUrl || true" } else { '' }
  # 关键：deploy-remote.sh 的退出码必须先收进 DEPLOY_RC，再跑支付安装。
  # 原来直接 `fi$paymentInstall`，而 $remoteCommand 开头有 set -e —— 部署脚本一旦
  # 以 10（本机 HTTPS 探活 502）退出，shell 立即终止，pay.env 永远装不上。
  # BaoTa 多 HTTPS server block 时这个探活经常误报（外网实测是通的），
  # 所以改成"先装支付、再用原退出码退出"，由本脚本按公网校验结果定成败。
  $remoteCommand = "set -e; trap 'rm -rf $remoteStage; rm -f $remoteArchive' EXIT; mkdir -p $remoteStage; if ! base64 -d --ignore-garbage > $remoteArchive; then echo 'deployment archive upload failed' >&2; exit 6; fi; if ! tar -xzf $remoteArchive -C $remoteStage; then echo 'deployment archive extraction failed' >&2; tar -tzf $remoteArchive >&2 || true; exit 11; fi; if [ ! -s $remoteStage/deploy-remote.sh ]; then tar -xOf $remoteArchive deploy-remote.sh > $remoteStage/deploy-remote.sh 2>/dev/null || true; fi; if [ ! -s $remoteStage/deploy-remote.sh ]; then find $remoteStage -type f -name deploy-remote.sh ! -path $remoteStage/deploy-remote.sh -exec cp {} $remoteStage/deploy-remote.sh \; -quit; fi; if [ ! -s $remoteStage/deploy-remote.sh ]; then echo 'deployment archive is missing deploy-remote.sh' >&2; tar -tzf $remoteArchive >&2 || true; exit 127; fi; chmod 700 $remoteStage/deploy-remote.sh; if [ `$(id -u) -eq 0 ]; then $rootRunner $remoteScript; else $sudoRunner $remoteScript; fi || DEPLOY_RC=`$?$paymentInstall; exit `${DEPLOY_RC:-0}"
  Write-Host "Installing Node.js, Nginx, systemd service, and attempting HTTPS remotely..." -ForegroundColor Cyan
  # Do not allocate a pseudo-terminal: it would echo the Base64 upload payload.
  $payload | & ssh.exe -T -p $Port $target $remoteCommand
  $deployExit = $LASTEXITCODE
  if ($ConfigurePayment) {
    # 支付以公网校验结果为准。deploy-remote.sh 的 exit 10 是它从服务器本机
    # --resolve 到 127.0.0.1:443 探活打到了别的 HTTPS server block（BaoTa 多站点常见），
    # 外网实测是通的 —— 不能因为这个误报就把整次部署判死。
    $paymentStatus = Invoke-RestMethod -Uri $statusUrl -Method Get -TimeoutSec 20
    if (-not $paymentStatus.ok -or -not $paymentStatus.enabled) {
      throw "Payment route is deployed but disabled. Missing: $($paymentStatus.missing -join ', ')"
    }
    if ([int]$paymentStatus.env -ne 0) { throw "Payment production env must be 0, actual: $($paymentStatus.env)" }
    if ([string]::IsNullOrWhiteSpace([string]$paymentStatus.productId)) { throw 'Payment Product ID is empty' }
    Write-Host 'Payment verified over the public HTTPS endpoint.' -ForegroundColor Green
    if ($deployExit -eq 10) {
      Write-Host 'Note: the on-server HTTPS probe reported 502 (common with several BaoTa HTTPS blocks); the public endpoint answers normally.' -ForegroundColor Yellow
    } elseif ($deployExit -ne 0) {
      throw "Remote deployment failed, exit code $deployExit"
    }
  } else {
    # 和支付路径同一条规则：exit 10 是部署脚本从服务器本机 --resolve 到 127.0.0.1:443
    # 探活、打到了 BaoTa 另一个 HTTPS server block 的误报（外网实测是通的）。
    # 不这么处理的话，每一次普通部署都会被判成失败——服务其实是好的。
    if ($deployExit -eq 10) {
      $publicHealth = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 20
      if (-not $publicHealth.ok -or $publicHealth.service -ne 'buyunlu-leaderboard') {
        throw "Deployment reported exit code 10 and the public health endpoint is not answering: $($publicHealth | ConvertTo-Json -Compress)"
      }
      Write-Host "Public health check passed: $healthUrl" -ForegroundColor Green
      Write-Host 'Note: the on-server HTTPS probe reported 502 (common with several BaoTa HTTPS blocks); the public endpoint answers normally.' -ForegroundColor Yellow
    } elseif ($deployExit -ne 0) {
      throw "Remote deployment failed, exit code $deployExit"
    }
  }
  Write-Host "Deployment complete: https://$Domain/buyunlu-api" -ForegroundColor Green
  if ($ConfigurePayment) {
    Write-Host "Message push URL: https://$Domain/buyunlu-api/pay/notify" -ForegroundColor Yellow
    Write-Host "Message push Token: $messageToken" -ForegroundColor Yellow
    Write-Host 'Set message format to XML and data format to plaintext.' -ForegroundColor Yellow
  }
}
finally {
  if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
  if ($stagingDir -and (Test-Path -LiteralPath $stagingDir)) {
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $resolvedStage = [IO.Path]::GetFullPath($stagingDir)
    if ($resolvedStage.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { [IO.Directory]::Delete($resolvedStage, $true) }
  }
  $appSecret = $null
  $appKey = $null
}
