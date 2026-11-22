#!/usr/bin/env bash
# 今日做点小事 · 测试环境一键部署（幂等，可重复执行）
#
# 在腾讯云服务器上、仓库根目录执行：
#   sudo bash deploy/test/bootstrap.sh
#
# 前置：MySQL 与 Redis 已在本机运行。
# 目标系统：CentOS 7 / RHEL 7（glibc 2.17）；也兼容 Ubuntu / Debian。
# CentOS 7 无法运行官方 Node 20，脚本会自动安装 glibc-217 构建到 /opt/node20。
# 产物：系统账号 rt-test、目录 /data/project/RandomTouch/test、库 randomtouch_test、
#       Redis db 1 + 前缀 rt:test:、systemd 服务、Nginx 反代、.env 模板。
set -euo pipefail

# sudo 的 secure_path 通常不含 /usr/local/bin，先补上
export PATH="/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

ENV="${ENV:-test}"
SVC_USER="${SVC_USER:-rt-test}"
ROOT="${ROOT:-/data/project/RandomTouch}"
APP_DIR="$ROOT/$ENV"
CURRENT="$APP_DIR/current"
SHARED="$APP_DIR/shared"
LOG_DIR="$APP_DIR/logs"
DB_NAME="${DB_NAME:-randomtouch_test}"
DB_USER="${DB_USER:-rt_test}"
REDIS_DB="${REDIS_DB:-1}"
REDIS_PREFIX="${REDIS_PREFIX:-rt:test:}"
PORT="${PORT:-3000}"
DOMAIN="${DOMAIN:-_}"
MYSQL_ROOT_CMD="${MYSQL_ROOT_CMD:-mysql -uroot}"
SERVICE="randomtouch-${ENV}-api"
NODE_VERSION="${NODE_VERSION:-v20.20.2}"
NODE_PREFIX="${NODE_PREFIX:-/opt/node20}"
# 1 = 跳过系统包安装（服务器已手工装好 nginx/rsync/curl 等时使用）
SKIP_INSTALL="${SKIP_INSTALL:-0}"
# 1 = 跳过建库/建用户（已用 root 手工创建，使用 .env 中已有 DB 账号）
SKIP_DB_INIT="${SKIP_DB_INIT:-0}"

SRC_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
log() { echo -e "\033[36m[$(date +%H:%M:%S)]\033[0m $*"; }
die() { echo -e "\033[31m[错误]\033[0m $*" >&2; exit 1; }
# 任何未预期的命令失败都打印行号，避免 set -e 静默退出
trap 'rc=$?; echo -e "\033[31m[错误]\033[0m 第 ${LINENO} 行命令失败（exit $rc）" >&2' ERR

[ "$(id -u)" = "0" ] || die "请用 root / sudo 运行"
[ -f "$SRC_DIR/server/package.json" ] || die "找不到 $SRC_DIR/server，请在仓库根目录运行"

# ── 1. 系统账号与目录 ─────────────────────────────────────────────
mkdir -p "$ROOT"
if ! getent group "$SVC_USER" >/dev/null 2>&1; then
  groupadd --system "$SVC_USER"
fi
if ! id -u "$SVC_USER" >/dev/null 2>&1; then
  log "创建系统账号 $SVC_USER"
  useradd --system --gid "$SVC_USER" --home-dir "$ROOT" --shell /usr/sbin/nologin "$SVC_USER"
else
  log "系统账号 $SVC_USER 已存在"
fi
mkdir -p "$CURRENT" "$SHARED" "$LOG_DIR"
chown -R "$SVC_USER:$SVC_USER" "$ROOT"
chmod 750 "$ROOT" "$APP_DIR"

# ── 2. 系统依赖（CentOS 7 用 yum；Ubuntu/Debian 用 apt） ─────────
OS_FAMILY="unknown"
if command -v apt-get >/dev/null 2>&1; then
  OS_FAMILY="debian"
elif command -v yum >/dev/null 2>&1; then
  OS_FAMILY="rhel"
elif command -v dnf >/dev/null 2>&1; then
  OS_FAMILY="rhel"
fi

if [ "$SKIP_INSTALL" != "1" ]; then
  if [ "$OS_FAMILY" = "debian" ]; then
    apt-get update -y
    apt-get install -y curl ca-certificates tar xz-utils rsync openssl
  elif [ "$OS_FAMILY" = "rhel" ]; then
    # CentOS 7 已 EOL；若 yum 源失效，先切到 vault.centos.org 或 SKIP_INSTALL=1
    yum install -y curl ca-certificates tar xz rsync openssl || true
  fi
fi

