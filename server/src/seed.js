import bcrypt from "bcryptjs";
import { db } from "./db.js";

const SUBJECTS = [
  ["ENG", "Use of English", 1],
  ["MTH", "Mathematics", 0],
  ["PHY", "Physics", 0],
  ["CHE", "Chemistry", 0],
  ["BIO", "Biology", 0],
  ["ECO", "Economics", 0],
  ["GOV", "Government", 0],
  ["LIT", "Literature in English", 0],
];
const TOPICS = {
  ENG: ["Lexis", "Comprehension"], MTH: ["Algebra", "Geometry"],
  PHY: ["Mechanics", "Waves"], CHE: ["Atomic Structure", "Organic"],
  BIO: ["Cell", "Ecology"], ECO: ["Demand", "Money"],
  GOV: ["Constitution", "Parties"], LIT: ["Drama", "Poetry"],
};

export async function seed() {
  const count = await db.execute("SELECT COUNT(*) AS c FROM subjects");
  if (Number(count.rows[0].c) > 0) return { skipped: true };
  for (const [code, name, compulsory] of SUBJECTS) {
    await db.execute({ sql: "INSERT INTO subjects (code, name, compulsory) VALUES (?, ?, ?)", args: [code, name, compulsory] });
  }
  const subjectRows = await db.execute("SELECT id, code FROM subjects");
  const subjectId = Object.fromEntries(subjectRows.rows.map((r) => [r.code, r.id]));
  for (const [code, topics] of Object.entries(TOPICS)) {
    for (const name of topics) {
      await db.execute({ sql: "INSERT INTO topics (subject_id, name) VALUES (?, ?)", args: [subjectId[code], name] });
    }
  }
  const topicRows = await db.execute("SELECT id, subject_id, name FROM topics");
  const topicId = {};
  for (const row of topicRows.rows) topicId[`${row.subject_id}:${row.name}`] = row.id;
  const target = { ENG: 60, MTH: 40, PHY: 40, CHE: 40, BIO: 40, ECO: 40, GOV: 40, LIT: 40 };
  for (const [code, n] of Object.entries(target)) {
    const sid = subjectId[code];
    const topics = TOPICS[code];
    for (let i = 0; i < n; i++) {
      const topic = topics[i % topics.length];
      const tid = topicId[`${sid}:${topic}`];
      const ans = ["A", "B", "C", "D", "E"][i % 5];
      const year = String(2018 + (i % 7));
      const stem = `${code} ${topic} item ${i + 1}: pick the option that matches the worked rule.`;
      const explanation = `Worked rule for ${topic}: the key is ${ans}.`;
      const inserted = await db.execute({
        sql: "INSERT INTO questions (subject_id, topic_id, stem, explanation, difficulty, year_tag) VALUES (?, ?, ?, ?, ?, ?)",
        args: [sid, tid, stem, explanation, i % 3 === 0 ? "hard" : "medium", year],
      });
      const qid = Number(inserted.lastInsertRowid);
      for (const label of ["A", "B", "C", "D", "E"]) {
        await db.execute({
          sql: "INSERT INTO options (question_id, label, text, is_correct) VALUES (?, ?, ?, ?)",
          args: [qid, label, label === ans ? `Correct for case ${i + 1}` : `Distractor ${label}`, label === ans ? 1 : 0],
        });
      }
    }
  }
  for (const [key, plan] of [["TD-EMERALD-2026", "annual"], ["TD-AMBER-DEMO", "term"], ["TD-SLATE-LAB", "lab"]]) {
    await db.execute({ sql: "INSERT INTO activation_keys (key, plan) VALUES (?, ?)", args: [key, plan] });
  }
  const hash = bcrypt.hashSync("Passw0rd!", 8);
  await db.execute({
    sql: "INSERT INTO users (name, email, password_hash, activation_key, activated, device_id) VALUES (?, ?, ?, ?, 1, ?)",
    args: ["Ada Okonkwo", "ada@example.com", hash, "TD-EMERALD-2026", "device-demo"],
  });
  await db.execute({ sql: "UPDATE activation_keys SET used_by = 1 WHERE key = ?", args: ["TD-EMERALD-2026"] });
  return { skipped: false };
}
