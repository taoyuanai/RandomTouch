# app.py
"""
抽卡相关 - 主入口
- 配置 / 日志 / 健康检查
- 业务模块见 geo/ 包（Flask Blueprint）
- 生产入口：wsgi.py（from app import app 链保持不变）
"""
import os
import re
import glob
import gzip
import shutil
import secrets
import logging
from datetime import datetime, timedelta, date
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from flask.json.provider import DefaultJSONProvider
from dotenv import load_dotenv

# 必须在导入 geo 包之前加载 .env：gacha_engine 在导入时读取 HISTORY_DIR
load_dotenv()

from geo import create_blueprints  # noqa: E402

app = Flask(__name__)


class _AppJSONProvider(DefaultJSONProvider):
    """datetime/date 统一序列化为北京时间格式字符串（库中存的就是北京时间 naive 值）"""

    @staticmethod
    def default(o):
        if isinstance(o, datetime):
            return o.strftime('%Y-%m-%d %H:%M:%S')
        if isinstance(o, date):
            return o.strftime('%Y-%m-%d')
        return DefaultJSONProvider.default(o)


app.json = _AppJSONProvider(app)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=int(os.getenv('SESSION_HOURS', '8')))
# 可选：登录域名与回跳域名不同（如 www 与裸域）时，设 .example.com 共享会话 Cookie
if os.getenv('SESSION_COOKIE_DOMAIN'):
    app.config['SESSION_COOKIE_DOMAIN'] = os.getenv('SESSION_COOKIE_DOMAIN')

CSV_DIR = os.getenv('CSV_DIR', 'csv_files')
HISTORY_DIR = os.getenv('HISTORY_DIR', 'history')
USERS_DIR = os.getenv('USERS_DIR', 'users')
LOGS_DIR = os.getenv('LOGS_DIR', 'logs')

for d in [CSV_DIR, HISTORY_DIR, USERS_DIR, LOGS_DIR]:
    Path(d).mkdir(exist_ok=True)


# ==================== 日志系统配置 ====================

class DailyGzipFileHandler(logging.FileHandler):
    """
    按天分文件的日志处理器：
    - 每种类型每天一个文件：logs/<type>-YYYYMMDD.log
    - 跨天自动切换到新一天的文件
    - 7 天前的旧日志自动压缩为 .log.gz（压缩成功后删除原文件）
    """

    RETENTION_DAYS = 7  # 保留未压缩日志的天数，超过则压缩为 gzip

    def __init__(self, log_dir, log_type, level=logging.INFO):
        self.log_dir = log_dir
        self.log_type = log_type
        self._current_date = None
        self._initialized = False
        super().__init__(self._path_for(datetime.now()), encoding='utf-8')
        self.setLevel(level)
        self._current_date = datetime.now().date()
        self._initialized = True
        # 启动时检查一次压缩（应用常驻期间每天 rollover 时再检查）
        self._compress_old_logs()

    def _path_for(self, d):
        """logs/<type>-YYYYMMDD.log"""
        return os.path.join(self.log_dir, f'{self.log_type}-{d.strftime("%Y%m%d")}.log')

    def emit(self, record):
        if not self._initialized:
            return
        today = datetime.now().date()
        if today != self._current_date:
            self._rollover(today)
        super().emit(record)

    def _rollover(self, new_date):
        """跨天切换：关闭旧文件流，打开新一天的文件，并压缩过期日志"""
        try:
            if self.stream:
                self.stream.flush()
                self.stream.close()
        except Exception:
            pass
        self._current_date = new_date
        self.baseFilename = os.path.abspath(self._path_for(new_date))
        self.stream = self._open()
        self._compress_old_logs()

    def _compress_old_logs(self):
        """把 RETENTION_DAYS 天前的 .log 压缩为 .log.gz（幂等：已压缩的跳过）"""
        cutoff = (datetime.now() - timedelta(days=self.RETENTION_DAYS)).date()
        for f in glob.glob(os.path.join(self.log_dir, f'{self.log_type}-*.log')):
            m = re.search(r'-(\d{8})\.log$', f)
            if not m:
                continue
            try:
                file_date = datetime.strptime(m.group(1), '%Y%m%d').date()
            except ValueError:
                continue
            if file_date >= cutoff:
                continue
            gz_path = f + '.gz'
            if os.path.exists(gz_path):
                continue
            try:
                with open(f, 'rb') as src, gzip.open(gz_path, 'wb') as dst:
                    shutil.copyfileobj(src, dst)
                os.remove(f)
                logging.info(f"🗜️ 旧日志已压缩: {os.path.basename(f)} → {os.path.basename(gz_path)}")
            except Exception as e:
                logging.error(f"日志压缩失败 {f}: {e}")