# ── 3. Node 20 ────────────────────────────────────────────────────
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  # 自带的旧 node 可能因 glibc 不匹配而无法执行，失败时按 0 处理
  NODE_MAJOR="$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)" || NODE_MAJOR=0
fi
log "系统类型：$OS_FAMILY；已安装 Node 主版本：${NODE_MAJOR:-0}"

if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  if [ "$OS_FAMILY" = "debian" ]; then
    log "安装 Node 20（apt / NodeSource）"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif [ "$OS_FAMILY" = "rhel" ]; then
    # 优先用 getconf，不依赖 awk/head，避免 pipefail 下的静默退出
    GCONF="$(getconf GNU_LIBC_VERSION 2>/dev/null)" || GCONF=""
    GLIBC_VER="${GCONF#glibc }"
    if [ -z "$GLIBC_VER" ]; then
      GLIBC_VER="$(ldd --version 2>/dev/null | sed -n '1s/.* //p')" || GLIBC_VER=""
    fi
    log "检测到 glibc ${GLIBC_VER:-未知}"
    GLIBC_MAJOR="${GLIBC_VER%%.*}"
    GLIBC_REST="${GLIBC_VER#*.}"
    GLIBC_MINOR="${GLIBC_REST%%.*}"
    if [ "${GLIBC_MAJOR:-0}" -lt 2 ] || { [ "${GLIBC_MAJOR:-0}" -eq 2 ] && [ "${GLIBC_MINOR:-0}" -lt 28 ]; }; then
      # CentOS/RHEL 7：glibc 2.17，官方 Node 20 需要 >= 2.28，使用 glibc-217 构建
      [ "$(uname -m)" = "x86_64" ] || die "glibc-217 构建仅支持 x86_64，当前 $(uname -m)"
      command -v xz >/dev/null 2>&1 || die "缺少 xz，请先安装 xz"
      TARBALL="node-${NODE_VERSION}-linux-x64-glibc-217.tar.xz"
      URL="https://unofficial-builds.nodejs.org/download/release/${NODE_VERSION}/${TARBALL}"
      log "安装 Node ${NODE_VERSION}（glibc-217）到 $NODE_PREFIX"
      curl -fL --retry 3 -o "/tmp/${TARBALL}" "$URL" || die "下载 Node 失败：$URL"
      rm -rf "${NODE_PREFIX}.new"
      mkdir -p "${NODE_PREFIX}.new"
      tar -xJf "/tmp/${TARBALL}" -C "${NODE_PREFIX}.new" --strip-components=1
      rm -rf "$NODE_PREFIX"
      mv "${NODE_PREFIX}.new" "$NODE_PREFIX"
      ln -sfn "$NODE_PREFIX/bin/node" /usr/local/bin/node
      ln -sfn "$NODE_PREFIX/bin/npm" /usr/local/bin/npm
      if [ -x "$NODE_PREFIX/bin/npx" ]; then
        ln -sfn "$NODE_PREFIX/bin/npx" /usr/local/bin/npx
      fi
      printf 'export PATH=%s/bin:$PATH\n' "$NODE_PREFIX" >/etc/profile.d/node20.sh
      chmod 644 /etc/profile.d/node20.sh
      hash -r
    else
      log "安装 Node 20（NodeSource RPM）"
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
      if command -v dnf >/dev/null 2>&1; then dnf install -y nodejs; else yum install -y nodejs; fi
    fi
  else
    die "无法识别包管理器，请手动安装 Node 20"
  fi
fi

command -v node >/dev/null 2>&1 || die "Node 未安装成功"
node -v >/dev/null 2>&1 || die "Node 无法执行（可能是 glibc 版本不匹配）"
NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
[ "${NODE_MAJOR:-0}" -ge 20 ] || die "Node 版本仍低于 20：$(node -v)"
log "Node：$(node -v)（$(command -v node)）"

# ── 4. Nginx / MySQL client ───────────────────────────────────────
if [ "$SKIP_INSTALL" != "1" ]; then
  if [ "$OS_FAMILY" = "debian" ]; then
    command -v nginx >/dev/null 2>&1 || apt-get install -y nginx
    if ! command -v mysql >/dev/null 2>&1; then
      apt-get install -y mysql-client 2>/dev/null || apt-get install -y default-mysql-client
    fi
  elif [ "$OS_FAMILY" = "rhel" ]; then
    if ! command -v nginx >/dev/null 2>&1; then
      yum install -y epel-release || true
      if ! yum install -y nginx; then
        EL_VER="$(rpm -E '%{rhel}' 2>/dev/null || echo 7)"
        log "EPEL 安装 nginx 失败，改用 nginx 官方 CentOS ${EL_VER} 源"
        cat >/etc/yum.repos.d/nginx.repo <<NGINXEOF
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/centos/${EL_VER}/\$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
NGINXEOF
        yum install -y nginx || die "nginx 安装失败；请手动安装 nginx 或使用 SKIP_INSTALL=1"
      fi
    fi
    if ! command -v mysql >/dev/null 2>&1; then
      log "未找到 mysql 客户端，尝试安装 mariadb 客户端"
      yum install -y mariadb || log "mysql 客户端未安装；请手动安装 MySQL 8 client"
    fi
  fi
