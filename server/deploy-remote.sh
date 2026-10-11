#!/usr/bin/env bash
set -Eeuo pipefail

ARCHIVE=""
DOMAIN="example.invalid"
REMOTE_DIR="/opt/buyunlu-leaderboard"
PORT="18787"
for arg in "$@"; do
  case "$arg" in
    --archive=*) ARCHIVE="${arg#*=}" ;;
    --domain=*) DOMAIN="${arg#*=}" ;;
    --remote-dir=*) REMOTE_DIR="${arg#*=}" ;;
    --port=*) PORT="${arg#*=}" ;;
  esac
done

if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "missing archive: $ARCHIVE" >&2
  exit 2
fi

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y nodejs nginx tar python3
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nodejs nginx tar python3
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nodejs nginx tar python3
  else
    echo "unsupported Linux package manager; install Node.js 18+ and nginx first" >&2
    exit 3
  fi
}

if ! command -v node >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1 || { ! command -v nginx >/dev/null 2>&1 && [[ ! -x /www/server/nginx/sbin/nginx ]]; }; then
  install_packages
fi
if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"; then
  echo "Node.js 18 or newer is required; upgrade Node.js and rerun this script" >&2
  exit 4
fi

port_is_free() {
  python3 - "$1" <<'PY'
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    sock.bind(('127.0.0.1', port))
except OSError:
    raise SystemExit(1)
finally:
    sock.close()
PY
}

# Stop only the previous Buyunlu unit before selecting a port. Existing
# applications (for example a stock-data app on 8787) are left untouched.
systemctl stop buyunlu-leaderboard.service >/dev/null 2>&1 || true
SELECTED_PORT=""
for CANDIDATE_PORT in "$PORT" 18787 28787 38787 48787 58787; do
  if port_is_free "$CANDIDATE_PORT"; then
    SELECTED_PORT="$CANDIDATE_PORT"
    break
  fi
done
if [[ -z "$SELECTED_PORT" ]]; then
  echo "no free local port found for the leaderboard service" >&2
  exit 5
fi
if [[ "$SELECTED_PORT" != "$PORT" ]]; then
  echo "port $PORT is already in use; using free port $SELECTED_PORT for Buyunlu"
  PORT="$SELECTED_PORT"
fi

install -d -m 0755 "$REMOTE_DIR" "$REMOTE_DIR/data"
tar -xzf "$ARCHIVE" -C "$REMOTE_DIR"
node --check "$REMOTE_DIR/app.js"
# 语法检查发现不了"漏传了模块"：require 是运行时才解析的，少一个文件并不会让
# --check 报错，只会让服务启动即退出，把排行榜一起带下去。真正 require 一遍才算数。
# app.js 有 require.main 守卫，这里不会监听端口。
if ! (cd "$REMOTE_DIR" && node -e "require('./app.js')"); then
  echo "app.js 加载失败：检查部署包里是否漏了它依赖的本地模块（如 virtual-pay.js）" >&2
  exit 1
fi

# 虚拟支付密钥放独立环境文件，不进代码库也不写进 unit。
# 目录 0700 / 文件 0600，只有 root 能读；已存在就不覆盖，避免重发版把密钥冲掉。
# 前导的 "-" 让文件缺失时服务照常启动：支付功能自动关闭，游戏和排行榜不受影响。
install -d -m 0700 /etc/buyunlu
if [[ ! -f /etc/buyunlu/pay.env ]]; then
  cat > /etc/buyunlu/pay.env <<'PAYENV'
