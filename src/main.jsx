
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  HelpCircle,
  LogOut,
  Package,
  Plus,
  Rocket,
  ShieldCheck,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const columns = ["Backlog", "To Do", "Doing", "Review", "Done"];
const areas = ["PM", "ME", "EE", "SW", "Integration", "Dokumentation"];
const priorities = ["Niedrig", "Mittel", "Hoch"];
const orderStatus = ["Benötigt", "Bestellt", "Angekommen"];

const levelRules = [
  { level: 1, title: "Projekt gestartet", needed: 0 },
  { level: 2, title: "Team organisiert", needed: 2 },
  { level: 3, title: "Plan steht", needed: 5 },
  { level: 4, title: "Material gesichert", needed: 8 },
  { level: 5, title: "Erster Prototyp", needed: 12 },
  { level: 6, title: "Integration läuft", needed: 16 },
  { level: 7, title: "Demo Ready", needed: 22 },
];

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("me");
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ email: "", password: "", displayName: "", role: "Member", area: "ME" });
  const [taskForm, setTaskForm] = useState(emptyTask());
  const [orderForm, setOrderForm] = useState(emptyOrder());
  const [blockerForm, setBlockerForm] = useState(emptyBlocker());
  const [message, setMessage] = useState("");

  const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("DEIN-PROJEKT"));

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [isConfigured]);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setProfiles([]);
      setTasks([]);
      setOrders([]);
      setBlockers([]);
      return;
    }

    loadAll();

    const channel = supabase
      .channel("admm-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "blockers" }, loadAll)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session?.user?.id]);

  async function loadAll() {
    if (!session?.user) return;

    const [profileRes, profilesRes, tasksRes, ordersRes, blockersRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("blockers").select("*").order("created_at", { ascending: false }),
    ]);

    if (!profileRes.data) {
      const fallbackName = session.user.email?.split("@")[0] || "Teammitglied";
      const insert = await supabase.from("profiles").insert({
        id: session.user.id,
        display_name: fallbackName,
        role: "Member",
        area: "ME",
        is_pm: false,
      }).select().single();
      setProfile(insert.data);
    } else {
      setProfile(profileRes.data);
    }

    setProfiles(profilesRes.data || []);
    setTasks(tasksRes.data || []);
    setOrders(ordersRes.data || []);
    setBlockers(blockersRes.data || []);
  }

  async function signUp(e) {
    e.preventDefault();
    setMessage("");
    const { data, error } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        display_name: authForm.displayName || authForm.email.split("@")[0],
        role: authForm.role,
        area: authForm.area,
        is_pm: false,
      });
      setMessage("Account erstellt. Prüfe ggf. deine E-Mail und logge dich ein.");
      setAuthMode("signin");
    }
  }

  async function signIn(e) {
    e.preventDefault();
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password,
    });
    if (error) setMessage(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const doneTasks = tasks.filter((t) => t.status === "Done");
  const currentLevel = [...levelRules].reverse().find((rule) => doneTasks.length >= rule.needed) || levelRules[0];
  const nextLevel = levelRules.find((rule) => rule.needed > doneTasks.length);
  const myTasks = profile ? tasks.filter((t) => t.owner_id === profile.id) : [];
  const myOpenTasks = myTasks.filter((t) => t.status !== "Done");

  function nameOf(id) {
    return profiles.find((p) => p.id === id)?.display_name || "Nicht zugeordnet";
  }

  async function addTask(e, forceOwnerId = null) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    const payload = {
      title: taskForm.title,
      description: taskForm.description,
      owner_id: forceOwnerId || taskForm.owner_id || profile?.id,
      area: taskForm.area,
      priority: taskForm.priority,
      deadline: taskForm.deadline || null,
      points: Number(taskForm.points || 3),
      status: taskForm.status,
      done_definition: taskForm.done_definition,
      evidence: taskForm.evidence,
      created_by: profile?.id,
    };
    const { error } = await supabase.from("tasks").insert(payload);
    if (error) alert(error.message);
    setTaskForm(emptyTask());
  }

  async function patchTask(id, patch) {
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) alert(error.message);
  }

  async function deleteTask(id) {
    if (!confirm("Aufgabe wirklich löschen?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) alert(error.message);
  }

  async function moveTask(task, newStatus) {
    const check = canMoveTask(task, newStatus, profile);
    if (!check.ok) {
      alert(check.message);
      return;
    }
    await patchTask(task.id, { status: newStatus });
  }

  async function addOrder(e) {
    e.preventDefault();
    if (!orderForm.name.trim()) return;
    const payload = {
      name: orderForm.name,
      description: orderForm.description,
      shop: orderForm.shop,
      order_number: orderForm.order_number,
      quantity: orderForm.quantity,
      price: orderForm.price,
      owner_id: orderForm.owner_id || profile?.id,
      status: orderForm.status,
    };
    const { error } = await supabase.from("orders").insert(payload);
    if (error) alert(error.message);
    setOrderForm(emptyOrder());
  }

  async function patchOrder(id, patch) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) alert(error.message);
  }

  async function deleteOrder(id) {
    if (!confirm("Bestellung wirklich löschen?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) alert(error.message);
  }

  async function addBlocker(e) {
    e.preventDefault();
    if (!blockerForm.question.trim()) return;
    const payload = {
      question: blockerForm.question,
      tried: blockerForm.tried,
      needed_from: blockerForm.needed_from,
      owner_id: profile?.id,
      status: "Offen",
      answer: "",
    };
    const { error } = await supabase.from("blockers").insert(payload);
    if (error) alert(error.message);
    setBlockerForm(emptyBlocker());
  }

  async function patchBlocker(id, patch) {
    const { error } = await supabase.from("blockers").update(patch).eq("id", id);
    if (error) alert(error.message);
  }

  async function deleteBlocker(id) {
    if (!confirm("Blocker wirklich löschen?")) return;
    const { error } = await supabase.from("blockers").delete().eq("id", id);
    if (error) alert(error.message);
  }

  if (loading) return <main className="page center">Lade...</main>;

  if (!isConfigured) {
    return (
      <main className="page center">
        <section className="loginCard">
          <h1>Supabase fehlt</h1>
          <p>Lege eine <code>.env</code>-Datei an und trage deine Supabase URL und deinen Anon Key ein.</p>
          <pre>VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...</pre>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page loginPage">
        <section className="loginCard">
          <div className="brandCircle"><Rocket /></div>
          <h1>ADMM Team Planner</h1>
          <p className="muted">Gemeinsame Projektplanung mit Login und Datenbank.</p>

          <div className="switch">
            <button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>Einloggen</button>
            <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>Registrieren</button>
          </div>

          <form className="form" onSubmit={authMode === "signin" ? signIn : signUp}>
            {authMode === "signup" && (
              <>
                <input placeholder="Name" value={authForm.displayName} onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })} />
                <input placeholder="Rolle, z. B. Mechanical Lead" value={authForm.role} onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })} />
                <select value={authForm.area} onChange={(e) => setAuthForm({ ...authForm, area: e.target.value })}>
                  {areas.map((a) => <option key={a}>{a}</option>)}
                </select>
              </>
            )}
            <input placeholder="E-Mail" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} />
            <input placeholder="Passwort" type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />
            <button className="primary">{authMode === "signin" ? "Einloggen" : "Account erstellen"}</button>
          </form>
          {message && <p className="message">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">ADMM Team Planner Complete</p>
          <h1>Gemeinsame Planungs-App</h1>
          <p className="muted">Alle Teammitglieder sehen denselben Stand über Supabase.</p>
        </div>
        <div className="userBox">
          <strong>{profile?.display_name || session.user.email}</strong>
          <span>{profile?.role} · {profile?.area}</span>
          <button className="secondary" onClick={signOut}><LogOut size={16} /> Logout</button>
        </div>
      </header>

      <section className="stats">
        <Stat icon={<ClipboardList />} label="Aufgaben" value={tasks.length} />
        <Stat icon={<CheckCircle2 />} label="Erledigt" value={doneTasks.length} />
        <Stat icon={<Package />} label="Bestellungen offen" value={orders.filter((o) => o.status !== "Angekommen").length} />
        <Stat icon={<Star />} label={`Level ${currentLevel.level}`} value={currentLevel.title} />
      </section>

      <section className="levelCard">
        <div>
          <h2>Team-Level: {currentLevel.title}</h2>
          <p>{nextLevel ? `Noch ${nextLevel.needed - doneTasks.length} erledigte Aufgaben bis Level ${nextLevel.level}: ${nextLevel.title}` : "Maximallevel erreicht. Demo ready!"}</p>
        </div>
        <div className="levelTrack">
          {levelRules.map((rule) => (
            <div key={rule.level} className={doneTasks.length >= rule.needed ? "levelDot active" : "levelDot"}>{rule.level}</div>
          ))}
        </div>
      </section>

      <nav className="tabs">
        <button className={tab === "me" ? "active" : ""} onClick={() => setTab("me")}>Mein Bereich</button>
        <button className={tab === "board" ? "active" : ""} onClick={() => setTab("board")}>Team-Board</button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Bestellungen</button>
        <button className={tab === "blockers" ? "active" : ""} onClick={() => setTab("blockers")}>Fragen & Blocker</button>
        {profile?.is_pm && <button className={tab === "pm" ? "active" : ""} onClick={() => setTab("pm")}>PM-Übersicht</button>}
      </nav>

      {tab === "me" && (
        <section className="grid two">
          <Card title="Meine neue Aufgabe">
            <TaskForm form={taskForm} setForm={setTaskForm} profiles={profiles} submit={(e) => addTask(e, profile.id)} hideOwner />
          </Card>
          <div>
            <h2>Meine Aufgaben</h2>
            {myOpenTasks.length === 0 && <p className="empty">Keine offenen Aufgaben. Stark!</p>}
            <div className="taskList">
              {myTasks.map((task) => (
                <TaskCard key={task.id} task={task} nameOf={nameOf} moveTask={moveTask} patchTask={patchTask} deleteTask={deleteTask} profile={profile} />
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "board" && (
        <section className="kanban">
          {columns.map((col) => (
            <div className="column" key={col}>
              <h3>{col}</h3>
              {tasks.filter((t) => t.status === col).map((task) => (
                <TaskCard key={task.id} task={task} nameOf={nameOf} moveTask={moveTask} patchTask={patchTask} deleteTask={deleteTask} profile={profile} compact />
              ))}
            </div>
          ))}
        </section>
      )}

      {tab === "orders" && (
        <section className="grid two">
          <Card title="Bestellung hinzufügen">
            <OrderForm form={orderForm} setForm={setOrderForm} profiles={profiles} submit={addOrder} />
          </Card>
          <div>
            <h2>Bestellstatus</h2>
            <div className="taskList">
              {orders.map((order) => (
                <div className="itemCard" key={order.id}>
                  <div className="row">
                    <strong>{order.name}</strong>
                    <select value={order.status} onChange={(e) => patchOrder(order.id, { status: e.target.value })}>
                      {orderStatus.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <p>{order.description}</p>
                  <p className="muted">{order.shop} · Nr. {order.order_number || "offen"} · Menge {order.quantity} · Preis {order.price || "offen"}</p>
                  <p className="muted">Verantwortlich: {nameOf(order.owner_id)}</p>
                  <button className="iconBtn" onClick={() => deleteOrder(order.id)}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "blockers" && (
        <section className="grid two">
          <Card title="Frage oder Blocker hinzufügen">
            <form onSubmit={addBlocker} className="form">
              <textarea placeholder="Was ist das Problem?" value={blockerForm.question} onChange={(e) => setBlockerForm({ ...blockerForm, question: e.target.value })} />
              <textarea placeholder="Was hast du schon versucht?" value={blockerForm.tried} onChange={(e) => setBlockerForm({ ...blockerForm, tried: e.target.value })} />
              <input placeholder="Hilfe benötigt von..." value={blockerForm.needed_from} onChange={(e) => setBlockerForm({ ...blockerForm, needed_from: e.target.value })} />
              <button className="primary"><HelpCircle size={18} /> Blocker posten</button>
            </form>
          </Card>
          <div>
            <h2>Gemeinsame Fragen</h2>
            <div className="taskList">
              {blockers.map((b) => (
                <div className="itemCard" key={b.id}>
                  <div className="row">
                    <strong>{b.question}</strong>
                    <span className={b.status === "Gelöst" ? "badge done" : "badge danger"}>{b.status}</span>
                  </div>
                  <p><b>Schon versucht:</b> {b.tried}</p>
                  <p><b>Hilfe von:</b> {b.needed_from}</p>
                  <textarea placeholder="Antwort / Lösung" value={b.answer || ""} onChange={(e) => patchBlocker(b.id, { answer: e.target.value })} />
                  <div className="row">
                    <button className="secondary" onClick={() => patchBlocker(b.id, { status: b.status === "Gelöst" ? "Offen" : "Gelöst" })}>
                      {b.status === "Gelöst" ? "Wieder öffnen" : "Als gelöst markieren"}
                    </button>
                    <button className="iconBtn" onClick={() => deleteBlocker(b.id)}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "pm" && profile?.is_pm && (
        <section className="grid two">
          <Card title="Neue Team-Aufgabe">
            <TaskForm form={taskForm} setForm={setTaskForm} profiles={profiles} submit={addTask} />
          </Card>
          <Card title="PM-Kontrolle">
            <ul className="checkList">
              <li>Offene Aufgaben: {tasks.filter((t) => t.status !== "Done").length}</li>
              <li>Offene Blocker: {blockers.filter((b) => b.status !== "Gelöst").length}</li>
              <li>Bestellungen nicht angekommen: {orders.filter((o) => o.status !== "Angekommen").length}</li>
              <li>Aufgaben ohne Definition of Done: {tasks.filter((t) => !t.done_definition).length}</li>
            </ul>
          </Card>
          <Card title="Status-Regeln">
            <ul className="checkList">
              <li>To Do → Doing: Owner, Beschreibung und Deadline nötig.</li>
              <li>Doing → Review: Definition of Done und Ergebnis/Doku nötig.</li>
              <li>Review → Done: nur PM oder Aufgaben-Owner darf abschließen.</li>
              <li>Done bedeutet: Aufgabe ist wirklich prüfbar erledigt.</li>
            </ul>
          </Card>
          <Card title="Team">
            <div className="taskList">
              {profiles.map((p) => <div className="itemCard" key={p.id}><strong>{p.display_name}</strong><p className="muted">{p.role} · {p.area} {p.is_pm ? "· PM" : ""}</p></div>)}
            </div>
          </Card>
        </section>
      )}
    </main>
  );
}

function canMoveTask(task, newStatus, profile) {
  if (!profile) return { ok: false, message: "Bitte einloggen." };
  const isOwner = task.owner_id === profile.id;
  const isPm = profile.is_pm;

  if (!isOwner && !isPm) return { ok: false, message: "Nur Owner oder PM darf diese Aufgabe verschieben." };

  if (newStatus === "Doing" && (!task.owner_id || !task.description || !task.deadline)) {
    return { ok: false, message: "Für Doing braucht die Aufgabe Owner, Beschreibung und Deadline." };
  }
  if (newStatus === "Review" && (!task.done_definition || !task.evidence)) {
    return { ok: false, message: "Für Review braucht die Aufgabe Definition of Done und Ergebnis/Doku." };
  }
  if (newStatus === "Done" && task.status !== "Review") {
    return { ok: false, message: "Eine Aufgabe darf erst nach Review auf Done." };
  }
  return { ok: true };
}

function emptyTask() {
  return { title: "", description: "", owner_id: "", area: "PM", priority: "Mittel", deadline: "", points: 3, status: "Backlog", done_definition: "", evidence: "" };
}
function emptyOrder() {
  return { name: "", description: "", shop: "", order_number: "", quantity: "1", price: "", owner_id: "", status: "Benötigt" };
}
function emptyBlocker() {
  return { question: "", tried: "", needed_from: "" };
}

function Stat({ icon, label, value }) {
  return <div className="stat"><div className="statIcon">{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div>;
}
function Card({ title, children }) {
  return <section className="card"><h2>{title}</h2>{children}</section>;
}

function TaskForm({ form, setForm, profiles, submit, hideOwner }) {
  return (
    <form className="form" onSubmit={submit}>
      <input placeholder="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea placeholder="Beschreibung" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      {!hideOwner && (
        <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
          <option value="">Owner auswählen</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select>
      )}
      <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>{areas.map((a) => <option key={a}>{a}</option>)}</select>
      <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{priorities.map((p) => <option key={p}>{p}</option>)}</select>
      <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
      <input type="number" min="1" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
      <textarea placeholder="Definition of Done: Wann ist es wirklich fertig?" value={form.done_definition} onChange={(e) => setForm({ ...form, done_definition: e.target.value })} />
      <button className="primary"><Plus size={18} /> Aufgabe hinzufügen</button>
    </form>
  );
}

function OrderForm({ form, setForm, profiles, submit }) {
  return (
    <form className="form" onSubmit={submit}>
      <input placeholder="Was muss bestellt werden?" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <textarea placeholder="Beschreibung / technische Details" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <input placeholder="Shop / Link" value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} />
      <input placeholder="Bestellnummer" value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} />
      <input placeholder="Menge" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
      <input placeholder="Preis" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
      <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
        <option value="">Verantwortlich</option>
        {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
      </select>
      <button className="primary"><Package size={18} /> Bestellung hinzufügen</button>
    </form>
  );
}

function TaskCard({ task, nameOf, moveTask, patchTask, deleteTask, profile, compact }) {
  const canDelete = profile?.is_pm || task.owner_id === profile?.id;
  return (
    <div className="taskCard">
      <div className="row">
        <strong>{task.title}</strong>
        <span className={`badge ${task.priority === "Hoch" ? "danger" : ""}`}>{task.priority}</span>
      </div>
      {!compact && <p>{task.description}</p>}
      <p className="muted">Owner: {nameOf(task.owner_id)} · {task.area} · Deadline: {task.deadline || "offen"}</p>
      {!compact && (
        <>
          <label>Ergebnis / Doku-Link für Review</label>
          <input value={task.evidence || ""} onChange={(e) => patchTask(task.id, { evidence: e.target.value })} placeholder="z. B. Test bestanden, Link, Foto, Notiz..." />
          <p className="muted">DoD: {task.done_definition || "Noch nicht definiert"}</p>
        </>
      )}
      <div className="row">
        <select value={task.status} onChange={(e) => moveTask(task, e.target.value)}>
          {columns.map((c) => <option key={c}>{c}</option>)}
        </select>
        {canDelete && <button className="iconBtn" onClick={() => deleteTask(task.id)}><Trash2 size={16} /></button>}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