fi

command -v redis-cli >/dev/null 2>&1 || log "未找到 redis-cli（不影响 API；如需手工排查请自行安装）"

command -v curl >/dev/null 2>&1 || die "缺少 curl，请先安装"
command -v rsync >/dev/null 2>&1 || die "缺少 rsync，请先安装（yum install -y rsync）"
command -v openssl >/dev/null 2>&1 || die "缺少 openssl，请先安装"
command -v nginx >/dev/null 2>&1 || die "未找到 nginx，请先安装或使用 SKIP_INSTALL=1 并预装"

# ── 5. CentOS 7：firewalld / SELinux ──────────────────────────────
if systemctl is-active --quiet firewalld 2>/dev/null; then
  log "firewalld：放行 80/443"
  firewall-cmd --permanent --add-service=http >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-service=https >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
fi
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = "Enforcing" ]; then
  log "SELinux：允许 Nginx 连接本机端口"
  setsebool -P httpd_can_network_connect 1 2>/dev/null || \
    log "SELinux 设置失败，请手动执行：setsebool -P httpd_can_network_connect 1"
fi

# ── 6. 同步代码 ───────────────────────────────────────────────────
log "同步代码到 $CURRENT"
rsync -a --delete --exclude node_modules --exclude .npm-cache --exclude .env "$SRC_DIR/server/" "$CURRENT/server/"
mkdir -p "$CURRENT/services/mock"
cp "$SRC_DIR/services/mock/seed.js" "$CURRENT/services/mock/seed.js"
chown -R "$SVC_USER:$SVC_USER" "$CURRENT"

# ── 7. .env（仅首次生成；已存在则保留） ───────────────────────────
ENV_FILE="$SHARED/.env"
if [ ! -f "$ENV_FILE" ]; then
  log "生成 $ENV_FILE"
  DB_PASS="$(openssl rand -hex 16)"
  JWT_SECRET="$(openssl rand -hex 32)"
  cat > "$ENV_FILE" <<EOF
APP_ENV=$ENV
HOST=127.0.0.1
PORT=$PORT
TZ=Asia/Shanghai
LOG_LEVEL=info

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME
DB_POOL=10

REDIS_URL=redis://127.0.0.1:6379
REDIS_DB=$REDIS_DB
REDIS_PREFIX=$REDIS_PREFIX

JWT_SECRET=$JWT_SECRET
JWT_EXPIRE=30d

WX_APPID=wx9ad4f56f0b9d1dbc
WX_SECRET=CHANGE_ME

COS_SECRET_ID=CHANGE_ME
COS_SECRET_KEY=CHANGE_ME
COS_BUCKET=CHANGE_ME
COS_REGION=ap-shanghai
COS_PUBLIC_BASE=
COS_PREFIX=test

SEC_MODE=mock
WITHDRAW_THRESHOLD=100
EOF
  chown "$SVC_USER:$SVC_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  log "保留已有 $ENV_FILE"
fi
DB_PASS="$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)" || true
[ -n "$DB_PASS" ] || die ".env 缺少 DB_PASSWORD"

# 供人工执行 node 脚本时加载环境变量
ENV_SH="$SHARED/env.sh"
printf 'set -a\n. %s\nset +a\nexport PATH="%s/bin:$PATH"\n' "$ENV_FILE" "$NODE_PREFIX" > "$ENV_SH"
chown "$SVC_USER:$SVC_USER" "$ENV_SH"
chmod 600 "$ENV_SH"

# ── 8. MySQL：库 / 用户 ───────────────────────────────────────────
if [ "$SKIP_DB_INIT" = "1" ]; then
  log "SKIP_DB_INIT=1：跳过建库/建用户，使用 $ENV_FILE 中已有账号"
else
  if ! MYSQL_VER="$($MYSQL_ROOT_CMD -N -e 'SELECT VERSION()' 2>/dev/null)"; then
    cat >&2 <<MSG
