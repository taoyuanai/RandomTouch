# 测试环境部署

在腾讯云轻量服务器（MySQL、Redis 已安装并运行）上，进入仓库根目录执行：

```bash
# 只先建测试系统账号与目录（可选，bootstrap 也会做）
sudo bash deploy/test/init-test-account.sh

# 完整部署（建库/种子/systemd/Nginx）
sudo bash deploy/test/bootstrap.sh
```

脚本是幂等的，可重复执行。首次执行会：

1. 创建系统账号 `rt-test`
2. 创建目录 `/data/project/RandomTouch/test/{current,shared,logs}`
3. 安装 Node 20 / Nginx / MySQL client（缺失时）
4. 创建库 `randomtouch_test` 与用户 `rt_test`
5. 用 Node（mysql2）执行 `server/db/schema.sql` 并导入种子内容
6. 生成 `shared/.env`（自动生成 DB 密码与 JWT_SECRET）
7. 安装并启动 `randomtouch-test-api.service`
8. 写入 Nginx 反代（80，`/api/` + `/healthz`；禁用默认站点）
9. firewalld 放行 80/443；SELinux 允许 Nginx 反代本机端口（CentOS 7）

## CentOS 7 / RHEL 7 说明

目标机 `3.10.0-1160.el7.x86_64` 是 EL7，脚本已按以下方式适配：

- **Node 20**：EL7 的 glibc 是 2.17，官方 Node 20 需要 glibc ≥ 2.28，无法直接运行。
  脚本会自动下载 Node `v20.20.2` 的 **glibc-217** 构建，解压到 `/opt/node20`，
  并软链到 `/usr/local/bin/{node,npm,npx}`。
- **包管理**：使用 `yum`（不是 `dnf`）；Nginx 优先 EPEL，失败时自动切到 nginx 官方 CentOS 7 源。
- 若 `curl` 报 CA 证书错误，先执行 `sudo yum update -y ca-certificates`。
- **CentOS 7 已 EOL**：如果 `yum` 源失效，先把源切到 `vault.centos.org`，
  或手动装好 nginx/rsync/curl 后执行 `sudo SKIP_INSTALL=1 bash deploy/test/bootstrap.sh`。
- **systemd 219**：不支持 `StandardOutput=append:`，脚本用 `sh -c 'exec node ... >> api.log'` 写日志。
- **SELinux**：脚本会执行 `setsebool -P httpd_can_network_connect 1`；
  **firewalld**：脚本会放行 `http/https`。若仍被拦截，可先 `sudo setenforce 0`
  验证是否为 SELinux 策略问题，再决定是否长期关闭或配置策略。
- **MySQL 客户端**：schema/seed 由 Node `mysql2` 执行，避免 EL7 自带旧客户端
  不支持 MySQL 8 `caching_sha2_password` 的问题。建库/建用户仍使用服务器上的
  `mysql` root 命令（`MYSQL_ROOT_CMD` 可覆盖）。

可选参数：

```bash
# 指定 Node 版本 / 安装目录
sudo NODE_VERSION=v20.20.2 NODE_PREFIX=/opt/node20 bash deploy/test/bootstrap.sh

# 跳过 yum/apt 安装（服务器已手工装好依赖）
sudo SKIP_INSTALL=1 bash deploy/test/bootstrap.sh
```

## 如果 MySQL / Redis 有密码

```bash
# 方式 A：root 需要密码时，用环境变量传入 root 连接命令
sudo MYSQL_ROOT_CMD="mysql -uroot -p你的root密码" bash deploy/test/bootstrap.sh

# 方式 B（推荐）：写 /root/.my.cnf，避免密码出现在命令行
sudo bash -c 'printf "[client]\nuser=root\npassword=你的root密码\n" > /root/.my.cnf && chmod 600 /root/.my.cnf'
sudo bash deploy/test/bootstrap.sh

# 方式 C：已手工建库/建用户，跳过 root 初始化
# 账号密码见 shared/.env 的 DB_PASSWORD
sudo SKIP_DB_INIT=1 bash deploy/test/bootstrap.sh

# Redis 有 requirepass 时，部署后编辑 shared/.env：
# REDIS_URL=redis://:你的密码@127.0.0.1:6379
sudo systemctl restart randomtouch-test-api
```

手工建库/建用户（方式 C 前置）：

```sql
CREATE DATABASE IF NOT EXISTS randomtouch_test
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'rt_test'@'localhost' IDENTIFIED BY '<shared/.env 的 DB_PASSWORD>';
CREATE USER IF NOT EXISTS 'rt_test'@'127.0.0.1' IDENTIFIED BY '<shared/.env 的 DB_PASSWORD>';
GRANT ALL PRIVILEGES ON randomtouch_test.* TO 'rt_test'@'localhost';
GRANT ALL PRIVILEGES ON randomtouch_test.* TO 'rt_test'@'127.0.0.1';
FLUSH PRIVILEGES;
```

## 首次部署后必做

```bash
# 1. 填微信 AppSecret 与 COS 密钥
sudo vi /data/project/RandomTouch/test/shared/.env
sudo systemctl restart randomtouch-test-api

# 2. 加载环境变量与 Node PATH（每个终端执行一次）
#    shared/.env 是 600，后续 node 命令需用 root 或 rt-test 执行
. /data/project/RandomTouch/test/shared/env.sh

# 3. 生成测试 token（openid 可任意填，如 dev-openid-1）
cd /data/project/RandomTouch/test/current/server
node scripts/mint-token.js dev-openid-1

# 4. 冒烟
node scripts/smoke.js --base=http://127.0.0.1:3000 --token=<上一步的 token>

# 5. 可选：把测试账号绑定到演示创作者，回填演示进度
node scripts/attach-demo.js --openid=dev-openid-1
```

## 腾讯云安全组

- 放行 `80` / `443`（以及你自己的 SSH 端口）。
- **不要**对公网放行 `3000` / `3306` / `6379`；API 只监听 `127.0.0.1`，MySQL/Redis 应绑定本机。
- 正式环境必须走 HTTPS（微信要求），并完成域名备案。

## 小程序侧

编辑 `services/config.js`：

```js
API_BASE: 'https://你的域名/api/v1',   // 本地可 http://127.0.0.1:3000/api/v1
```

把 `USE_MOCK` 改为 `false`。开发者工具里勾选「不校验合法域名、web-view」；
正式环境需要已备案的 HTTPS 域名，并在小程序后台配置
request / uploadFile / downloadFile 合法域名（COS 域名也要加）。

## 回滚

`USE_MOCK = true` 即回到本地 mock，前端零风险。

## 常用命令

```bash
systemctl status randomtouch-test-api
journalctl -u randomtouch-test-api -n 100 --no-pager
tail -f /data/project/RandomTouch/test/logs/api.log
curl http://127.0.0.1:3000/healthz
mysql -u rt_test -p randomtouch_test -e 'select count(*) from set_cards'
```
