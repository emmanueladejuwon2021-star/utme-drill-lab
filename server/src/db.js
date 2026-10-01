import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.VERCEL ? "/tmp" : path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(dataDir, "testdriller.db")}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({
  url,
  authToken: authToken || undefined,
});

export async function migrate() {
  await db.executeMultiple(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      activation_key TEXT,
      activated INTEGER NOT NULL DEFAULT 0,
      device_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activation_keys (
      key TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      used_by INTEGER,
      FOREIGN KEY (used_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      compulsory INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      topic_id INTEGER NOT NULL,
      stem TEXT NOT NULL,
      explanation TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'medium',
      year_tag TEXT,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
    CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);

    CREATE TABLE IF NOT EXISTS options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id);

    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      subject_codes TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      submitted_at TEXT,
      duration_seconds INTEGER,
      score INTEGER,
      total INTEGER,
      status TEXT NOT NULL DEFAULT 'in_progress',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);

    CREATE TABLE IF NOT EXISTS attempt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      selected TEXT,
      correct_label TEXT NOT NULL,
      is_correct INTEGER,
      time_spent INTEGER NOT NULL DEFAULT 0,
      flagged INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_items_attempt ON attempt_items(attempt_id);
    CREATE INDEX IF NOT EXISTS idx_questions_year ON questions(year_tag);

    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, question_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );
  `);
}