# 步云录 · 小程序虚拟支付配置。填完执行：systemctl restart buyunlu-leaderboard
# 缺任何一项时支付接口返回 503，小程序端自动隐藏购买入口，游戏照常运行。
#WX_APPID=
#WX_APPSECRET=
#WX_XPAY_OFFER_ID=
#WX_XPAY_APP_KEY=
#WX_XPAY_PRODUCT_ID=
# 后台消息推送 Token；configure-payment.bat 会自动生成并显示
#WX_MESSAGE_TOKEN=
# 道具单价，单位【分】，必须与后台道具价格完全一致（100 = 1 元）
#WX_XPAY_GOODS_PRICE=100
# 一份道具发多少张免广告卡
#WX_XPAY_CARDS_PER_UNIT=10
# 0 现网 / 1 沙箱
#WX_XPAY_ENV=0
# 沙箱环境下才需要，用 WX_XPAY_ENV=1 时必须一起填
#WX_XPAY_SANDBOX_APP_KEY=
# 兜底查单接口 /api/pay/sweep 的管理口令，随便一串长随机值
#WX_PAY_ADMIN_TOKEN=
PAYENV
  echo "created /etc/buyunlu/pay.env (fill it in to enable virtual payment)"
fi
chmod 0600 /etc/buyunlu/pay.env

cat > /etc/systemd/system/buyunlu-leaderboard.service <<SERVICE
[Unit]
Description=Buyunlu leaderboard API
After=network.target

[Service]
Type=simple
WorkingDirectory=$REMOTE_DIR
Environment=NODE_ENV=production
Environment=PORT=$PORT
EnvironmentFile=-/etc/buyunlu/pay.env
ExecStart=$(command -v node) $REMOTE_DIR/app.js
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now buyunlu-leaderboard.service

# Prefer the nginx process that is actually serving ports 80/443. BaoTa keeps
# its binary and vhosts outside /etc/nginx and is not managed by systemd.
NGINX_MODE="system"
NGINX_MASTER_PID=""
if [[ -x /www/server/nginx/sbin/nginx ]] && { [[ -d /www/server/panel/vhost/nginx ]] || pgrep -f 'nginx: master process /www/server/nginx/sbin/nginx' >/dev/null 2>&1; }; then
  NGINX_MODE="baota"
  NGINX_BIN="/www/server/nginx/sbin/nginx"
  NGINX_MASTER_PID="$(pgrep -o -f 'nginx: master process /www/server/nginx/sbin/nginx' || true)"
  NGINX_INCLUDE_DIR="/www/server/nginx/conf/buyunlu-leaderboard"
  NGINX_INCLUDE_FILE="$NGINX_INCLUDE_DIR/location.inc"
  NGINX_FALLBACK_FILE="/www/server/panel/vhost/nginx/buyunlu-leaderboard.conf"
  NGINX_ACTIVE_ROOTS="/www/server/panel/vhost/nginx:/www/server/nginx/conf/vhost:/www/server/nginx/conf"
  echo "detected BaoTa nginx master process $NGINX_MASTER_PID"
else
  NGINX_BIN="$(command -v nginx)"
  NGINX_MASTER_PID="$(pgrep -o -f 'nginx: master process' || true)"
  NGINX_INCLUDE_DIR="/etc/nginx/buyunlu-leaderboard"
  NGINX_INCLUDE_FILE="$NGINX_INCLUDE_DIR/location.inc"
  NGINX_FALLBACK_FILE="/etc/nginx/conf.d/buyunlu-leaderboard.conf"
  NGINX_ACTIVE_ROOTS="/etc/nginx/conf.d:/etc/nginx/sites-enabled:/etc/nginx/sites-available"
fi

rm -f /etc/nginx/conf.d/buyunlu-leaderboard.conf
rm -f /etc/nginx/sites-enabled/buyunlu-leaderboard /etc/nginx/sites-available/buyunlu-leaderboard
rm -f /www/server/panel/vhost/nginx/buyunlu-leaderboard.conf
# Keep the old .conf path as an inert placeholder. Some servers include every
# file under snippets automatically, which caused this location to load twice.
install -d -m 0755 /etc/nginx/snippets "$NGINX_INCLUDE_DIR"
cat > /etc/nginx/snippets/buyunlu-leaderboard-location.conf <<'NGINX'
# Legacy placeholder. The active Buyunlu location is stored outside *.conf scans.
NGINX
cat > "$NGINX_INCLUDE_FILE" <<NGINX
location ^~ /buyunlu-api/ {
    proxy_pass http://127.0.0.1:$PORT/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
}
NGINX

