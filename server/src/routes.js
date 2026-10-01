import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db.js";
import { requireAuth, requireActivated, signToken } from "./auth.js";

const router = Router();
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72),
  deviceId: z.string().trim().min(4).max(80),
});

function publicUser(user) {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    activated: Boolean(Number(user.activated)),
    deviceId: user.device_id || null,
    activationKey: user.activation_key || null,
  };
}

router.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Check name, email, password (8+), and device id." });
  const { name, email, password, deviceId } = parsed.data;
  const existing = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email.toLowerCase()] });
  if (existing.rows.length) return res.status(409).json({ error: "That email is already registered." });
  const inserted = await db.execute({
    sql: "INSERT INTO users (name, email, password_hash, device_id) VALUES (?, ?, ?, ?)",
    args: [name, email.toLowerCase(), bcrypt.hashSync(password, 10), deviceId],
  });
  const user = { id: Number(inserted.lastInsertRowid), email: email.toLowerCase(), activated: 0, name };
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post("/auth/login", async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const password = String(req.body.password || "");
  const deviceId = String(req.body.deviceId || "");
  const found = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
  const user = found.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  if (user.device_id && deviceId && user.device_id !== deviceId) {
    return res.status(403).json({ error: "This account is bound to another device." });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post("/auth/activate", requireAuth, async (req, res) => {
  const key = String(req.body.key || "").trim().toUpperCase();
  const found = await db.execute({ sql: "SELECT key, plan, used_by FROM activation_keys WHERE key = ?", args: [key] });
  const row = found.rows[0];
  if (!row) return res.status(404).json({ error: "Activation key not recognised." });
  if (row.used_by && Number(row.used_by) !== Number(req.user.id)) {
    return res.status(409).json({ error: "That key is already used." });
  }
  await db.execute({ sql: "UPDATE users SET activated = 1, activation_key = ? WHERE id = ?", args: [key, req.user.id] });
  await db.execute({ sql: "UPDATE activation_keys SET used_by = ? WHERE key = ?", args: [req.user.id, key] });
  const user = { ...req.user, activated: 1, activation_key: key };
  res.json({ token: signToken(user), user: publicUser(user), plan: row.plan });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.get("/subjects", requireAuth, async (_req, res) => {
  const subjects = await db.execute("SELECT id, code, name, compulsory FROM subjects ORDER BY compulsory DESC, name");
  const topics = await db.execute("SELECT id, subject_id, name FROM topics ORDER BY name");
  const years = await db.execute("SELECT DISTINCT year_tag FROM questions WHERE year_tag IS NOT NULL ORDER BY year_tag DESC");
  res.json({ subjects: subjects.rows, topics: topics.rows, years: years.rows.map((r) => r.year_tag) });
});

router.post("/attempts", requireAuth, requireActivated, async (req, res) => {
  const mode = req.body.mode;
  const codes = Array.isArray(req.body.subjects) ? req.body.subjects.map(String) : [];
  if (!["exam", "practice", "correction"].includes(mode)) return res.status(400).json({ error: "Choose exam, practice, or correction." });
  if (codes.length !== 4 || !codes.includes("ENG")) return res.status(400).json({ error: "Select Use of English and three other subjects." });
  const practiceCount = Math.min(40, Math.max(5, Number(req.body.count) || 10));
  const items = [];
  for (const code of codes) {
    const limit = mode === "exam" ? (code === "ENG" ? 60 : 40) : practiceCount;
    const found = await db.execute({
      sql: `SELECT q.id, q.stem, q.explanation, q.difficulty, q.year_tag, s.code AS subject_code, s.name AS subject_name, t.name AS topic_name
            FROM questions q JOIN subjects s ON s.id = q.subject_id JOIN topics t ON t.id = q.topic_id
            WHERE s.code = ? ORDER BY RANDOM() LIMIT ?`,
      args: [code, limit],
    });
    items.push(...found.rows);
  }
  const created = await db.execute({
    sql: "INSERT INTO attempts (user_id, mode, subject_codes, total) VALUES (?, ?, ?, ?)",
    args: [req.user.id, mode, codes.join(","), items.length],
  });
  const attemptId = Number(created.lastInsertRowid);
  const payload = [];
  for (let i = 0; i < items.length; i++) {
    const q = items[i];
    const options = await db.execute({ sql: "SELECT label, text, is_correct FROM options WHERE question_id = ? ORDER BY label", args: [q.id] });
    const correct = options.rows.find((o) => Number(o.is_correct));
    await db.execute({
      sql: "INSERT INTO attempt_items (attempt_id, question_id, position, correct_label) VALUES (?, ?, ?, ?)",
      args: [attemptId, q.id, i + 1, correct?.label || "A"],
    });
    payload.push({
      position: i + 1, questionId: q.id, subjectCode: q.subject_code, subjectName: q.subject_name,
      topic: q.topic_name, difficulty: q.difficulty, year: q.year_tag, stem: q.stem,
      options: options.rows.map((o) => ({ label: o.label, text: o.text })),
      explanation: mode === "practice" || mode === "correction" ? q.explanation : null,
    });
  }
  const seconds = mode === "exam" ? 7200 : Math.max(5, Number(req.body.minutes) || 20) * 60;
  res.status(201).json({ attemptId, mode, seconds, questions: payload });
});

router.patch("/attempts/:id/answer", requireAuth, async (req, res) => {
  const attemptId = Number(req.params.id);
  const owned = await db.execute({ sql: "SELECT id, status FROM attempts WHERE id = ? AND user_id = ?", args: [attemptId, req.user.id] });
  if (!owned.rows.length) return res.status(404).json({ error: "Attempt not found." });
  const selected = req.body.selected ? String(req.body.selected).slice(0, 1).toUpperCase() : null;
  await db.execute({
    sql: "UPDATE attempt_items SET selected = ?, flagged = ?, time_spent = time_spent + ? WHERE attempt_id = ? AND question_id = ?",
    args: [selected, req.body.flagged ? 1 : 0, Math.max(0, Number(req.body.timeSpent) || 0), attemptId, Number(req.body.questionId)],
  });
  res.json({ ok: true });
});

router.post("/attempts/:id/submit", requireAuth, async (req, res) => {
  const attemptId = Number(req.params.id);
  const owned = await db.execute({ sql: "SELECT * FROM attempts WHERE id = ? AND user_id = ?", args: [attemptId, req.user.id] });
  const attempt = owned.rows[0];
  if (!attempt) return res.status(404).json({ error: "Attempt not found." });
  if (attempt.status === "submitted") return res.json(await summary(attemptId));
  await db.execute({
    sql: "UPDATE attempt_items SET is_correct = CASE WHEN selected IS NOT NULL AND selected = correct_label THEN 1 ELSE 0 END WHERE attempt_id = ?",
    args: [attemptId],
  });
  const scoreRow = await db.execute({ sql: "SELECT SUM(is_correct) AS score, COUNT(*) AS total FROM attempt_items WHERE attempt_id = ?", args: [attemptId] });
  await db.execute({
    sql: "UPDATE attempts SET status = 'submitted', submitted_at = datetime('now'), score = ?, total = ?, duration_seconds = ? WHERE id = ?",
    args: [Number(scoreRow.rows[0].score || 0), Number(scoreRow.rows[0].total || 0), Math.max(0, Number(req.body.durationSeconds) || 0), attemptId],
  });
  res.json(await summary(attemptId));
});

router.post("/bookmarks", requireAuth, async (req, res) => {
  const questionId = Number(req.body.questionId);
  if (!questionId) return res.status(400).json({ error: "Pick a question to bookmark." });
  await db.execute({ sql: "INSERT OR IGNORE INTO bookmarks (user_id, question_id) VALUES (?, ?)", args: [req.user.id, questionId] });
  res.status(201).json({ ok: true });
});
router.delete("/bookmarks/:questionId", requireAuth, async (req, res) => {
  await db.execute({ sql: "DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?", args: [req.user.id, Number(req.params.questionId)] });
  res.json({ ok: true });
});
router.get("/bookmarks", requireAuth, async (req, res) => {
  const rows = await db.execute({
    sql: `SELECT b.question_id, q.stem, s.code AS subject_code FROM bookmarks b JOIN questions q ON q.id = b.question_id JOIN subjects s ON s.id = q.subject_id WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    args: [req.user.id],
  });
  res.json({ bookmarks: rows.rows });
});

router.get("/analytics", requireAuth, async (req, res) => {
  const history = await db.execute({
    sql: "SELECT id, mode, subject_codes, score, total, submitted_at FROM attempts WHERE user_id = ? AND status = 'submitted' ORDER BY id DESC LIMIT 12",
    args: [req.user.id],
  });
  res.json({ history: history.rows, weakTopics: [], avgSpeed: 0 });
});

async function summary(attemptId) {
  const attempt = (await db.execute({ sql: "SELECT * FROM attempts WHERE id = ?", args: [attemptId] })).rows[0];
  const bySubject = await db.execute({
    sql: `SELECT s.code, s.name, SUM(ai.is_correct) AS correct, COUNT(*) AS total FROM attempt_items ai JOIN questions q ON q.id = ai.question_id JOIN subjects s ON s.id = q.subject_id WHERE ai.attempt_id = ? GROUP BY s.id`,
    args: [attemptId],
  });
  const review = await db.execute({
    sql: `SELECT ai.position, ai.selected, ai.correct_label, ai.is_correct, q.stem, q.explanation, s.code AS subject_code FROM attempt_items ai JOIN questions q ON q.id = ai.question_id JOIN subjects s ON s.id = q.subject_id WHERE ai.attempt_id = ? ORDER BY ai.position`,
    args: [attemptId],
  });
  return { attempt, bySubject: bySubject.rows, review: review.rows };
}

export default router;
