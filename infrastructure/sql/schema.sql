-- ============================================================
-- Iron Empire — MySQL Database Schema
-- Run these commands from the MySQL CLI:
--   mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS iron_empire
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE iron_empire;

-- ---------------------------------------------------------
-- Users: Tracks each player's physical stats & streaks
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reddit_username VARCHAR(64)    NOT NULL UNIQUE,
  current_weight_kg DECIMAL(5,2) NOT NULL DEFAULT 75.00,
  muscle_mass     DECIMAL(5,2)   NOT NULL DEFAULT 15.00,
  physique_tier   ENUM('Novice','Athlete','V-Taper') NOT NULL DEFAULT 'Novice',
  last_login_date DATE           DEFAULT NULL,
  current_streak  INT UNSIGNED   NOT NULL DEFAULT 0,
  total_points    INT UNSIGNED   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_users_tier      (physique_tier),
  INDEX idx_users_streak    (current_streak DESC),
  INDEX idx_users_last_login(last_login_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- Community Gym: Subreddit-wide collaborative progression
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_gym (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subreddit_id    VARCHAR(32)    NOT NULL UNIQUE,
  total_points    INT UNSIGNED   NOT NULL DEFAULT 0,
  gym_tier_level  INT UNSIGNED   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- Workout Logs: Per-session records of player performance
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  workout_date    DATE            NOT NULL,
  score           TINYINT UNSIGNED NOT NULL CHECK (score BETWEEN 0 AND 100),
  circuit_type    ENUM('standard','friday_modified') NOT NULL DEFAULT 'standard',
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_logs_user_date (user_id, workout_date DESC),
  INDEX idx_logs_date      (workout_date),

  CONSTRAINT fk_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- Seed: Insert a default community gym row for development
-- ---------------------------------------------------------
INSERT INTO community_gym (subreddit_id, total_points, gym_tier_level)
VALUES ('iron_empire_dev', 0, 1)
ON DUPLICATE KEY UPDATE subreddit_id = subreddit_id;