python3 - "$DOMAIN" "$NGINX_INCLUDE_FILE" "$NGINX_FALLBACK_FILE" "$NGINX_ACTIVE_ROOTS" <<'PY'
import pathlib
import re
import sys

domain = sys.argv[1]
include_path = sys.argv[2]
fallback_path = pathlib.Path(sys.argv[3])
active_roots = [pathlib.Path(item) for item in sys.argv[4].split(':') if item]
include = 'include %s;' % include_path
server_start = re.compile(r'(?m)^\s*server\s*\{')
server_name = re.compile(r'(?m)^\s*server_name\s+[^;]*\b' + re.escape(domain) + r'\b')
known_includes = [
    '/etc/nginx/snippets/buyunlu-leaderboard-location.conf',
    '/etc/nginx/buyunlu-leaderboard/location.inc',
    '/www/server/nginx/conf/buyunlu-leaderboard/location.inc',
]
include_line = re.compile(
    r'(?m)^[ \t]*include[ \t]+(?:%s);[ \t]*(?:\r?\n|$)'
    % '|'.join(re.escape(item) for item in known_includes)
)
cleanup_roots = active_roots + [
    pathlib.Path('/etc/nginx/conf.d'),
    pathlib.Path('/etc/nginx/sites-enabled'),
    pathlib.Path('/etc/nginx/sites-available'),
    pathlib.Path('/www/server/panel/vhost/nginx'),
    pathlib.Path('/www/server/nginx/conf/vhost'),
    pathlib.Path('/www/server/nginx/conf'),
]
changed = 0
seen = set()

for root in cleanup_roots:
    if not root.exists():
        continue
    for file in root.rglob('*'):
        if not file.is_file() or file.name == 'buyunlu-leaderboard.conf':
            continue
        try:
            resolved = file.resolve()
        except OSError:
            resolved = file
        if resolved in seen:
            continue
        seen.add(resolved)
        try:
            text = file.read_text()
        except (OSError, UnicodeDecodeError):
            continue
        # Remove only the include written by this deployment so reruns are idempotent.
        cleaned = include_line.sub('', text)
        if cleaned != text:
            file.write_text(cleaned)
            text = cleaned
        if not any(root_path == root or root_path in file.parents for root_path in active_roots):
            continue
        blocks = []
        for match in server_start.finditer(text):
            opening = text.find('{', match.start(), match.end())
            depth = 0
            closing = None
            for index in range(opening, len(text)):
                if text[index] == '{':
                    depth += 1
                elif text[index] == '}':
                    depth -= 1
                    if depth == 0:
                        closing = index
                        break
            if closing is not None and server_name.search(text[match.start():closing + 1]):
                blocks.append((match.start(), closing))
        if not blocks:
            continue
        for _, closing in reversed(blocks):
            text = text[:closing] + '\n    ' + include + '\n' + text[closing:]
        file.write_text(text)
        changed += len(blocks)

if changed == 0:
    fallback_path.parent.mkdir(parents=True, exist_ok=True)
    fallback_path.write_text('''server {\n    listen 80;\n    listen [::]:80;\n    server_name %s;\n    %s\n}\n''' % (domain, include))
    print('no existing server block matched; installed a dedicated fallback server')
else:
    print('injected API location into %d existing server block(s)' % changed)
PY
"$NGINX_BIN" -t
if [[ -n "$NGINX_MASTER_PID" ]] && kill -0 "$NGINX_MASTER_PID" >/dev/null 2>&1; then
  kill -HUP "$NGINX_MASTER_PID"
  echo "reloaded active $NGINX_MODE nginx master process $NGINX_MASTER_PID"
