import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, deviceId } from "./api.js";
import { choose, clearChoice, clearExam, jump, loadAttempt, logout, setDevice, setSession } from "./store.js";

function TopHome() {
  const user = useSelector((s) => s.session.user);
  const dispatch = useDispatch();
  return (
    <div className="home-bar">
      <div><h1>UTME Drill Lab</h1><p>JAMB-style CBT hall</p></div>
      <nav>
        {user && <NavLink to="/">Home</NavLink>}
        {user && <NavLink to="/setup">New paper</NavLink>}
        {user && <NavLink to="/bookmarks">Bookmarks</NavLink>}
        {user ? <button className="ghost" onClick={() => dispatch(logout())}>Sign out</button> : <NavLink to="/login">Sign in</NavLink>}
      </nav>
    </div>
  );
}

function AuthPage({ mode }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "ada@example.com", password: "Passw0rd!" });
  const [error, setError] = useState("");
  useEffect(() => { dispatch(setDevice(deviceId())); }, [dispatch]);
  async function submit(e) {
    e.preventDefault(); setError("");
    try {
      const path = mode === "register" ? "/auth/register" : "/auth/login";
      const data = await api(path, { method: "POST", body: { ...form, deviceId: deviceId() } });
      dispatch(setSession(data));
      navigate(data.user.activated ? "/" : "/activate");
    } catch (err) { setError(err.message); }
  }
  return (
    <div className="home-wrap"><TopHome />
      <form className="auth-box" onSubmit={submit}>
        <h2>{mode === "register" ? "Create profile" : "Candidate login"}</h2>
        {error && <div className="error">{error}</div>}
        {mode === "register" && <label className="field">Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>}
        <label className="field">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label className="field">Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></label>
        <button className="btn">{mode === "register" ? "Create account" : "Enter hall"}</button>
        <p>{mode === "register" ? <Link to="/login">I already have an account</Link> : <Link to="/register">Create an account</Link>}</p>
      </form>
    </div>
  );
}

function Home() {
  const user = useSelector((s) => s.session.user);
  const [data, setData] = useState(null);
  useEffect(() => { api("/analytics").then(setData).catch(() => {}); }, []);
  const last = data?.history?.[0];
  return (
    <div className="home-wrap"><TopHome />
      <div className="home-grid">
        <Link className="tile primary" to="/setup"><b>Sit a paper</b><span>English + 3 subjects. Exam is 180 items / 2 hours.</span></Link>
        <div className="tile"><b>{user?.name || "Candidate"}</b><span>{user?.activated ? "Activated" : "Needs key"} · last {last ? `${last.score}/${last.total}` : "—"}</span></div>
        <Link className="tile" to="/bookmarks"><b>Bookmarks</b><span>Saved stems.</span></Link>
        <div className="tile"><b>Classroom</b><span>Notes come later. Paper first.</span></div>
        <div className="tile"><b>Flashcards</b><span>Not shipped yet.</span></div>
        <div className="tile"><b>Science note</b><span>Use the in-paper calculator.</span></div>
        <div className="tile"><b>UTME Challenge</b><span>Local history only in this build.</span></div>
        <div className="tile"><b>Dictionary</b><span>Not shipped yet.</span></div>
      </div>
    </div>
  );
}

