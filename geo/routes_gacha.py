"""「拾笺」抽卡 API。"""
from flask import Blueprint, jsonify, request, session

from . import gacha_engine as engine

bp = Blueprint('gacha', __name__, url_prefix='/api/gacha')


def _pid():
    return engine.ensure_player_id(session)


def _error(exc):
    return jsonify({'error': exc.code, 'message': exc.message}), exc.status


@bp.get('/state')
def get_state():
    """当前玩家完整快照：卡池、词笺、收集、保底、历史。"""
    return jsonify(engine.get_payload(_pid()))


@bp.post('/draw')
def draw():
    data = request.get_json(silent=True) or {}
    try:
        count = int(data.get('count', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'bad_count', 'message': 'count 必须是 1 或 10'}), 400

    try:
        return jsonify(engine.draw(_pid(), count))
    except engine.GachaError as exc:
        return _error(exc)


@bp.post('/daily-gift')
def daily_gift():
    try:
        return jsonify(engine.claim_daily(_pid()))
    except engine.GachaError as exc:
        return _error(exc)


@bp.post('/exchange')
def exchange():
    try:
        return jsonify(engine.exchange_ink(_pid()))
    except engine.GachaError as exc:
        return _error(exc)


@bp.post('/reset')
def reset():
    """演示用：清空本期抽卡记录。"""
    return jsonify(engine.reset(_pid()))