else
  if [[ "$NGINX_MODE" == "baota" ]]; then
    "$NGINX_BIN"
  else
    systemctl enable nginx >/dev/null 2>&1 || true
    if ! systemctl start nginx; then
      echo "nginx failed to start; diagnostic details follow" >&2
      systemctl status nginx --no-pager --full >&2 || true
      journalctl -u nginx -n 40 --no-pager >&2 || true
      if command -v ss >/dev/null 2>&1; then
        echo "processes listening on web ports:" >&2
        ss -ltnp | grep -E ':(80|443)[[:space:]]' >&2 || true
      elif command -v netstat >/dev/null 2>&1; then
        echo "processes listening on web ports:" >&2
        netstat -ltnp 2>/dev/null | grep -E ':(80|443)[[:space:]]' >&2 || true
      fi
      exit 7
    fi
  fi
fi

if [[ "$NGINX_MODE" == "baota" ]]; then
  echo "BaoTa nginx detected; preserving the site's existing TLS configuration"
elif command -v certbot >/dev/null 2>&1 && [[ "${SKIP_SSL:-0}" != "1" ]]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo "SSL certificate was not issued; run certbot after DNS points to this server."
elif command -v apt-get >/dev/null 2>&1 && [[ "${SKIP_SSL:-0}" != "1" ]]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo "SSL certificate was not issued; run certbot after DNS points to this server."
elif command -v dnf >/dev/null 2>&1 && [[ "${SKIP_SSL:-0}" != "1" ]]; then
  dnf install -y certbot python3-certbot-nginx || true
  command -v certbot >/dev/null 2>&1 && certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo "SSL certificate was not issued; install certbot and retry after DNS points to this server."
elif command -v yum >/dev/null 2>&1 && [[ "${SKIP_SSL:-0}" != "1" ]]; then
  yum install -y certbot python3-certbot-nginx || true
  command -v certbot >/dev/null 2>&1 && certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo "SSL certificate was not issued; install certbot and retry after DNS points to this server."
fi

HEALTH_OK=0
for HEALTH_ATTEMPT in 1 2 3 4 5 6 7 8 9 10; do
  if python3 - "$PORT" <<'PY'
import json
import sys
import urllib.request

port = int(sys.argv[1])
with urllib.request.urlopen('http://127.0.0.1:%d/api/health' % port, timeout=3) as response:
    payload = json.load(response)
if payload.get('ok') is not True or payload.get('service') != 'buyunlu-leaderboard':
    raise SystemExit(1)
print(json.dumps(payload, ensure_ascii=False))
PY
  then
    HEALTH_OK=1
    break
  fi
  sleep 1
done
if [[ "$HEALTH_OK" != "1" ]]; then
  echo "leaderboard service health check failed" >&2
  systemctl status buyunlu-leaderboard.service --no-pager --full >&2 || true
  journalctl -u buyunlu-leaderboard.service -n 40 --no-pager >&2 || true
  exit 8
fi

proxy_health() {
  local mode="$1"
  if [[ "$mode" == "https" ]]; then
    curl --fail --silent --show-error --insecure --connect-timeout 10 \
      --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/buyunlu-api/health" \
      | python3 -c "import json,sys; p=json.load(sys.stdin); raise SystemExit(0 if p.get('ok') is True and p.get('service') == 'buyunlu-leaderboard' else 1)" 2>/dev/null
  else
    curl --fail --silent --show-error --connect-timeout 10 \
      -H "Host: $DOMAIN" "http://127.0.0.1/buyunlu-api/health" \
      | python3 -c "import json,sys; p=json.load(sys.stdin); raise SystemExit(0 if p.get('ok') is True and p.get('service') == 'buyunlu-leaderboard' else 1)" 2>/dev/null
  fi
}

if command -v curl >/dev/null 2>&1; then
  if proxy_health https; then
    echo "HTTPS leaderboard proxy check passed"
  elif proxy_health http; then
    echo "HTTP leaderboard proxy check passed, but HTTPS is not reachable; configure a valid BaoTa certificate before releasing the mini-program" >&2
    exit 10
  else
    echo "Nginx is reloaded and the local service is healthy, but /buyunlu-api is not routed to it" >&2
    exit 9
  fi
fi
echo "Buyunlu leaderboard deployed at https://$DOMAIN/buyunlu-api"