[错误] 无法以 root 连接 MySQL（当前命令：$MYSQL_ROOT_CMD）。
请任选一种方式后重跑：

  1) 指定 root 密码（密码不含空格/特殊字符）：
     sudo MYSQL_ROOT_CMD="mysql -uroot -p你的root密码" bash deploy/test/bootstrap.sh

  2) 写 /root/.my.cnf（推荐，避免密码出现在命令行）：
     sudo bash -c 'printf "[client]\\nuser=root\\npassword=你的root密码\\n" > /root/.my.cnf && chmod 600 /root/.my.cnf'
     然后重新执行 sudo bash deploy/test/bootstrap.sh

  3) 已手工建库/建用户：加 SKIP_DB_INIT=1
     sudo SKIP_DB_INIT=1 bash deploy/test/bootstrap.sh
     账号密码见：$ENV_FILE 里的 DB_PASSWORD
MSG
    exit 1
  fi
  log "MySQL 版本：$MYSQL_VER"
  log "初始化 MySQL 库 $DB_NAME"
  $MYSQL_ROOT_CMD <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
fi

# ── 9. 安装依赖 + 建表 + 种子 ─────────────────────────────────────
log "安装服务端依赖"
cd "$CURRENT/server"
NPM_CACHE="$APP_DIR/.npm-cache"
mkdir -p "$NPM_CACHE"
if [ -f package-lock.json ]; then
  npm ci --omit=dev --no-audit --no-fund --cache "$NPM_CACHE"
else
  npm install --omit=dev --no-audit --no-fund --cache "$NPM_CACHE"
fi
chown -R "$SVC_USER:$SVC_USER" "$CURRENT/server"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

log "执行 schema（Node mysql2，避免 CentOS 7 旧客户端的认证插件问题）"
node "$CURRENT/server/scripts/run-schema.js"

log "导入种子数据"
node "$CURRENT/server/db/seed.js"

# ── 10. systemd ───────────────────────────────────────────────────
NODE_BIN="$(command -v node)"
log "写入 systemd 服务 $SERVICE"
cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=RandomTouch API (${ENV})
After=network.target

[Service]
Type=simple
User=$SVC_USER
Group=$SVC_USER
WorkingDirectory=$CURRENT/server
EnvironmentFile=$ENV_FILE
Environment=TZ=Asia/Shanghai
# CentOS 7 的 systemd 219 不支持 StandardOutput=append:，用 shell 重定向写日志
ExecStart=/bin/sh -c 'exec $NODE_BIN $CURRENT/server/src/index.js >> $LOG_DIR/api.log 2>&1'
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

touch "$LOG_DIR/api.log" "$LOG_DIR/api.err.log"
chown "$SVC_USER:$SVC_USER" "$LOG_DIR/api.log" "$LOG_DIR/api.err.log"

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

# ── 11. Nginx ─────────────────────────────────────────────────────
log "写入 Nginx 站点"
mkdir -p /etc/nginx/conf.d
cat > "/etc/nginx/conf.d/randomtouch-${ENV}.conf" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 6m;

    location /api/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }
    location = /healthz {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
    }
}
EOF

# 按 IP 访问时避免命中 Nginx 默认站点
if [ -e /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
  log "已移除 Nginx 默认站点（sites-enabled/default）"
fi
if [ -f /etc/nginx/conf.d/default.conf ]; then
  mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled
  log "已禁用 Nginx 默认站点（conf.d/default.conf）"
fi

nginx -t
systemctl enable --now nginx
systemctl reload nginx

# ── 12. 自检 ──────────────────────────────────────────────────────
log "等待 API 就绪"
ok=0
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
if [ "$ok" = "1" ]; then
  log "API 健康检查通过"
else
  log "API 未就绪，查看日志：tail -n 80 $LOG_DIR/api.log"
  log "或：journalctl -u $SERVICE -n 50 --no-pager"
fi

cat <<EOF

────────────────────────────────────────────
测试环境已就绪（$ENV）
  系统账号：$SVC_USER
  代码目录：$CURRENT
  配置文件：$ENV_FILE   ← 必须补 WX_SECRET / COS_*
  日志目录：$LOG_DIR
  服务名  ：$SERVICE
  Node    ：$(node -v)（$NODE_BIN）
  健康检查：curl http://127.0.0.1:$PORT/healthz
  Redis   ：db $REDIS_DB，前缀 $REDIS_PREFIX

下一步：
  1) 编辑 $ENV_FILE 填入 WX_SECRET 与 COS 密钥
  2) sudo systemctl restart $SERVICE
  3) . $SHARED/env.sh    # 每个终端加载一次
  4) cd $CURRENT/server && node scripts/mint-token.js <openid>
  5) node scripts/smoke.js --base=http://127.0.0.1:$PORT --token=<jwt>
  6) 小程序 services/config.js 填 API_BASE，开发者工具关闭域名校验
────────────────────────────────────────────
EOF
