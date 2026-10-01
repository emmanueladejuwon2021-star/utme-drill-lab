import jwt from "jsonwebtoken";
import { db } from "./db.js";

const SECRET = process.env.JWT_SECRET || "testdriller-dev-secret-change-me";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, activated: Boolean(user.activated) },
    SECRET,
    { expiresIn: "12h" }
  );
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sign in to continue." });
  try {
    const payload = jwt.verify(token, SECRET);
    const found = await db.execute({ sql: "SELECT id, name, email, activated, device_id, activation_key FROM users WHERE id = ?", args: [payload.sub] });
    if (!found.rows.length) return res.status(401).json({ error: "Account no longer exists." });
    req.user = found.rows[0];
    next();
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    return res.status(401).json({ error: expired ? "Session expired. Sign in again." : "Invalid session." });
  }
}

export function requireActivated(req, res, next) {
  if (!Number(req.user.activated)) {
    return res.status(403).json({ error: "Activate this account with a key before starting an exam." });
  }
  next();
}
