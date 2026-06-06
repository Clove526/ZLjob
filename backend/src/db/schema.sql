-- 面试官性格模板
CREATE TABLE interviewer_personalities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  traits JSONB NOT NULL DEFAULT '{}',
  icon VARCHAR(255) DEFAULT '🎭'
);

-- 面试题库
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  question_text TEXT NOT NULL,
  difficulty INT DEFAULT 1
);

-- 回答策略
CREATE TABLE answers (
  id SERIAL PRIMARY KEY,
  question_id INT REFERENCES questions(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  effects JSONB NOT NULL DEFAULT '{}'
);

-- 结局规则
CREATE TABLE endings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}',
  illustration_url VARCHAR(255)
);

-- 游戏记录
CREATE TABLE game_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR(100),
  interviewers JSONB NOT NULL DEFAULT '[]',
  choices JSONB NOT NULL DEFAULT '[]',
  final_scores JSONB NOT NULL DEFAULT '{}',
  ending_id INT REFERENCES endings(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);