# wsgi.py
"""
WSGI 入口文件
用于生产环境部署

使用方式：
1. 直接运行: python wsgi.py
2. Gunicorn: gunicorn wsgi:app -w 4 -b 0.0.0.0:5000 --access-logfile logs/gunicorn_access.log --error-logfile logs/gunicorn_error.log
3. uWSGI: uwsgi --http 0.0.0.0:5000 --wsgi-file wsgi.py --callable app --daemonize logs/uwsgi.log
"""

import os

from dotenv import load_dotenv

# 确保加载环境变量
load_dotenv()

from app import app  # noqa: E402

if __name__ == '__main__':
    try:
        from waitress import serve

        host = os.getenv('FLASK_HOST', '0.0.0.0')
        port = int(os.getenv('FLASK_PORT', 5000))

        print("=" * 50)
        print("🚀 使用 Waitress WSGI 服务器启动...")
        print(f"📍 访问地址: http://{host}:{port}")
        print("📁 日志目录: logs/")
        print("=" * 50)

        serve(app, host=host, port=port, threads=4)
    except ImportError:
        print("⚠️ Waitress 未安装，使用 Flask 开发服务器")
        app.run(host='0.0.0.0', port=5000, debug=False)
