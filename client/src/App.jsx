import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, deviceId } from "./api.js";
import { choose, clearChoice, clearExam, jump, loadAttempt, logout, setDevice, setSession, toggleFlag } from "./store.js";

function Shell({ children }) {
  const user = useSelector((s) => s.session.user);
  const dispatch = useDispatch();
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand"><div className="mark">UT</div><div><h1>UTME Drill Lab</h1><p>Exam simulation</p></div></Link>
        <nav className="nav">
          {user && <NavLink to="/dashboard">Dashboard</NavLink>}
          {user && <NavLink to="/setup">Start drill</NavLink>}
          {user && <NavLink to="/bookmarks">Bookmarks</NavLink>}
          {user ? <button className="btn-ghost" onClick={() => dispatch(logout())}>Sign out</button> : <NavLink to="/login">Sign in</NavLink>}
        </nav>
      </header>
      {children}
    </div>
  );
}

function AuthPage({ mode }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  useEffect(() => { dispatch(setDevice(deviceId())); }, [dispatch]);
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const path = mode === "register" ? "/auth/register" : "/auth/login";
      const data = await api(path, { method: "POST", body: { ...form, deviceId: deviceId() } });
      dispatch(setSession(data));
      navigate(data.user.activated ? "/dashboard" : "/activate");
    } catch (err) { setError(err.message); }
  }
  return (
    <Shell>
      <div className="grid-2">
        <section className="card">
          <h2>{mode === "register" ? "Create profile" : "Welcome back"}</h2>
          <form onSubmit={submit}>
            {error && <div className="error">{error}</div>}
            {mode === "register" && <label className="field">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>}
            <label className="field">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label className="field">Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></label>
            <button className="btn">{mode === "register" ? "Create account" : "Sign in"}</button>
          </form>
          <p>{mode === "register" ? <Link to="/login">I have an account</Link> : <Link to="/register">Create an account</Link>}</p>
        </section>
        <section className="card"><h3>Demo</h3><p>ada@example.com</p><p>Passw0rd!</p></section>
      </div>
    </Shell>
  );
}

function Dashboard() {
  const user = useSelector((s) => s.session.user);
  const [data, setData] = useState(null);
  useEffect(() => { api("/analytics").then(setData).catch(() => {}); }, []);
  return (
    <Shell>
      <section className="card">
        <h2>{user?.name}, score desk</h2>
        <p className="muted">{user?.activated ? "Active" : "Activate first"}</p>
        <p>Latest: {data?.history?.[0] ? `${data.history[0].score}/${data.history[0].total}` : "—"}</p>
        <Link className="btn" to="/setup">Choose subjects</Link>
      </section>
    </Shell>
  );
}

function Setup() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [picked, setPicked] = useState(["ENG"]);
  const [mode, setMode] = useState("practice");
  const [error, setError] = useState("");
  useEffect(() => { api("/subjects").then((d) => setSubjects(d.subjects)).catch((e) => setError(e.message)); }, []);
  function toggle(code, compulsory) {
    if (compulsory) return;
    setPicked((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : prev.length >= 4 ? prev : [...prev, code]);
  }
  async function start() {
    if (picked.length !== 4) return setError("Select English plus three subjects.");
    try {
      const data = await api("/attempts", { method: "POST", body: { mode, subjects: picked, count: 8, minutes: 20 } });
      navigate("/exam", { state: data });
    } catch (err) { setError(err.message); }
  }
  return (
    <Shell>
      <section className="card">
        <h2>Choose four subjects</h2>
        {error && <div className="error">{error}</div>}
        <div className="subject-grid">
          {subjects.map((s) => (
            <button key={s.code} className={`subject ${picked.includes(s.code) ? "on" : ""}`} onClick={() => toggle(s.code, s.compulsory)}>{s.name}</button>
          ))}
        </div>
        <div className="modes" style={{ marginTop: 16 }}>
          {[["exam", "Full exam"], ["practice", "Practice"], ["correction", "Correction"]].map(([id, title]) => (
            <button key={id} className={`mode ${mode === id ? "on" : ""}`} onClick={() => setMode(id)}>{title}</button>
          ))}
        </div>
        <button className="btn-amber" style={{ marginTop: 16 }} onClick={start}>Launch</button>
      </section>
    </Shell>
  );
}

