-- 今日做点小事 · MySQL schema v1（测试环境 randomtouch_test）
-- 约定：金额 DECIMAL(10,2)；时间戳 BIGINT(ms)；「天」用 DATE（北京时间）。
-- 全部表可重复执行（IF NOT EXISTS）。

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  openid        VARCHAR(64)  NOT NULL,
  nickname      VARCHAR(64)  NOT NULL DEFAULT '',
  avatar        VARCHAR(512) NOT NULL DEFAULT '',
  created_at    BIGINT NOT NULL,
  last_login_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS creators (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(64) NOT NULL,
  user_id    BIGINT UNSIGNED NULL,
  base_fans  INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_name (name),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sets (
  id             INT UNSIGNED NOT NULL,
  title          VARCHAR(64)  NOT NULL,
  cov_t          VARCHAR(32)  NOT NULL DEFAULT '',
  cov_s          VARCHAR(128) NOT NULL DEFAULT '',
  cover          VARCHAR(8)   NOT NULL DEFAULT 'c1',
  cover_image    VARCHAR(512) NOT NULL DEFAULT '',
  cat            ENUM('food','work','city','mood','life','bond','muse','walk','know') NOT NULL,
  type           ENUM('collect','resident') NOT NULL DEFAULT 'collect',
  price          INT NOT NULL DEFAULT 0,
  trial          INT NOT NULL DEFAULT 0,
  `count`        INT NOT NULL DEFAULT 0,   -- 权威值 = set_cards 行数
  signature_idx  INT NOT NULL DEFAULT -1,
  signature_note VARCHAR(64) NOT NULL DEFAULT '',
  intro          TEXT,
  creator_id     INT UNSIGNED NOT NULL,
  heat           INT NOT NULL DEFAULT 0,
  released_at    DATE NULL,
  date_text      VARCHAR(8) NOT NULL DEFAULT '',
  disclaimer     VARCHAR(64) NOT NULL DEFAULT '',
  likes          INT NOT NULL DEFAULT 0,
  status         ENUM('published','reviewing','rejected') NOT NULL DEFAULT 'published',
  total_drawn    INT NOT NULL DEFAULT 0,
  earn           DECIMAL(10,2) NOT NULL DEFAULT 0,
  buyers         INT NOT NULL DEFAULT 0,
  created_at     BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_cat (cat),
  KEY idx_creator (creator_id),
  KEY idx_status (status),
  KEY idx_released (released_at),
  CONSTRAINT fk_sets_creator FOREIGN KEY (creator_id) REFERENCES creators (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS set_cards (
  set_id INT UNSIGNED NOT NULL,
  idx    INT NOT NULL,
  w      VARCHAR(64) NOT NULL,
  b      TEXT NOT NULL,
  PRIMARY KEY (set_id, idx),
  CONSTRAINT fk_cards_set FOREIGN KEY (set_id) REFERENCES sets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户对某集的订阅 + 当日状态；抽卡时对本行 SELECT ... FOR UPDATE
CREATE TABLE IF NOT EXISTS user_set_progress (
  user_id        BIGINT UNSIGNED NOT NULL,
  set_id         INT UNSIGNED NOT NULL,
  drawn          INT NOT NULL DEFAULT 0,
  today_drawn    TINYINT(1) NOT NULL DEFAULT 0,
  trial_today    TINYINT(1) NOT NULL DEFAULT 0,
  today_idx      INT NULL,
  unlocked       TINYINT(1) NOT NULL DEFAULT 0,
  trial_used     INT NOT NULL DEFAULT 0,
  last_draw_date DATE NULL,
  created_at     BIGINT NOT NULL,
  updated_at     BIGINT NOT NULL,
  PRIMARY KEY (user_id, set_id),
  KEY idx_set (set_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 已收集卡索引（got[] 的事实源）；常驻集也记录，但不用它做完成判定
CREATE TABLE IF NOT EXISTS user_set_cards (
  user_id  BIGINT UNSIGNED NOT NULL,
  set_id   INT UNSIGNED NOT NULL,
  idx      INT NOT NULL,
  first_ts BIGINT NOT NULL,
  PRIMARY KEY (user_id, set_id, idx)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS draw_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  set_id     INT UNSIGNED NOT NULL,
  card_idx   INT NOT NULL,
  is_trial   TINYINT(1) NOT NULL DEFAULT 0,
  request_id VARCHAR(64) NOT NULL DEFAULT '',
  ts         BIGINT NOT NULL,
  day_key    DATE NOT NULL,
  PRIMARY KEY (id),
  KEY idx_user_ts (user_id, ts),
  KEY idx_user_day (user_id, day_key),
  KEY idx_user_set (user_id, set_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 幂等事实源：同一 (user_id, request_id) 永远返回同一结果（跨重启）
CREATE TABLE IF NOT EXISTS draw_requests (
  user_id     BIGINT UNSIGNED NOT NULL,
  request_id  VARCHAR(64) NOT NULL,
  set_id      INT UNSIGNED NOT NULL,
  result_json JSON NOT NULL,
  created_at  BIGINT NOT NULL,
  PRIMARY KEY (user_id, request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stamps (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  set_id     INT UNSIGNED NOT NULL,
  card_idx   INT NOT NULL,
  img_url    VARCHAR(512) NOT NULL DEFAULT '',
  img_file_id VARCHAR(512) NOT NULL DEFAULT '',
  note       VARCHAR(100) NOT NULL DEFAULT '',
  day_key    DATE NOT NULL,
  date_text  VARCHAR(16) NOT NULL DEFAULT '',
  day_text   VARCHAR(8)  NOT NULL DEFAULT '',
  stamp_date VARCHAR(16) NOT NULL DEFAULT '',
  sec_text   ENUM('pass','pending','risky') NOT NULL DEFAULT 'pass',
  sec_media  ENUM('pass','pending','risky','none') NOT NULL DEFAULT 'none',
  created_ts BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_user_set_card (user_id, set_id, card_idx),
  KEY idx_user_ts (user_id, created_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comments (
  id         VARCHAR(32) NOT NULL,
  set_id     INT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NULL,
  name       VARCHAR(64) NOT NULL DEFAULT '',
  avatar     VARCHAR(16) NOT NULL DEFAULT '',
  text       VARCHAR(500) NOT NULL,
  is_creator TINYINT(1) NOT NULL DEFAULT 0,
  status     ENUM('visible','pending','rejected') NOT NULL DEFAULT 'visible',
  created_ts BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_set_ts (set_id, created_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS set_likes (
  user_id    BIGINT UNSIGNED NOT NULL,
  set_id     INT UNSIGNED NOT NULL,
  created_ts BIGINT NOT NULL,
  PRIMARY KEY (user_id, set_id),
  KEY idx_set (set_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS follows (
  user_id    BIGINT UNSIGNED NOT NULL,
  creator_id INT UNSIGNED NOT NULL,
  created_ts BIGINT NOT NULL,
  PRIMARY KEY (user_id, creator_id),
  KEY idx_creator (creator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS weekly_marks (
  user_id    BIGINT UNSIGNED NOT NULL,
  set_id     INT UNSIGNED NOT NULL,
  week_no    INT NOT NULL,
  created_ts BIGINT NOT NULL,
  PRIMARY KEY (user_id, set_id, week_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS remind_auth (
  user_id    BIGINT UNSIGNED NOT NULL,
  enabled    TINYINT(1) NOT NULL DEFAULT 0,
  time_text  VARCHAR(5) NOT NULL DEFAULT '21:00',
  updated_ts BIGINT NOT NULL,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS events (
  id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  event   VARCHAR(64) NOT NULL,
  props   JSON NULL,
  ts      BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_user_ts (user_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS set_reviews (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        BIGINT UNSIGNED NOT NULL,
  payload        JSON NOT NULL,
  status         ENUM('reviewing','approved','rejected') NOT NULL DEFAULT 'reviewing',
  submitted_ts   BIGINT NOT NULL,
  submitted_text VARCHAR(8) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS withdrawals (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  creator_id INT UNSIGNED NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  status     ENUM('pending','done') NOT NULL DEFAULT 'pending',
  ts         BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_creator (creator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS income_txns (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  creator_id INT UNSIGNED NOT NULL,
  d          VARCHAR(8)  NOT NULL DEFAULT '',
  t          VARCHAR(64) NOT NULL DEFAULT '',
  amt        DECIMAL(10,2) NOT NULL DEFAULT 0,
  meta       VARCHAR(64) NOT NULL DEFAULT '',
  ts         BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_creator (creator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_config (
  k VARCHAR(64) NOT NULL,
  v VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO app_config (k, v) VALUES
  ('seed_version', ''),
  ('platform_income', '0'),
  ('withdraw_threshold', '100')
ON DUPLICATE KEY UPDATE k = k;