def setup_logging():
    """配置生产级日志系统（每类日志每天一个文件，7 天前自动 gzip）"""
    log_level = os.getenv('LOG_LEVEL', 'INFO')
    log_format = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 根日志器
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level, logging.INFO))

    # 清除已有处理器（避免重复）
    root_logger.handlers.clear()

    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG if os.getenv('FLASK_DEBUG', 'false').lower() == 'true' else logging.INFO)
    console_handler.setFormatter(log_format)
    root_logger.addHandler(console_handler)

    # 文件处理器 - 应用日志（info 级别，按天分文件）
    file_handler = DailyGzipFileHandler(LOGS_DIR, 'app', logging.INFO)
    file_handler.setFormatter(log_format)
    root_logger.addHandler(file_handler)

    # 文件处理器 - 错误日志（error 级别，按天分文件）
    error_handler = DailyGzipFileHandler(LOGS_DIR, 'error', logging.ERROR)
    error_handler.setFormatter(log_format)
    root_logger.addHandler(error_handler)

    # 文件处理器 - 访问日志（API 请求，按天分文件）
    access_handler = DailyGzipFileHandler(LOGS_DIR, 'access', logging.INFO)
    access_handler.setFormatter(log_format)
    access_logger = logging.getLogger('access')
    access_logger.handlers.clear()
    access_logger.addHandler(access_handler)
    access_logger.propagate = False

    # 文件处理器 - 审计日志（业务操作日志，按天分文件）
    audit_handler = DailyGzipFileHandler(LOGS_DIR, 'audit', logging.INFO)
    audit_handler.setFormatter(log_format)
    audit_logger = logging.getLogger('audit')
    audit_logger.handlers.clear()
    audit_logger.addHandler(audit_handler)
    audit_logger.propagate = False

    logging.info("✅ 日志系统初始化完成（按天分文件，7 天前自动压缩）")
    return root_logger


logger = setup_logging()


# ==================== 请求日志中间件 ====================

@app.before_request
def log_request():
    """记录每个 API 请求"""
    if request.path.startswith('/api/'):
        logging.getLogger('access').info(
            f"{request.remote_addr} - {request.method} {request.path}"
        )


@app.after_request
def log_response(response):
    """记录 API 响应状态"""
    if request.path.startswith('/api/'):
        logging.getLogger('access').info(f"响应 {request.path} -> {response.status_code}")
    return response


# ==================== 注册业务 Blueprint ====================

for bp in create_blueprints():
    app.register_blueprint(bp)


# ==================== 基础路由 ====================

@app.route('/')
@app.route('/index.html')
def index():
    """返回当前产品页面（V2.3b 完整功能 + V2.3c 增量设计合并）。"""
    return send_from_directory(app.static_folder, 'day_small_things_v2.html')


@app.route('/health')
@app.route('/api/health')
def health():
    """健康检查：部署探活/负载均衡使用"""
    return jsonify(
        status='ok',
        app='抽卡相关',
        time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    )


@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify(error='not_found', message='接口不存在'), 404
    return '<h1>404</h1><p>页面不存在</p>', 404


@app.errorhandler(500)
def server_error(e):
    logger.exception('服务器内部错误')
    if request.path.startswith('/api/'):
        return jsonify(error='internal_error', message='服务器内部错误'), 500
    return '<h1>500</h1><p>服务器内部错误</p>', 500


if __name__ == '__main__':
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', '5001'))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    logger.info(f"🚀 开发服务器启动: http://{host}:{port} (debug={debug})")
    app.run(host=host, port=port, debug=debug)
