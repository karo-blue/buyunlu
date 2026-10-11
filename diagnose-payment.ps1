[CmdletBinding()]
param(
  [string]$HostAddress = '192.0.2.1',
  [string]$User = 'root',
  [int]$Port = 22
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command ssh.exe -ErrorAction SilentlyContinue)) {
  throw 'OpenSSH ssh.exe was not found; install Windows OpenSSH Client'
}

# Rules for this file (both were hit in production):
#   1) ASCII only. PowerShell 5.1 reads a BOM-less .ps1 as ANSI/GBK, so any
#      Chinese here turns into mojibake before it is even sent.
#   2) No double quotes in the remote command. PowerShell 5.1 does not escape
#      embedded double quotes when building the native command line, so sshd
#      receives the string with them stripped (single quotes survive).
#      That is why 'echo ===== 1) x =====' blew up: unquoted parens, bash error.

Write-Host 'Buyunlu virtual-payment server diagnostic' -ForegroundColor Cyan
Write-Host 'Secrets are redacted. Section 9 runs the official sweep endpoint, which may deliver pending orders (that is the point).' -ForegroundColor DarkGray
Write-Host ''

# Section 8 needs a small node inspector. JS code cannot travel inside the
# remote command (PowerShell strips its double quotes), so it goes as base64 -
# the exact pattern configure-payment.ps1 uses for pay.env.
$inspectJs = @'
const fs = require('fs');
const mask = v => { const s = String(v || ''); return s.length <= 8 ? s : s.slice(0, 4) + '...' + s.slice(-4); };
let d = null;
let used = '';
for (const file of process.argv.slice(2)) {
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); used = file; break; }
  catch (e) { console.log('skip', file, '-', e.message); }
}
if (!d) { console.log('NO PAY DATA FILE FOUND'); process.exit(0); }
console.log('file:', used);
const orders = d.orders || {};
const keys = Object.keys(orders);
console.log('orders total:', keys.length);
keys.slice(-20).forEach(k => {
  const o = orders[k] || {};
  console.log([k,
    'status=' + o.status,
    'createdAt=' + o.createdAt,
    'quantity=' + o.quantity,
    'goodsPrice=' + o.goodsPrice,
    'wxOrderId=' + (o.wxOrderId ? mask(o.wxOrderId) : '-'),
    'openid=' + mask(o.openid)].join('  '));
});
console.log('deliveredOrders:', Object.keys(d.deliveredOrders || {}).length);
const wallets = d.cards || {};
Object.keys(wallets).forEach(k => {
  const w = wallets[k] || {};
  console.log('wallet[' + mask(k) + '] balance=' + w.balance, 'purchased=' + w.totalPurchased, 'consumed=' + w.totalConsumed);
});
console.log('sessions:', Object.keys(d.sessions || {}).length);
'@
$inspectB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($inspectJs))

$remoteCommand = @'
echo '===== 1) systemd unit ====='
systemctl is-active buyunlu-leaderboard.service 2>&1
echo '--- MainPID / NRestarts / start time; a growing NRestarts means a restart loop ---'
systemctl show -p MainPID -p NRestarts -p ActiveState -p SubState -p ExecMainStartTimestamp buyunlu-leaderboard.service 2>&1
echo '--- Environment / unit file lines ---'
systemctl show -p Environment buyunlu-leaderboard.service 2>&1
systemctl cat buyunlu-leaderboard.service 2>&1 | grep -E 'Environment|ExecStart|WorkingDirectory|EnvironmentFile' || echo '(unit not found)'

echo ''
echo '===== 2) listeners and node processes ====='
echo '--- listening ports ---'
ss -ltnp 2>/dev/null | grep -E ':(18787|28787|38787)' || echo 'none of 18787/28787/38787 is listening'
echo '--- node processes: PPID 1 means systemd, anything else is likely an orphan ---'
ps -eo pid,ppid,etime,cmd 2>/dev/null | grep -F 'app.js' | grep -v grep || echo 'no app.js process'
command -v pm2 >/dev/null 2>&1 && pm2 list 2>&1 | head -20 || echo 'pm2 not installed'