function Exam() {
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const exam = useSelector((s) => s.exam);
  const [left, setLeft] = useState(null);
  const submitted = useMemo(() => ({ current: false }), []);
  useEffect(() => { if (location.state?.questions) dispatch(loadAttempt(location.state)); }, [location.state, dispatch]);
  useEffect(() => {
    if (!exam.attempt) return;
    const tick = () => setLeft(Math.max(0, exam.attempt.seconds - Math.floor((Date.now() - exam.startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [exam.attempt, exam.startedAt]);
  const questions = exam.attempt?.questions || [];
  const current = questions[exam.index];
  async function submit() {
    if (!exam.attempt || submitted.current) return;
    submitted.current = true;
    const summary = await api(`/attempts/${exam.attempt.attemptId}/submit`, { method: "POST", body: { durationSeconds: Math.floor((Date.now() - exam.startedAt) / 1000) } });
    dispatch(clearExam());
    navigate("/results", { state: summary });
  }
  useEffect(() => { if (left === 0 && exam.attempt) submit(); }, [left]);
  if (!current) return <Shell><div className="card">No paper. <Link to="/setup">Setup</Link></div></Shell>;
  const mm = String(Math.floor((left || 0) / 60)).padStart(2, "0");
  const ss = String((left || 0) % 60).padStart(2, "0");
  return (
    <div className="app-shell">
      <div className="exam">
        <section className="card">
          <span className="pill">{current.subjectName}</span>
          <p className="stem">{current.stem}</p>
          {current.options.map((o) => (
            <button key={o.label} className={`option ${exam.answers[current.questionId] === o.label ? "on" : ""}`} onClick={() => { dispatch(choose({ id: current.questionId, choice: o.label })); api(`/attempts/${exam.attempt.attemptId}/answer`, { method: "PATCH", body: { questionId: current.questionId, selected: o.label } }).catch(() => {}); }}>
              <span className="lab">{o.label}</span><span>{o.text}</span>
            </button>
          ))}
          <div className="row">
            <button className="btn-ghost" onClick={() => dispatch(jump(Math.max(0, exam.index - 1)))}>Previous</button>
            <button className="btn" onClick={() => dispatch(jump(Math.min(questions.length - 1, exam.index + 1)))}>Next</button>
            <button className="btn-amber" onClick={submit}>Submit</button>
          </div>
        </section>
        <aside className="exam-side">
          <div className="timer">{mm}:{ss}</div>
          <div className="grid-q">{questions.map((q, i) => (
            <button key={q.questionId} className={`${i === exam.index ? "current" : ""} ${exam.answers[q.questionId] ? "answered" : ""}`} onClick={() => dispatch(jump(i))}>{i + 1}</button>
          ))}</div>
        </aside>
      </div>
    </div>
  );
}

function Results() {
  const summary = useLocation().state;
  if (!summary) return <Shell><div className="card">No result. <Link to="/dashboard">Desk</Link></div></Shell>;
  return (
    <Shell>
      <section className="card">
        <h2>Summary</h2>
        <p>{summary.attempt.score}/{summary.attempt.total}</p>
        <div className="stats">{summary.bySubject.map((s) => <div className="stat" key={s.code}><span className="muted">{s.name}</span><b>{s.correct}/{s.total}</b></div>)}</div>
        <Link className="btn" to="/dashboard">Dashboard</Link>
      </section>
    </Shell>
  );
}

function Bookmarks() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api("/bookmarks").then((d) => setRows(d.bookmarks || [])).catch(() => {}); }, []);
  return <Shell><section className="card"><h2>Bookmarks</h2>{rows.map((r) => <p key={r.question_id}>{r.subject_code} · {r.stem}</p>)}</section></Shell>;
}

function Activate() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  async function submit(e) {
    e.preventDefault();
    const data = await api("/auth/activate", { method: "POST", body: { key } });
    dispatch(setSession(data));
    navigate("/dashboard");
  }
  return <Shell><section className="card"><h2>Activate</h2><form onSubmit={submit}><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="TD-AMBER-DEMO" /><button className="btn-amber">Activate</button></form></section></Shell>;
}

export default function App() {
  const token = useSelector((s) => s.session.token);
  return (
    <Routes>
      <Route path="/" element={token ? <Dashboard /> : <AuthPage mode="login" />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/exam" element={<Exam />} />
      <Route path="/results" element={<Results />} />
      <Route path="/bookmarks" element={<Bookmarks />} />
    </Routes>
  );
}
