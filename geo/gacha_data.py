"""「拾笺」抽卡数据：卡池、词笺、稀有度与概率。

设计口径：
- 一套词笺 = 20 枚，按「春 / 夏 / 秋 / 冬」四时各 5 枚。
- 稀有度 N / R / SR / SSR，全站唯一游戏词，配色沿用白墨极简（SSR 用印章红）。
- 每枚词笺包含：字词、出处、原句、笺注（隐喻/释义）。
"""

RARITIES = ("N", "R", "SR", "SSR")

RARITY_LABEL = {
    "N": "常笺",
    "R": "清笺",
    "SR": "珍笺",
    "SSR": "绝笺",
}

# 概率合计 1.0
RATES = {
    "SSR": 0.03,
    "SR": 0.12,
    "R": 0.30,
    "N": 0.55,
}

INK_VALUE = {"N": 1, "R": 2, "SR": 10, "SSR": 50}

PITY_SSR = 80          # 80 抽内必得 SSR
PITY_SR = 10           # 10 抽内必得 SR 及以上（与十连保底叠加）
TEN_PULL_GUARANTEE = "SR"

START_TICKETS = 50     # 初始笺
DAILY_TICKETS = 10     # 每日签到赠笺
SINGLE_COST = 1
TEN_COST = 10
EXCHANGE_INK = 100     # 100 墨 → 10 笺
EXCHANGE_TICKETS = 10

POOL = {
    "id": "sishi-3",
    "name": "四时词笺",
    "period": "第 3 期",
    "subtitle": "从一个字里，抽出一整个句子。",
    "host": "本期笺主 @四时书会",
    "featured": ["yi-suo-yan-yu", "ci-xin-an-chu", "gong-chan-juan"],
}

SERIES = [
    {"key": "spring", "name": "春", "subtitle": "风一停，很多话就说不出口了。",
     "ids": ["chun-shan", "hua", "feng", "yi-suo-yan-yu", "qing-huan"]},
    {"key": "summer", "name": "夏", "subtitle": "走到没有路的地方，云替你继续走。",
     "ids": ["xia-mu", "yu", "yun", "shan-yue", "ci-xin-an-chu"]},
    {"key": "autumn", "name": "秋", "subtitle": "秋天先来的是声音，后到的才是凉。",
     "ids": ["qiu-sheng", "yue", "jiang-feng", "gui-zhou", "gong-chan-juan"]},
    {"key": "winter", "name": "冬", "subtitle": "夜最长的时候，灯最像一个人。",
     "ids": ["dong-xue", "jiu", "chang-ye", "deng-huo", "gu-ren"]},
]