echo ''
echo '===== 3) WX_ vars inside each node process: decisive evidence ====='
for pid in $(pgrep -x node 2>/dev/null); do
  echo --- pid $pid cmd: $(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null) ---
  tr '\0' '\n' < /proc/$pid/environ 2>/dev/null | grep '^WX_' | sed 's/=.*/=<set>/' || true
  echo WX_var_count: $(tr '\0' '\n' < /proc/$pid/environ 2>/dev/null | grep -c '^WX_')
done

echo ''
echo '===== 4) /etc/buyunlu/pay.env ====='
ls -l /etc/buyunlu/pay.env 2>&1
echo '--- line count ---'
wc -l < /etc/buyunlu/pay.env 2>&1
echo '--- lines containing CR, above 0 means the file has CRLF endings ---'
grep -c $'\r' /etc/buyunlu/pay.env 2>/dev/null || echo 0
echo '--- content with values masked ---'
sed 's/=\(.\{0,3\}\).*/=\1..masked/' /etc/buyunlu/pay.env 2>&1

echo ''
echo '===== 5) nginx upstream port ====='
grep -rn 'proxy_pass' /www/server/panel/vhost/nginx/ 2>/dev/null | grep -i buyunlu || echo 'no proxy_pass match under BaoTa vhost dir'
grep -rn 'buyunlu' /www/server/nginx/conf/ 2>/dev/null | head -20 || true
nginx -T 2>/dev/null | grep -i -B2 -A3 'buyunlu' | head -60 || true

echo ''
echo '===== 6) recent service log ====='
journalctl -u buyunlu-leaderboard -n 30 --no-pager 2>&1 | tail -30 || echo 'journal unavailable'

echo ''
echo '===== 7) local probe per port ====='
for p in 18787 28787 38787; do
  printf '%s -> ' $p
  curl -fsS --max-time 4 http://127.0.0.1:$p/api/pay/status 2>&1 || echo 'no response'
  echo ''
done

echo ''
echo '===== 8) virtual-pay order data (masked) ====='
PORT_NUM=$(systemctl show -p Environment buyunlu-leaderboard.service 2>/dev/null | tr ' ' '\n' | sed -n 's/^PORT=//p' | head -1)
PORT_NUM=${PORT_NUM:-18787}
echo service port: $PORT_NUM
PAY_FILE=$(find /opt/buyunlu-leaderboard -name virtual-pay.json 2>/dev/null | head -1)
echo PAY_FILE=$PAY_FILE
printf '%s' '__INSPECT_B64__' | base64 -d --ignore-garbage > /tmp/inspect-pay.js
if [ -n "$PAY_FILE" ]; then node /tmp/inspect-pay.js $PAY_FILE; fi

echo ''
echo '===== 9) manual sweep via admin token (may deliver pending orders) ====='
ADMIN_TOKEN=$(grep '^WX_PAY_ADMIN_TOKEN=' /etc/buyunlu/pay.env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r')
if [ -z "$ADMIN_TOKEN" ]; then
  echo 'WX_PAY_ADMIN_TOKEN not found in pay.env; skip sweep'
else
  echo '--- POST /api/pay/sweep ---'
  curl -sS --max-time 20 -X POST -H 'x-pay-admin-token:'$ADMIN_TOKEN http://127.0.0.1:$PORT_NUM/api/pay/sweep
  echo ''
  echo '--- orders after sweep ---'
  if [ -n "$PAY_FILE" ]; then node /tmp/inspect-pay.js $PAY_FILE; fi
fi
rm -f /tmp/inspect-pay.js
'@

$remoteCommand = $remoteCommand.Replace('__INSPECT_B64__', $inspectB64)

$target = "$User@$HostAddress"
Write-Host "Connecting to $target (enter the SSH password)..." -ForegroundColor Cyan
& ssh.exe -T -p $Port $target $remoteCommand
Write-Host ''
Write-Host 'Diagnostic finished.' -ForegroundColor Green
