#!/usr/bin/env bash
# 只做第一步：创建测试环境系统账号与目录（幂等）。
#   sudo bash deploy/test/init-test-account.sh
# 之后可执行 bootstrap.sh 继续建库/服务。
set -euo pipefail

SVC_USER="${SVC_USER:-rt-test}"
ROOT="${ROOT:-/data/project/randomtouch}"
ENV="${ENV:-test}"
APP_DIR="$ROOT/$ENV"

[ "$(id -u)" = "0" ] || { echo "请用 root / sudo 运行" >&2; exit 1; }

if id -u "$SVC_USER" >/dev/null 2>&1; then
  echo "[ok] 系统账号已存在: $SVC_USER"
else
  useradd --system --home-dir "$ROOT" --shell /usr/sbin/nologin "$SVC_USER"
  echo "[ok] 已创建系统账号: $SVC_USER"
fi

mkdir -p "$APP_DIR/current" "$APP_DIR/shared" "$APP_DIR/logs"
chown -R "$SVC_USER:$SVC_USER" "$ROOT"
chmod 750 "$ROOT" "$APP_DIR"

echo "[ok] 目录就绪:"
ls -ld "$ROOT" "$APP_DIR" "$APP_DIR/current" "$APP_DIR/shared" "$APP_DIR/logs"
echo
echo "下一步: sudo bash deploy/test/bootstrap.sh"