function Setup() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [picked, setPicked] = useState(["ENG"]);
  const [mode, setMode] = useState("exam");
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(20);
  const [error, setError] = useState("");
  useEffect(() => { api("/subjects").then((d) => setSubjects(d.subjects)).catch((e) => setError(e.message)); }, []);
  function toggle(code, compulsory) {
    if (compulsory) return;
    setPicked((p) => p.includes(code) ? p.filter((c) => c !== code) : p.length >= 4 ? p : [...p, code]);
  }
  async function start() {
    if (picked.length !== 4) return setError("Pick Use of English and three other subjects.");
    try {
      const data = await api("/attempts", { method: "POST", body: { mode, subjects: picked, count: Number(count), minutes: Number(minutes) } });
      navigate("/briefing", { state: data });
    } catch (err) { setError(err.message); }
  }
  return (
    <div className="home-wrap"><TopHome />
      <section className="instruct">
        <h2>Paper settings</h2>
        {error && <div className="error">{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
          {subjects.map((s) => (
            <button key={s.code} className="tile" style={{ minHeight: 70, outline: picked.includes(s.code) ? "2px solid #1e3a5f" : "none" }} onClick={() => toggle(s.code, s.compulsory)}>
              <b>{s.name}</b><span>{s.compulsory ? "Compulsory" : "Optional"}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
          {[["exam", "Exam · 180 / 2h"], ["practice", "Practice"], ["correction", "Correction"]].map(([id, label]) => (
            <button key={id} className={mode === id ? "btn" : "ghost"} style={{ color: mode === id ? "#fff" : "#1e3a5f", border: "1px solid #c5d0e0" }} onClick={() => setMode(id)}>{label}</button>
          ))}
        </div>
        {mode !== "exam" && (
          <div style={{ display: "flex", gap: 12 }}>
            <label className="field">Items / subject<input type="number" min="5" max="40" value={count} onChange={(e) => setCount(e.target.value)} /></label>
            <label className="field">Minutes<input type="number" min="5" max="120" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
          </div>
        )}
        <button className="btn-amber" onClick={start}>Continue to instructions</button>
      </section>
    </div>
  );
}

function Briefing() {
  const navigate = useNavigate();
  const data = useLocation().state;
  if (!data?.questions) return <div className="instruct">No paper. <Link to="/setup">Set subjects</Link></div>;
  return (
    <div className="home-wrap"><TopHome />
      <section className="instruct">
        <h2>Examination instructions</h2>
        <ol>
          <li>Keys A–D select an option.</li>
          <li>N next · P previous · R clear · S opens submit.</li>
          <li>Green numbers are answered. Grey are blank.</li>
          <li>Use subject tabs. Answer in any order.</li>
          <li>At 00:00 the paper submits itself.</li>
        </ol>
        <p>{data.questions.length} items · {Math.round(data.seconds / 60)} minutes · {data.mode}</p>
        <button className="btn-green" onClick={() => navigate("/exam", { state: data })}>Start examination</button>
      </section>
    </div>
  );
}

function Calculator({ onClose }) {
  const [expr, setExpr] = useState("");
  function press(k) {
    if (k === "C") return setExpr("");
    if (k === "=") {
      if (!/^[\d+\-*/().\s]+$/.test(expr)) return setExpr("Error");
      try { setExpr(String(Function(`"use strict"; return (${expr})`)())); } catch { setExpr("Error"); }
      return;
    }
    setExpr((v) => (v === "Error" ? k : v + k));
  }
  return (
    <div className="overlay" onClick={onClose}>
      <div className="calc-box" onClick={(e) => e.stopPropagation()}>
        <input value={expr || "0"} readOnly />
        <div className="ckeys">{["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+","C"].map((k) => <button key={k} onClick={() => press(k)}>{k}</button>)}</div>
      </div>
    </div>
  );
}

function Exam() {
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const exam = useSelector((s) => s.exam);
  const user = useSelector((s) => s.session.user);
  const [left, setLeft] = useState(null);
  const [calc, setCalc] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [subject, setSubject] = useState("");
  const lock = useMemo(() => ({ current: false }), []);
  useEffect(() => { if (location.state?.questions) dispatch(loadAttempt(location.state)); }, [location.state, dispatch]);
  useEffect(() => {
    if (!exam.attempt) return undefined;
    const tick = () => setLeft(Math.max(0, exam.attempt.seconds - Math.floor((Date.now() - exam.startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [exam.attempt, exam.startedAt]);
  const questions = exam.attempt?.questions || [];
  const codes = [...new Set(questions.map((q) => q.subjectCode))];
  const activeCode = subject || codes[0] || "";
  const inSubject = questions.map((q, i) => ({ ...q, i })).filter((q) => q.subjectCode === activeCode);
  const current = questions[exam.index];
  useEffect(() => { if (current) setSubject(current.subjectCode); }, [exam.index]);
  async function persist(q, extra) {
    if (!exam.attempt) return;
    try { await api(`/attempts/${exam.attempt.attemptId}/answer`, { method: "PATCH", body: { questionId: q.questionId, selected: exam.answers[q.questionId] || null, ...extra } }); } catch {}
  }
  async function submit() {
    if (!exam.attempt || lock.current) return;
    lock.current = true;
    try {
      const summary = await api(`/attempts/${exam.attempt.attemptId}/submit`, { method: "POST", body: { durationSeconds: Math.floor((Date.now() - exam.startedAt) / 1000) } });
      dispatch(clearExam());
      navigate("/results", { state: summary });
    } catch { lock.current = false; }
  }
  useEffect(() => { if (left === 0 && exam.attempt) submit(); }, [left]);
  useEffect(() => {
    function onKey(e) {
      if (!current || e.target.matches("input, textarea")) return;
      const k = e.key.toLowerCase();
      if (["a","b","c","d","e"].includes(k)) {
        const hit = current.options.find((o) => o.label.toLowerCase() === k);
        if (hit) { dispatch(choose({ id: current.questionId, choice: hit.label })); persist(current, { selected: hit.label }); }
      } else if (k === "n" || k === "arrowright") dispatch(jump(Math.min(questions.length - 1, exam.index + 1)));
      else if (k === "p" || k === "arrowleft") dispatch(jump(Math.max(0, exam.index - 1)));
      else if (k === "r") { dispatch(clearChoice(current.questionId)); persist(current, { selected: null }); }
      else if (k === "s") setConfirm(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!current) return <div className="instruct">No paper. <Link to="/setup">Setup</Link></div>;
  const mm = String(Math.floor((left || 0) / 60)).padStart(2, "0");
  const ss = String((left || 0) % 60).padStart(2, "0");
  const answered = Object.values(exam.answers).filter(Boolean).length;
  return (
    <div className="hall">
      <header className="hall-top"><strong>UTME · {exam.attempt.mode.toUpperCase()}</strong><span>{user?.name || "Candidate"}</span><span className="clock">{mm}:{ss}</span></header>
      <div className="subjects">
        {codes.map((c) => {
          const name = questions.find((q) => q.subjectCode === c)?.subjectName || c;
          const n = questions.filter((q) => q.subjectCode === c && exam.answers[q.questionId]).length;
          const t = questions.filter((q) => q.subjectCode === c).length;
          return (
            <button key={c} className={activeCode === c ? "on" : ""} onClick={() => { setSubject(c); const first = questions.findIndex((q) => q.subjectCode === c); if (first >= 0) dispatch(jump(first)); }}>{name} ({n}/{t})</button>
          );
        })}
      </div>
      <div className="hall-body">
        <section className="qpane">
          <div className="qmeta">Question {current.position} of {questions.length} · {current.subjectName} · {current.topic}</div>
          <p className="stem">{current.stem}</p>
          {current.options.map((o) => (
            <button key={o.label} className={`opt ${exam.answers[current.questionId] === o.label ? "on" : ""}`} onClick={() => { dispatch(choose({ id: current.questionId, choice: o.label })); persist(current, { selected: o.label }); }}>
              <i>{o.label}</i><span>{o.text}</span>
            </button>
          ))}
          {exam.attempt.mode !== "exam" && current.explanation && exam.answers[current.questionId] && <div className="ok">{current.explanation}</div>}
        </section>
        <aside className="map">
          <h4 style={{ margin: "0 0 8px" }}>{inSubject[0]?.subjectName} map</h4>
          <div className="qnums">
            {inSubject.map((q) => (
              <button key={q.questionId} className={`${q.i === exam.index ? "cur" : ""} ${exam.answers[q.questionId] ? "ans" : ""}`} onClick={() => dispatch(jump(q.i))}>{q.position}</button>
            ))}
          </div>
          <div className="legend"><span><i className="sw" style={{ background: "#1f7a4d" }} />Answered</span><span><i className="sw" style={{ background: "#eef2f7" }} />Blank</span></div>
          <p style={{ fontSize: 13, color: "#5b6b82" }}>{answered} of {questions.length} answered</p>
          <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => setCalc(true)}>Calculator</button>
        </aside>
      </div>
      <footer className="hall-foot">
        <button className="btn" onClick={() => dispatch(jump(Math.max(0, exam.index - 1)))}>P · Previous</button>
        <button className="btn" onClick={() => dispatch(jump(Math.min(questions.length - 1, exam.index + 1)))}>N · Next</button>
        <button className="btn-danger" onClick={() => setConfirm(true)}>S · End testing</button>
      </footer>
      {calc && <Calculator onClose={() => setCalc(false)} />}
      {confirm && (
        <div className="overlay"><div className="dialog">
          <h3>Submit this paper?</h3>
          <p>{questions.length - answered} still blank. You cannot return.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-danger" onClick={submit}>Y · Submit now</button>
            <button className="btn" onClick={() => setConfirm(false)}>R · Return</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

function Results() {
  const summary = useLocation().state;
  if (!summary) return <div className="instruct">No result. <Link to="/">Home</Link></div>;
  const scaled = (summary.bySubject || []).map((s) => ({ ...s, pct: s.total ? Math.round((Number(s.correct) / Number(s.total)) * 100) : 0 }));
  const outOf400 = scaled.reduce((a, s) => a + s.pct, 0);
  return (
    <div className="home-wrap"><TopHome />
      <section className="result">
        <h2>Result slip</h2>
        <p className="score400">{outOf400}/400</p>
        <p>raw {summary.attempt.score}/{summary.attempt.total}</p>
        <div className="bars">{scaled.map((s) => (
          <div key={s.code}><div style={{ display: "flex", justifyContent: "space-between" }}><b>{s.name}</b><span>{s.pct}/100</span></div><div className="bar"><i style={{ width: `${s.pct}%` }} /></div></div>
        ))}</div>
        <h3>Correction</h3>
        {(summary.review || []).slice(0, 40).map((row) => (
          <p key={row.position}>{row.position}. {row.subject_code} · yours {row.selected || "—"} · key {row.correct_label}</p>
        ))}
        <Link className="btn" to="/">Home</Link>
      </section>
    </div>
  );
}

function Bookmarks() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api("/bookmarks").then((d) => setRows(d.bookmarks || [])).catch(() => {}); }, []);
  return <div className="home-wrap"><TopHome /><section className="instruct"><h2>Bookmarks</h2>{rows.map((r) => <p key={r.question_id}>{r.subject_code} — {r.stem}</p>)}</section></div>;
}

function Activate() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [key, setKey] = useState("TD-AMBER-DEMO");
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    try { const data = await api("/auth/activate", { method: "POST", body: { key } }); dispatch(setSession(data)); navigate("/"); }
    catch (err) { setError(err.message); }
  }
  return <div className="home-wrap"><TopHome /><form className="auth-box" onSubmit={submit}><h2>Activate</h2>{error && <div className="error">{error}</div>}<label className="field">Key<input value={key} onChange={(e) => setKey(e.target.value)} /></label><button className="btn-amber">Activate</button></form></div>;
}

export default function App() {
  const token = useSelector((s) => s.session.token);
  return (
    <Routes>
      <Route path="/" element={token ? <Home /> : <AuthPage mode="login" />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/briefing" element={<Briefing />} />
      <Route path="/exam" element={<Exam />} />
      <Route path="/results" element={<Results />} />
      <Route path="/bookmarks" element={<Bookmarks />} />
    </Routes>
  );
}
