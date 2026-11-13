"""业务 Blueprint 包。

新增模块时：
1. 在本目录创建 routes_xxx.py，内部定义 bp = Blueprint('xxx', __name__)
2. 在 create_blueprints() 中 import 并返回该 bp
"""


def create_blueprints():
    """返回需要注册到 Flask app 的 Blueprint 列表。"""
    from .routes_gacha import bp as gacha_bp

    return [gacha_bp]