CARDS = [
    # ── 春 ──
    {"id": "chun-shan", "word": "春山", "rarity": "R", "series": "spring",
     "source": "王维《山中》", "quote": "山路元无雨，空翠湿人衣。",
     "note": "春天最深的颜色，是走进去才看见的。"},
    {"id": "hua", "word": "花", "rarity": "N", "series": "spring",
     "source": "苏轼《东栏梨花》", "quote": "梨花淡白柳深青，柳絮飞时花满城。",
     "note": "开与落之间，就是春天全部的时间。"},
    {"id": "feng", "word": "风", "rarity": "N", "series": "spring",
     "source": "李商隐《无题》", "quote": "相见时难别亦难，东风无力百花残。",
     "note": "风一停，很多话就说不出口了。"},
    {"id": "yi-suo-yan-yu", "word": "一蓑烟雨", "rarity": "SSR", "series": "spring",
     "source": "苏轼《定风波》", "quote": "竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。",
     "note": "把一场雨穿在身上，路就轻了。"},
    {"id": "qing-huan", "word": "清欢", "rarity": "SR", "series": "spring",
     "source": "苏轼《浣溪沙》", "quote": "人间有味是清欢。",
     "note": "最淡的一口，才留得住最久。"},

    # ── 夏 ──
    {"id": "xia-mu", "word": "夏木", "rarity": "R", "series": "summer",
     "source": "王维《积雨辋川庄作》", "quote": "漠漠水田飞白鹭，阴阴夏木啭黄鹂。",
     "note": "夏天把声音藏进树里。"},
    {"id": "yu", "word": "雨", "rarity": "N", "series": "summer",
     "source": "苏轼《六月二十七日望湖楼醉书》", "quote": "黑云翻墨未遮山，白雨跳珠乱入船。",
     "note": "雨落下来，湖面才开始记事。"},
    {"id": "yun", "word": "云", "rarity": "N", "series": "summer",
     "source": "王维《终南别业》", "quote": "行到水穷处，坐看云起时。",
     "note": "走到没有路的地方，云替你继续走。"},
    {"id": "shan-yue", "word": "山月", "rarity": "SR", "series": "summer",
     "source": "王维《竹里馆》", "quote": "深林人不知，明月来相照。",
     "note": "没有人看见的时候，月亮看见。"},
    {"id": "ci-xin-an-chu", "word": "此心安处", "rarity": "SSR", "series": "summer",
     "source": "苏轼《定风波·南海归赠王定国侍人寓娘》", "quote": "此心安处是吾乡。",
     "note": "故乡不是地方，是心终于不再搬走。"},

    # ── 秋 ──
    {"id": "qiu-sheng", "word": "秋声", "rarity": "R", "series": "autumn",
     "source": "欧阳修《秋声赋》", "quote": "初淅沥以萧飒，忽奔腾而砰湃。",
     "note": "秋天先来的是声音，后到的才是凉。"},
    {"id": "yue", "word": "月", "rarity": "N", "series": "autumn",
     "source": "张九龄《望月怀远》", "quote": "海上生明月，天涯共此时。",
     "note": "抬头的人，都在同一轮月亮里。"},
    {"id": "jiang-feng", "word": "江风", "rarity": "SR", "series": "autumn",
     "source": "苏轼《赤壁赋》", "quote": "清风徐来，水波不兴。",
     "note": "风从江上来，把心里的事吹成水纹。"},
    {"id": "gui-zhou", "word": "归舟", "rarity": "SR", "series": "autumn",
     "source": "孟浩然《宿建德江》", "quote": "移舟泊烟渚，日暮客愁新。",
     "note": "船靠岸了，人还在路上。"},
    {"id": "gong-chan-juan", "word": "共婵娟", "rarity": "SSR", "series": "autumn",
     "source": "苏轼《水调歌头》", "quote": "但愿人长久，千里共婵娟。",
     "note": "把不能见面的，交给同一轮月亮。"},

    # ── 冬 ──
    {"id": "dong-xue", "word": "冬雪", "rarity": "R", "series": "winter",
     "source": "柳宗元《江雪》", "quote": "孤舟蓑笠翁，独钓寒江雪。",
     "note": "雪把世界删到只剩一竿线。"},
    {"id": "jiu", "word": "酒", "rarity": "N", "series": "winter",
     "source": "白居易《问刘十九》", "quote": "晚来天欲雪，能饮一杯无？",
     "note": "下雪前的那杯酒，是给朋友留的。"},
    {"id": "chang-ye", "word": "长夜", "rarity": "R", "series": "winter",
     "source": "杜甫《阁夜》", "quote": "岁暮阴阳催短景，天涯霜雪霁寒宵。",
     "note": "夜最长的时候，灯最像一个人。"},
    {"id": "deng-huo", "word": "灯火", "rarity": "SR", "series": "winter",
     "source": "辛弃疾《青玉案·元夕》", "quote": "众里寻他千百度，蓦然回首，那人却在，灯火阑珊处。",
     "note": "找了一整夜，答案站在最暗的那盏灯下。"},
    {"id": "gu-ren", "word": "故人", "rarity": "SR", "series": "winter",
     "source": "王维《送元二使安西》", "quote": "劝君更尽一杯酒，西出阳关无故人。",
     "note": "故人是走出很远以后，还在原地的那句话。"},
]

CARD_BY_ID = {c["id"]: c for c in CARDS}
CARDS_BY_RARITY = {r: [c for c in CARDS if c["rarity"] == r] for r in RARITIES}
SERIES_BY_KEY = {s["key"]: s for s in SERIES}

# 自检：卡池完整性（导入时即可暴露数据错误）
assert len(CARDS) == 20, "词笺总数应为 20"
assert len(CARD_BY_ID) == 20, "词笺 id 不允许重复"
for _r in RARITIES:
    assert CARDS_BY_RARITY[_r], f"稀有度 {_r} 没有可用词笺"
assert abs(sum(RATES.values()) - 1.0) < 1e-9, "概率合计必须为 1"
for _s in SERIES:
    assert len(_s["ids"]) == 5, f"季节 {_s['key']} 应有 5 枚词笺"
    for _cid in _s["ids"]:
        assert _cid in CARD_BY_ID, f"季节 {_s['key']} 引用了不存在的词笺 {_cid}"
