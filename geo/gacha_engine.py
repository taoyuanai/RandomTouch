"""「拾笺」抽卡引擎：玩家状态持久化 + 抽卡概率 / 保底 / 重复转化。

设计口径（与 gacha_data.py 配套）：
- 玩家状态按 session 中的 player_id 落到 history/players/<id>.json，进程内加锁 + 原子写。
- 单抽 1 笺、十连 10 笺；每日首次单抽免费，每日可领 10 笺。
- SSR 80 抽硬保底；SR 10 抽保底；十连保底 SR 及以上。
- 重复词笺转化为「墨」，100 墨可换 10 笺。
"""
import json
import os
import random
import re
import threading
import uuid
from datetime import date, datetime

from . import gacha_data as D

_LOCK = threading.RLock()
_PLAYERS_DIR = os.path.join(os.getenv('HISTORY_DIR', 'history'), 'players')
_SAFE_PID = re.compile(r'^[a-f0-9]{32}$')


class GachaError(Exception):
    """业务错误：由路由层转成 JSON 响应。"""

    def __init__(self, code, message, status=400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _now():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def _today():
    return date.today().isoformat()


def _path(pid):
    if not _SAFE_PID.match(pid or ''):
        raise GachaError('bad_player', '玩家标识无效', 400)
    return os.path.join(_PLAYERS_DIR, f'{pid}.json')


def new_state(pid):
    return {
        'player_id': pid,
        'created_at': _now(),
        'tickets': D.START_TICKETS,
        'ink': 0,
        'collection': {},          # card_id -> {"count": n, "first_draw_at": "..."}
        'pity': {'ssr': 0, 'sr': 0},
        'last_free_date': '',
        'last_gift_date': '',
        'draw_count': 0,
        'history': [],             # 最近的抽卡批次（新→旧）
    }


def _normalize(data, pid):
    """容错：本地 JSON 被改坏时，尽量保留可用字段。"""
    base = new_state(pid)
    if not isinstance(data, dict):
        return base

    for key in ('tickets', 'ink', 'draw_count'):
        value = data.get(key)
        if isinstance(value, int) and value >= 0:
            base[key] = value

    collection = data.get('collection')
    if isinstance(collection, dict):
        cleaned = {}
        for cid, item in collection.items():
            if cid not in D.CARD_BY_ID or not isinstance(item, dict):
                continue
            count = item.get('count')
            if not isinstance(count, int) or count < 1:
                continue
            cleaned[cid] = {
                'count': count,
                'first_draw_at': str(item.get('first_draw_at') or ''),
            }
        base['collection'] = cleaned

    pity = data.get('pity')
    if isinstance(pity, dict):
        for key in ('ssr', 'sr'):
            value = pity.get(key)
            if isinstance(value, int) and value >= 0:
                base['pity'][key] = value

    for key in ('last_free_date', 'last_gift_date', 'created_at'):
        if isinstance(data.get(key), str):
            base[key] = data[key]

    history = data.get('history')
    if isinstance(history, list):
        base['history'] = [h for h in history if isinstance(h, dict)][:30]

    return base


def _load(pid):
    try:
        with open(_path(pid), 'r', encoding='utf-8') as f:
            return _normalize(json.load(f), pid)
    except FileNotFoundError:
        return new_state(pid)
    except (json.JSONDecodeError, OSError):
        return new_state(pid)


def _save(state):
    os.makedirs(_PLAYERS_DIR, exist_ok=True)
    path = _path(state['player_id'])
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def _weighted_rarity():
    roll = random.random()
    acc = 0.0
    for rarity in ('SSR', 'SR', 'R', 'N'):
        acc += D.RATES[rarity]
        if roll < acc:
            return rarity
    return 'N'


def _roll_rarity(pity, force_sr=False):
    """按保底规则抽一个稀有度，并就地更新 pity 计数。"""
    pity['ssr'] += 1
    pity['sr'] += 1

    if pity['ssr'] >= D.PITY_SSR:
        rarity = 'SSR'
    elif force_sr or pity['sr'] >= D.PITY_SR:
        rarity = 'SR'
    else:
        rarity = _weighted_rarity()

    if rarity == 'SSR':
        pity['ssr'] = 0
        pity['sr'] = 0
    elif rarity == 'SR':
        pity['sr'] = 0
    return rarity


def _public_card(card, owned=None):
    item = dict(card)
    item['owned'] = bool(owned)
    item['count'] = owned['count'] if owned else 0
    item['first_draw_at'] = owned['first_draw_at'] if owned else None
    return item


def payload(state):
    """客户端所需的完整只读快照。"""
    collection = state['collection']
    cards = [_public_card(c, collection.get(c['id'])) for c in D.CARDS]

    owned_rarities = {'N': 0, 'R': 0, 'SR': 0, 'SSR': 0}
    for cid in collection:
        card = D.CARD_BY_ID.get(cid)
        if card:
            owned_rarities[card['rarity']] += 1

    history = []
    for entry in state['history']:
        results = []
        for item in entry.get('results', []):
            if not isinstance(item, dict):
                continue
            card = D.CARD_BY_ID.get(item.get('id'))
            if not card:
                continue
            results.append({
                'id': card['id'],
                'word': card['word'],
                'rarity': card['rarity'],
                'is_new': bool(item.get('is_new')),
            })
        history.append({
            'at': entry.get('at', ''),
            'count': entry.get('count', len(results)),
            'free': bool(entry.get('free')),
            'results': results,
        })

    total = len(D.CARDS)
    return {
        'pool': D.POOL,
        'rates': D.RATES,
        'pity_total': D.PITY_SSR,
        'series': D.SERIES,
        'cards': cards,
        'state': {
            'tickets': state['tickets'],
            'ink': state['ink'],
            'pity': state['pity'],
            'free_available': state['last_free_date'] != _today(),
            'gift_available': state['last_gift_date'] != _today(),
            'owned': len(collection),
            'total': total,
            'draw_count': state['draw_count'],
        },
        'stats': {
            'owned': len(collection),
            'total': total,
            'draw_count': state['draw_count'],
            'ssr_owned': owned_rarities['SSR'],
            'sr_owned': owned_rarities['SR'],
            'completion': round(len(collection) / total * 100, 1) if total else 0,
        },
        'rules': {
            'single_cost': D.SINGLE_COST,
            'ten_cost': D.TEN_COST,
            'daily_tickets': D.DAILY_TICKETS,
            'exchange_ink': D.EXCHANGE_INK,
            'exchange_tickets': D.EXCHANGE_TICKETS,
            'pity_sr': D.PITY_SR,
        },
        'history': history,
    }


def get_payload(pid):
    with _LOCK:
        return payload(_load(pid))


def draw(pid, count):
    if count not in (1, 10):
        raise GachaError('bad_count', '只支持单抽或十连', 400)

    with _LOCK:
        state = _load(pid)
        free = count == 1 and state['last_free_date'] != _today()
        cost = 0 if free else (D.SINGLE_COST if count == 1 else D.TEN_COST)

        if state['tickets'] < cost:
            raise GachaError(
                'insufficient_tickets',
                f'笺不足：本次需要 {cost} 笺，当前 {state["tickets"]} 笺',
                400,
            )

        state['tickets'] -= cost
        if free:
            state['last_free_date'] = _today()

        results = []
        for i in range(count):
            # 十连第 10 抽兜底：前面 9 抽没有 SR+ 时强制 SR
            force_sr = (
                count == 10
                and i == count - 1
                and not any(r['card']['rarity'] in ('SR', 'SSR') for r in results)
            )
            rarity = _roll_rarity(state['pity'], force_sr)
            card = random.choice(D.CARDS_BY_RARITY[rarity])

            owned = state['collection'].get(card['id'])
            if owned:
                owned['count'] += 1
                is_new = False
                ink = D.INK_VALUE[rarity]
                state['ink'] += ink
            else:
                state['collection'][card['id']] = {'count': 1, 'first_draw_at': _now()}
                is_new = True
                ink = 0

            results.append({'card': dict(card), 'is_new': is_new, 'ink': ink})

        state['draw_count'] += count
        state['history'].insert(0, {
            'at': _now(),
            'count': count,
            'free': free,
            'results': [
                {'id': r['card']['id'], 'rarity': r['card']['rarity'], 'is_new': r['is_new']}
                for r in results
            ],
        })
        del state['history'][30:]
        _save(state)

        return {
            'results': results,
            'used_free': free,
            'cost': cost,
            'payload': payload(state),
        }


def claim_daily(pid):
    with _LOCK:
        state = _load(pid)
        if state['last_gift_date'] == _today():
            raise GachaError('already_claimed', '今天已经领过笺了', 400)
        state['last_gift_date'] = _today()
        state['tickets'] += D.DAILY_TICKETS
        _save(state)
        return {'gained': D.DAILY_TICKETS, 'payload': payload(state)}


def exchange_ink(pid):
    with _LOCK:
        state = _load(pid)
        if state['ink'] < D.EXCHANGE_INK:
            raise GachaError(
                'insufficient_ink',
                f'墨不足：需要 {D.EXCHANGE_INK} 墨，当前 {state["ink"]} 墨',
                400,
            )
        state['ink'] -= D.EXCHANGE_INK
        state['tickets'] += D.EXCHANGE_TICKETS
        _save(state)
        return {'gained': D.EXCHANGE_TICKETS, 'payload': payload(state)}


def reset(pid):
    with _LOCK:
        state = new_state(pid)
        _save(state)
        return payload(state)


def ensure_player_id(session):
    """从 Flask session 取玩家 id，没有则新建。"""
    pid = session.get('player_id')
    if not _SAFE_PID.match(pid or ''):
        pid = uuid.uuid4().hex
        session['player_id'] = pid
    return pid
