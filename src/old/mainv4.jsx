
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, FileText, HelpCircle,
  Link as LinkIcon, LogOut, MessageCircle, Package, Paperclip, Plus, Rocket,
  Star, Trash2, Users, GitBranch, BarChart3
} from "lucide-react";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sprintColumns = ["To Do", "Doing", "Review", "Done"];
const priorities = ["P1", "P2", "P3", "P4"];
const disciplines = ["Software", "Systems Engineering", "Electronics", "Mechanics", "Testing", "Manufacturing", "Dokumentation", "Project Management"];
const workTypes = ["Organisation", "Bestellung", "Testing", "Manufacturing / Bauen", "Recherche", "Dokumentation", "Integration", "Meeting / Abstimmung", "Fehlerbehebung", "Design / Konstruktion", "Review / Freigabe"];
const orderStatus = ["Benötigt", "Bestellt", "Versendet", "Angekommen"];
const meetingTypes = ["Sprint Planning", "Weekly", "Sprint Review", "Retrospective", "Extra Meeting"];
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
  const [sprints, setSprints] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [comments, setComments] = useState([]);
  const [files, setFiles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ email: "", password: "", displayName: "", role: "Member", area: "ME" });
  const [taskForm, setTaskForm] = useState(emptyTask());
  const [sprintForm, setSprintForm] = useState(emptySprint());
  const [orderForm, setOrderForm] = useState(emptyOrder());
  const [blockerForm, setBlockerForm] = useState(emptyBlocker());
  const [scheduleForm, setScheduleForm] = useState(emptySchedule());
  const [meetingForm, setMeetingForm] = useState(emptyMeeting());
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [message, setMessage] = useState("");

  const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("DEIN-PROJEKT"));

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, [isConfigured]);

  useEffect(() => {
    if (!session?.user) return;
    loadAll();
    const channel = supabase
      .channel("admm-v4")
      .on("postgres_changes", { event: "*", schema: "public" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session?.user?.id]);

  async function loadAll() {
    if (!session?.user) return;
    const [profileRes, profilesRes, tasksRes, sprintsRes, assigneesRes, depsRes, commentsRes, filesRes, ordersRes, blockersRes, scheduleRes, meetingsRes, notificationsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("tasks").select("*").order("priority", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("sprints").select("*").order("start_date", { ascending: false }),
      supabase.from("task_assignees").select("*"),
      supabase.from("task_dependencies").select("*"),
      supabase.from("task_comments").select("*").order("created_at", { ascending: true }),
      supabase.from("task_files").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("blockers").select("*").order("created_at", { ascending: false }),
      supabase.from("schedule_items").select("*").order("start_date", { ascending: true }),
      supabase.from("meetings").select("*").order("meeting_date", { ascending: false }),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    ]);
    if (!profileRes.data) {
      const fallbackName = session.user.email?.split("@")[0] || "Teammitglied";
      const insert = await supabase.from("profiles").insert({ id: session.user.id, display_name: fallbackName, role: "Member", area: "ME", is_pm: false }).select().single();
      setProfile(insert.data);
    } else setProfile(profileRes.data);
    setProfiles(profilesRes.data || []); setTasks(tasksRes.data || []); setSprints(sprintsRes.data || []);
    setAssignees(assigneesRes.data || []); setDependencies(depsRes.data || []); setComments(commentsRes.data || []);
    setFiles(filesRes.data || []); setOrders(ordersRes.data || []); setBlockers(blockersRes.data || []);
    setSchedule(scheduleRes.data || []); setMeetings(meetingsRes.data || []); setNotifications(notificationsRes.data || []);
    if (!selectedSprintId) {
      const active = (sprintsRes.data || []).find(s => s.status === "Aktiv") || (sprintsRes.data || [])[0];
      if (active) setSelectedSprintId(active.id);
    }
  }

  async function signUp(e) {
    e.preventDefault(); setMessage("");
    const { data, error } = await supabase.auth.signUp({ email: authForm.email, password: authForm.password });
    if (error) { setMessage(error.message); return; }
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id, display_name: authForm.displayName || authForm.email.split("@")[0],
        role: authForm.role, area: authForm.area, is_pm: false
      });
      setMessage("Account erstellt. Jetzt einloggen.");
      setAuthMode("signin");
    }
  }
  async function signIn(e) {
    e.preventDefault(); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
    if (error) setMessage(error.message);
  }
  async function signOut() { await supabase.auth.signOut(); }

  const activeSprint = sprints.find(s => s.id === selectedSprintId) || sprints.find(s => s.status === "Aktiv") || sprints[0];
  const doneTasks = tasks.filter(t => t.status === "Done");
  const currentLevel = [...levelRules].reverse().find(rule => doneTasks.length >= rule.needed) || levelRules[0];
  const nextLevel = levelRules.find(rule => rule.needed > doneTasks.length);
  const overdueTasks = tasks.filter(t => t.deadline && new Date(t.deadline) < startOfToday() && t.status !== "Done");
  const backlogTasks = tasks.filter(t => !t.sprint_id && t.backlog_status !== "Erledigt");
  const sprintTasks = activeSprint ? tasks.filter(t => t.sprint_id === activeSprint.id) : [];
  const plannedPoints = sprintTasks.reduce((sum, t) => sum + Number(t.points || 0), 0);
  const myTaskIds = profile ? assignees.filter(a => a.profile_id === profile.id).map(a => a.task_id) : [];
  const myTasks = profile ? tasks.filter(t => t.owner_id === profile.id || myTaskIds.includes(t.id)) : [];
  const mySchedule = profile ? schedule.filter(s => s.profile_id === profile.id) : [];
  const unreadNotifications = profile ? notifications.filter(n => n.profile_id === profile.id && !n.is_read) : [];

  function nameOf(id) { return profiles.find(p => p.id === id)?.display_name || "Nicht zugeordnet"; }
  function assigneesOf(taskId) { return assignees.filter(a => a.task_id === taskId).map(a => profiles.find(p => p.id === a.profile_id)).filter(Boolean); }
  function commentsOf(taskId) { return comments.filter(c => c.task_id === taskId); }
  function filesOf(taskId) { return files.filter(f => f.task_id === taskId); }
  function depsOf(taskId) { return dependencies.filter(d => d.task_id === taskId).map(d => tasks.find(t => t.id === d.depends_on_task_id)).filter(Boolean); }

  async function addTask(e, forceOwnerId = null) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    const primaryOwner = forceOwnerId || taskForm.owner_id || profile?.id;
    const payload = {
      title: taskForm.title, description: taskForm.description, owner_id: primaryOwner,
      area: taskForm.discipline, discipline: taskForm.discipline, work_type: taskForm.work_type,
      priority: taskForm.priority, deadline: taskForm.deadline || null, points: Number(taskForm.points || 3),
      status: taskForm.status, backlog_status: taskForm.sprint_id ? "Im Sprint" : "Geplant", sprint_id: taskForm.sprint_id || null,
      done_definition: taskForm.done_definition, evidence: taskForm.evidence, planned_start: taskForm.planned_start || null,
      planned_end: taskForm.planned_end || null, created_by: profile?.id
    };
    const { data, error } = await supabase.from("tasks").insert(payload).select().single();
    if (error) { alert(error.message); return; }
    const assigned = Array.from(new Set([primaryOwner, ...taskForm.assignee_ids].filter(Boolean)));
    if (assigned.length) await supabase.from("task_assignees").insert(assigned.map(profile_id => ({ task_id: data.id, profile_id })));
    if (taskForm.dependency_ids.length) await supabase.from("task_dependencies").insert(taskForm.dependency_ids.map(depends_on_task_id => ({ task_id: data.id, depends_on_task_id })));
    await notifyMany(assigned, "Neue Aufgabe zugewiesen", data.title);
    setTaskForm(emptyTask());
  }

  async function patchTask(id, patch) { const { error } = await supabase.from("tasks").update(patch).eq("id", id); if (error) alert(error.message); }
  async function deleteTask(id) {
    if (!confirm("Aufgabe wirklich löschen? Sie wird auch aus Backlog, Sprints, Verantwortlichkeiten, Kommentaren, Datei-Listen und Abhängigkeiten entfernt.")) return;

    const { data: taskFiles } = await supabase
      .from("task_files")
      .select("storage_path")
      .eq("task_id", id);

    const storagePaths = (taskFiles || [])
      .map(file => file.storage_path)
      .filter(Boolean);

    if (storagePaths.length) {
      await supabase.storage.from("task-files").remove(storagePaths);
    }

    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) alert(error.message);
  }
  async function moveTask(task, newStatus) {
    const check = canMoveTask(task, newStatus, profile, assigneesOf(task.id), depsOf(task.id));
    if (!check.ok) { alert(check.message); return; }
    await patchTask(task.id, { status: newStatus, backlog_status: newStatus === "Done" ? "Erledigt" : "Im Sprint" });
  }
  async function addTaskToSprint(taskId, sprintId) {
    if (!sprintId) {
      alert("Es gibt noch keinen aktuellen Sprint. Lege zuerst unter 'Sprints & Protokolle' einen Sprint an und setze ihn auf 'Aktiv'.");
      return;
    }
    const { error } = await supabase
      .from("tasks")
      .update({ sprint_id: sprintId, backlog_status: "Im Sprint", status: "To Do" })
      .eq("id", taskId);

    if (error) alert(error.message);
  }
  async function removeTaskFromSprint(taskId) { await patchTask(taskId, { sprint_id: null, backlog_status: "Geplant", status: "Backlog" }); }

  async function addComment(taskId, body, clear) {
    if (!body.trim()) return;
    const { error } = await supabase.from("task_comments").insert({ task_id: taskId, profile_id: profile?.id, body });
    if (!error) clear(); else alert(error.message);
  }
  async function uploadTaskFile(taskId, file) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${taskId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from("task-files").upload(path, file);
    if (uploadError) { alert(uploadError.message); return; }
    const { data } = supabase.storage.from("task-files").getPublicUrl(path);
    await supabase.from("task_files").insert({ task_id: taskId, profile_id: profile?.id, file_name: file.name, file_url: data.publicUrl, storage_path: path });
  }
  async function addSprint(e) {
    e.preventDefault(); if (!sprintForm.name.trim()) return;
    const { error } = await supabase.from("sprints").insert(sprintForm);
    if (error) alert(error.message); else setSprintForm(emptySprint());
  }
  async function patchSprint(id, patch) {
    const { error } = await supabase.from("sprints").update(patch).eq("id", id);
    if (error) alert(error.message);
  }
  async function deleteSprint(id) {
    if (!confirm("Sprint wirklich löschen? Aufgaben aus diesem Sprint werden nicht gelöscht, sondern zurück ins Backlog gesetzt.")) return;

    await supabase
      .from("tasks")
      .update({ sprint_id: null, backlog_status: "Geplant", status: "Backlog" })
      .eq("sprint_id", id);

    const { error } = await supabase.from("sprints").delete().eq("id", id);
    if (error) alert(error.message);
    else if (selectedSprintId === id) setSelectedSprintId("");
  }
  async function addOrder(e) {
    e.preventDefault(); if (!orderForm.name.trim()) return;
    const { error } = await supabase.from("orders").insert({ ...orderForm, owner_id: orderForm.owner_id || profile?.id });
    if (error) alert(error.message); else setOrderForm(emptyOrder());
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
    e.preventDefault(); if (!blockerForm.question.trim()) return;
    const { error } = await supabase.from("blockers").insert({ ...blockerForm, owner_id: profile?.id, status: "Offen", answer: "" });
    if (error) alert(error.message); else setBlockerForm(emptyBlocker());
  }
  async function patchBlocker(id, patch) {
    const { error } = await supabase.from("blockers").update(patch).eq("id", id);
    if (error) alert(error.message);
  }
  async function deleteBlocker(id) {
    if (!confirm("Frage / Blocker wirklich löschen?")) return;
    const { error } = await supabase.from("blockers").delete().eq("id", id);
    if (error) alert(error.message);
  }
  async function addSchedule(e) {
    e.preventDefault(); if (!scheduleForm.title.trim()) return;
    const { error } = await supabase.from("schedule_items").insert({ profile_id: profile.id, task_id: scheduleForm.task_id || null, title: scheduleForm.title, start_date: scheduleForm.start_date, end_date: scheduleForm.end_date || null, notes: scheduleForm.notes });
    if (error) alert(error.message); else setScheduleForm(emptySchedule());
  }
  async function deleteSchedule(id) {
    if (!confirm("Zeitplan-Eintrag wirklich löschen?")) return;
    const { error } = await supabase.from("schedule_items").delete().eq("id", id);
    if (error) alert(error.message);
  }
  async function addMeeting(e) {
    e.preventDefault(); if (!meetingForm.title.trim()) return;
    const { error } = await supabase.from("meetings").insert({ ...meetingForm, sprint_id: meetingForm.sprint_id || null, created_by: profile?.id });
    if (error) alert(error.message); else setMeetingForm(emptyMeeting());
  }
  async function deleteMeeting(id) {
    if (!confirm("Meeting-Protokoll wirklich löschen?")) return;
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) alert(error.message);
  }
  async function notifyMany(profileIds, title, body) {
    const rows = profileIds.filter(Boolean).map(profile_id => ({ profile_id, title, body }));
    if (rows.length) await supabase.from("notifications").insert(rows);
  }

  if (loading) return <main className="page center">Lade...</main>;
  if (!isConfigured) return <main className="page center"><section className="loginCard"><h1>Supabase fehlt</h1><p>Prüfe Vercel Environment Variables oder lokale .env.</p></section></main>;

  if (!session) return (
    <main className="page loginPage">
      <section className="loginCard">
        <div className="brandCircle"><Rocket /></div>
        <h1>ADMM Team Planner v4</h1>
        <p className="muted">Finale Version mit Backlog, Sprint-System, Historie, Uploads und PM-Dashboard.</p>
        <div className="switch"><button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>Einloggen</button><button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>Registrieren</button></div>
        <form className="form" onSubmit={authMode === "signin" ? signIn : signUp}>
          {authMode === "signup" && <>
            <input placeholder="Name" value={authForm.displayName} onChange={e => setAuthForm({ ...authForm, displayName: e.target.value })} />
            <input placeholder="Rolle" value={authForm.role} onChange={e => setAuthForm({ ...authForm, role: e.target.value })} />
            <select value={authForm.area} onChange={e => setAuthForm({ ...authForm, area: e.target.value })}>{["PM", "SE", "ME", "EE", "SW", "TEST", "MFG", "DOC"].map(a => <option key={a}>{a}</option>)}</select>
          </>}
          <input placeholder="E-Mail" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
          <input placeholder="Passwort" type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
          <button className="primary">{authMode === "signin" ? "Einloggen" : "Account erstellen"}</button>
        </form>{message && <p className="message">{message}</p>}
      </section>
    </main>
  );

  return (
    <main className="page">
      <header className="topbar">
        <div><p className="eyebrow">ADMM Team Planner v4</p><h1>Backlog · Sprints · PM-Übersicht</h1><p className="muted">Aktueller Sprint: {activeSprint?.name || "Noch kein Sprint"} · Ziel: {activeSprint?.goal || "Noch kein Ziel"}</p></div>
        <div className="userBox"><strong>{profile?.display_name || session.user.email}</strong><span>{profile?.role} · {profile?.area}</span><span>{unreadNotifications.length} neue Hinweise</span><button className="secondary" onClick={signOut}><LogOut size={16}/> Logout</button></div>
      </header>

      <section className="stats">
        <Stat icon={<Rocket/>} label="Aktueller Sprint" value={activeSprint?.name || "-"} />
        <Stat icon={<ClipboardList/>} label="Backlog" value={backlogTasks.length} />
        <Stat icon={<AlertTriangle/>} label="Überfällig" value={overdueTasks.length} danger={overdueTasks.length > 0} />
        <Stat icon={<Star/>} label={`Level ${currentLevel.level}`} value={currentLevel.title} />
      </section>

      <section className="levelCard">
        <div><h2>{activeSprint?.goal || "Sprint-Ziel fehlt"}</h2><p>{nextLevel ? `Noch ${nextLevel.needed - doneTasks.length} erledigte Aufgaben bis Level ${nextLevel.level}: ${nextLevel.title}` : "Maximallevel erreicht."}</p></div>
        <div className="capacity"><strong>{plannedPoints}/{activeSprint?.capacity_points || 0}</strong><span>Story Points geplant</span></div>
      </section>

      <nav className="tabs">
        {["dashboard","backlog","sprint","history","me","orders","blockers","meetings","gantt"].map(id => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{labelForTab(id)}</button>)}
        {profile?.is_pm && <button className={tab === "pm" ? "active" : ""} onClick={() => setTab("pm")}>PM-Dashboard</button>}
      </nav>

      {tab === "dashboard" && <Dashboard activeSprint={activeSprint} tasks={tasks} sprintTasks={sprintTasks} overdueTasks={overdueTasks} orders={orders} blockers={blockers} currentLevel={currentLevel} plannedPoints={plannedPoints} />}
      {tab === "backlog" && <Backlog tasks={backlogTasks} profiles={profiles} sprints={sprints} activeSprint={activeSprint} form={taskForm} setForm={setTaskForm} addTask={addTask} addTaskToSprint={addTaskToSprint} deleteTask={deleteTask} />}
      {tab === "sprint" && <SprintBoard sprints={sprints} activeSprint={activeSprint} setSelectedSprintId={setSelectedSprintId} tasks={sprintTasks} profile={profile} nameOf={nameOf} assigneesOf={assigneesOf} depsOf={depsOf} commentsOf={commentsOf} filesOf={filesOf} moveTask={moveTask} patchTask={patchTask} deleteTask={deleteTask} addComment={addComment} uploadTaskFile={uploadTaskFile} removeTaskFromSprint={removeTaskFromSprint} />}
      {tab === "history" && <SprintHistory sprints={sprints} tasks={tasks} meetings={meetings} setSelectedSprintId={setSelectedSprintId} />}
      {tab === "me" && <MyArea profile={profile} tasks={myTasks} schedule={mySchedule} form={scheduleForm} setForm={setScheduleForm} addSchedule={addSchedule} deleteSchedule={deleteSchedule} nameOf={nameOf} assigneesOf={assigneesOf} commentsOf={commentsOf} filesOf={filesOf} moveTask={moveTask} patchTask={patchTask} deleteTask={deleteTask} addComment={addComment} uploadTaskFile={uploadTaskFile} />}
      {tab === "orders" && <Orders orders={orders} profiles={profiles} form={orderForm} setForm={setOrderForm} addOrder={addOrder} patchOrder={patchOrder} deleteOrder={deleteOrder} nameOf={nameOf} />}
      {tab === "blockers" && <Blockers blockers={blockers} form={blockerForm} setForm={setBlockerForm} addBlocker={addBlocker} patchBlocker={patchBlocker} deleteBlocker={deleteBlocker} nameOf={nameOf} />}
      {tab === "meetings" && <Meetings sprints={sprints} sprintForm={sprintForm} setSprintForm={setSprintForm} addSprint={addSprint} patchSprint={patchSprint} deleteSprint={deleteSprint} meetingForm={meetingForm} setMeetingForm={setMeetingForm} addMeeting={addMeeting} deleteMeeting={deleteMeeting} meetings={meetings} />}
      {tab === "gantt" && <Gantt tasks={tasks} />}
      {tab === "pm" && profile?.is_pm && <PmDashboard overdueTasks={overdueTasks} tasks={tasks} blockers={blockers} orders={orders} activeSprint={activeSprint} plannedPoints={plannedPoints} assigneesOf={assigneesOf} nameOf={nameOf} patchTask={patchTask} />}
    </main>
  );
}

function labelForTab(id) {
  return ({dashboard:"Dashboard", backlog:"Backlog", sprint:"Aktueller Sprint", history:"Sprint-Historie", me:"Mein Bereich", orders:"Bestellungen", blockers:"Fragen & Blocker", meetings:"Sprints & Protokolle", gantt:"Gantt"})[id];
}
function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function daysOverdue(dateString) { return Math.max(0, Math.ceil((startOfToday() - new Date(dateString)) / (1000*60*60*24))); }
function canMoveTask(task, newStatus, profile, taskAssignees, deps) {
  if (!profile) return { ok: false, message: "Bitte einloggen." };
  const isOwner = task.owner_id === profile.id || taskAssignees.some(p => p.id === profile.id);
  if (!isOwner && !profile.is_pm) return { ok: false, message: "Nur Verantwortliche oder PM dürfen diese Aufgabe verschieben." };
  if (newStatus === "Doing" && (!task.description || !task.deadline)) return { ok: false, message: "Für Doing braucht die Aufgabe Beschreibung und Deadline." };
  if (newStatus === "Review" && (!task.done_definition || !task.evidence)) return { ok: false, message: "Für Review braucht die Aufgabe Definition of Done und Ergebnis/Doku." };
  if (newStatus === "Done" && task.status !== "Review") return { ok: false, message: "Eine Aufgabe darf erst nach Review auf Done." };
  if (newStatus === "Done" && deps.some(d => d.status !== "Done")) return { ok: false, message: "Abhängigkeiten sind noch nicht Done." };
  return { ok: true };
}

function emptyTask(){return{title:"",description:"",owner_id:"",assignee_ids:[],dependency_ids:[],discipline:"Software",work_type:"Organisation",priority:"P3",deadline:"",points:3,status:"Backlog",sprint_id:"",done_definition:"",evidence:"",planned_start:"",planned_end:""}}
function emptySprint(){return{name:"",goal:"",start_date:"",end_date:"",status:"Geplant",capacity_points:0}}
function emptyOrder(){return{name:"",description:"",shop:"",order_number:"",quantity:"1",price:"",supplier_link:"",owner_id:"",status:"Benötigt"}}
function emptyBlocker(){return{question:"",tried:"",needed_from:""}}
function emptySchedule(){return{title:"",task_id:"",start_date:new Date().toISOString().slice(0,10),end_date:"",notes:""}}
function emptyMeeting(){return{sprint_id:"",meeting_type:"Weekly",title:"",meeting_date:new Date().toISOString().slice(0,10),participants:"",decisions:"",open_points:"",next_steps:""}}
function Stat({icon,label,value,danger}){return <div className={danger?"stat dangerStat":"stat"}><div className="statIcon">{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div>}
function Card({title,children}){return <section className="card"><h2>{title}</h2>{children}</section>}

function Dashboard({activeSprint,tasks,sprintTasks,overdueTasks,orders,blockers,currentLevel,plannedPoints}) {
  return <section className="grid two"><Card title="Projektstatus"><ul className="checkList"><li>Aktueller Sprint: {activeSprint?.name || "-"}</li><li>Sprintziel: {activeSprint?.goal || "-"}</li><li>Sprint-Aufgaben: {sprintTasks.length}</li><li>Erledigte Aufgaben gesamt: {tasks.filter(t=>t.status==="Done").length}</li><li>Team-Level: {currentLevel.title}</li><li>Story Points geplant: {plannedPoints}/{activeSprint?.capacity_points || 0}</li></ul></Card><Card title="Risiken"><ul className="checkList"><li>Überfällig: {overdueTasks.length}</li><li>Offene Bestellungen: {orders.filter(o=>o.status!=="Angekommen").length}</li><li>Offene Blocker: {blockers.filter(b=>b.status!=="Gelöst").length}</li></ul></Card></section>
}

function Backlog({tasks,profiles,sprints,activeSprint,form,setForm,addTask,addTaskToSprint,deleteTask}) {
  return <section className="grid two"><Card title="Neue Backlog-Aufgabe"><TaskForm form={form} setForm={setForm} profiles={profiles} sprints={sprints} allTasks={tasks} submit={addTask}/></Card><div><h2>Backlog nach Priorität</h2><div className="taskList">{tasks.map(task=><div className="itemCard" key={task.id}><div className="row"><strong>{task.priority} · {task.title}</strong><div className="buttonRow"><button className="secondary" onClick={()=>addTaskToSprint(task.id, activeSprint?.id)}>In aktuellen Sprint</button><button className="iconBtn" onClick={()=>deleteTask(task.id)} title="Aufgabe löschen"><Trash2 size={16}/></button></div></div><p>{task.description}</p><p className="muted">{task.discipline} · {task.work_type} · {task.points} SP · Deadline {task.deadline || "offen"}</p></div>)}</div></div></section>
}

function SprintBoard({sprints,activeSprint,setSelectedSprintId,tasks,profile,nameOf,assigneesOf,depsOf,commentsOf,filesOf,moveTask,patchTask,deleteTask,addComment,uploadTaskFile,removeTaskFromSprint}) {
  return <section><div className="toolbar"><select value={activeSprint?.id || ""} onChange={e=>setSelectedSprintId(e.target.value)}>{sprints.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><span>{activeSprint?.goal}</span></div><div className="kanban">{sprintColumns.map(col=><div className="column" key={col}><h3>{col}</h3>{tasks.filter(t=>t.status===col).map(task=><TaskCard key={task.id} task={task} profile={profile} nameOf={nameOf} assigneesOf={assigneesOf} depsOf={depsOf} comments={commentsOf(task.id)} files={filesOf(task.id)} moveTask={moveTask} patchTask={patchTask} deleteTask={deleteTask} addComment={addComment} uploadTaskFile={uploadTaskFile} removeTaskFromSprint={removeTaskFromSprint}/>)}</div>)}</div></section>
}

function SprintHistory({sprints,tasks,meetings,setSelectedSprintId}) {
  return <section className="taskList">{sprints.map(s=>{const st=tasks.filter(t=>t.sprint_id===s.id); const done=st.filter(t=>t.status==="Done").length; return <div className="itemCard" key={s.id}><div className="row"><strong>{s.name}</strong><button className="secondary" onClick={()=>setSelectedSprintId(s.id)}>Öffnen</button></div><p>{s.goal}</p><p className="muted">{s.start_date} bis {s.end_date} · {s.status} · {done}/{st.length} erledigt</p><p><b>Protokolle:</b> {meetings.filter(m=>m.sprint_id===s.id).length}</p></div>})}</section>
}

function MyArea({profile,tasks,schedule,form,setForm,addSchedule,deleteSchedule,nameOf,assigneesOf,commentsOf,filesOf,moveTask,patchTask,deleteTask,addComment,uploadTaskFile}) {
  return <section className="grid two"><Card title="Mein Zeitplan"><ScheduleForm form={form} setForm={setForm} tasks={tasks} submit={addSchedule}/><div className="taskList">{schedule.map(s=><div className="itemCard" key={s.id}><div className="row"><strong>{s.title}</strong><button className="iconBtn" onClick={()=>deleteSchedule(s.id)} title="Zeitplan löschen"><Trash2 size={16}/></button></div><p className="muted">{s.start_date}{s.end_date?` bis ${s.end_date}`:""}</p><p>{s.notes}</p></div>)}</div></Card><div><h2>Meine Aufgaben</h2><div className="taskList">{tasks.map(t=><TaskCard key={t.id} task={t} profile={profile} nameOf={nameOf} assigneesOf={assigneesOf} depsOf={()=>[]} comments={commentsOf(t.id)} files={filesOf(t.id)} moveTask={moveTask} patchTask={patchTask} deleteTask={deleteTask} addComment={addComment} uploadTaskFile={uploadTaskFile}/>)}</div></div></section>
}

function Orders({orders,profiles,form,setForm,addOrder,patchOrder,deleteOrder,nameOf}) {
  return <section className="grid two"><Card title="Bestellung hinzufügen"><OrderForm form={form} setForm={setForm} profiles={profiles} submit={addOrder}/></Card><div className="taskList">{orders.map(o=><div className="itemCard" key={o.id}><div className="row"><strong>{o.name}</strong><div className="buttonRow"><select value={o.status} onChange={e=>patchOrder(o.id,{status:e.target.value})}>{orderStatus.map(s=><option key={s}>{s}</option>)}</select><button className="iconBtn" onClick={()=>deleteOrder(o.id)} title="Bestellung löschen"><Trash2 size={16}/></button></div></div><p>{o.description}</p><p className="muted">{o.shop} · {o.order_number} · {o.price} · {nameOf(o.owner_id)}</p>{o.supplier_link&&<a href={o.supplier_link} target="_blank">Link öffnen</a>}</div>)}</div></section>
}

function Blockers({blockers,form,setForm,addBlocker,patchBlocker,deleteBlocker,nameOf}) {
  return <section className="grid two"><Card title="Blocker posten"><form className="form" onSubmit={addBlocker}><textarea placeholder="Problem" value={form.question} onChange={e=>setForm({...form,question:e.target.value})}/><textarea placeholder="Schon versucht" value={form.tried} onChange={e=>setForm({...form,tried:e.target.value})}/><input placeholder="Hilfe benötigt von" value={form.needed_from} onChange={e=>setForm({...form,needed_from:e.target.value})}/><button className="primary"><HelpCircle size={18}/> Posten</button></form></Card><div className="taskList">{blockers.map(b=><div className="itemCard" key={b.id}><div className="row"><strong>{b.question}</strong><div className="buttonRow"><span className={b.status==="Gelöst"?"badge done":"badge danger"}>{b.status}</span><button className="iconBtn" onClick={()=>deleteBlocker(b.id)} title="Blocker löschen"><Trash2 size={16}/></button></div></div><p>{b.tried}</p><textarea value={b.answer||""} onChange={e=>patchBlocker(b.id,{answer:e.target.value})}/><button className="secondary" onClick={()=>patchBlocker(b.id,{status:b.status==="Gelöst"?"Offen":"Gelöst"})}>Status wechseln</button></div>)}</div></section>
}

function Meetings({sprints,sprintForm,setSprintForm,addSprint,patchSprint,deleteSprint,meetingForm,setMeetingForm,addMeeting,deleteMeeting,meetings}) {
  return <section className="grid two"><div className="stack"><Card title="Sprint anlegen"><SprintForm form={sprintForm} setForm={setSprintForm} submit={addSprint}/></Card><Card title="Meeting-Protokoll"><MeetingForm form={meetingForm} setForm={setMeetingForm} sprints={sprints} submit={addMeeting}/></Card></div><div className="stack"><h2>Sprints</h2>{sprints.map(s=><div className="itemCard" key={s.id}><div className="row"><strong>{s.name}</strong><div className="buttonRow"><select value={s.status} onChange={e=>patchSprint(s.id,{status:e.target.value})}>{["Geplant","Aktiv","Abgeschlossen"].map(x=><option key={x}>{x}</option>)}</select><button className="iconBtn" onClick={()=>deleteSprint(s.id)} title="Sprint löschen"><Trash2 size={16}/></button></div></div><p>{s.goal}</p><p className="muted">{s.start_date} bis {s.end_date} · Kapazität {s.capacity_points}</p></div>)}<h2>Protokolle</h2>{meetings.map(m=><div className="itemCard" key={m.id}><div className="row"><strong>{m.title}</strong><button className="iconBtn" onClick={()=>deleteMeeting(m.id)} title="Protokoll löschen"><Trash2 size={16}/></button></div><p className="muted">{m.meeting_type} · {m.meeting_date}</p><p><b>Entscheidungen:</b> {m.decisions}</p><p><b>Offen:</b> {m.open_points}</p><p><b>Nächste Schritte:</b> {m.next_steps}</p></div>)}</div></section>
}

function Gantt({tasks}) {
  return <section className="card"><h2>Gantt-Ansicht</h2><div className="gantt">{tasks.filter(t=>t.planned_start||t.deadline).map(t=><div className="ganttRow" key={t.id}><span>{t.title}</span><div className="ganttBar">{t.planned_start || "Start offen"} → {t.planned_end || t.deadline || "Ende offen"}</div></div>)}</div></section>
}

function PmDashboard({overdueTasks,tasks,blockers,orders,activeSprint,plannedPoints,assigneesOf,nameOf,patchTask}) {
  return <section className="grid two"><Card title="Überfällige Aufgaben">{overdueTasks.length===0&&<p className="empty">Keine überfälligen Aufgaben.</p>}<div className="taskList">{overdueTasks.map(t=><div className="itemCard dangerBorder" key={t.id}><strong>{t.title}</strong><p className="muted">{daysOverdue(t.deadline)} Tage überfällig · {t.status}</p><p>{assigneesOf(t.id).map(p=>p.display_name).join(", ") || nameOf(t.owner_id)}</p><textarea placeholder="Verzögerungsgrund" value={t.delay_reason||""} onChange={e=>patchTask(t.id,{delay_reason:e.target.value})}/></div>)}</div></Card><Card title="PM-Risiken"><ul className="checkList"><li>Überfällig: {overdueTasks.length}</li><li>Offene Blocker: {blockers.filter(b=>b.status!=="Gelöst").length}</li><li>Bestellungen offen: {orders.filter(o=>o.status!=="Angekommen").length}</li><li>Sprint-Auslastung: {plannedPoints}/{activeSprint?.capacity_points||0}</li></ul></Card></section>
}

function TaskForm({form,setForm,profiles,sprints,allTasks,submit}) {
  function toggle(listName,id){const exists=form[listName].includes(id); setForm({...form,[listName]:exists?form[listName].filter(x=>x!==id):[...form[listName],id]})}
  return <form className="form" onSubmit={submit}><input placeholder="Titel" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><textarea placeholder="Beschreibung" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><select value={form.owner_id} onChange={e=>setForm({...form,owner_id:e.target.value})}><option value="">Hauptverantwortliche/r</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select><label>Weitere Verantwortliche</label><div className="chips">{profiles.map(p=><button type="button" key={p.id} className={form.assignee_ids.includes(p.id)?"chip selected":"chip"} onClick={()=>toggle("assignee_ids",p.id)}>{p.display_name}</button>)}</div><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{priorities.map(p=><option key={p}>{p}</option>)}</select><select value={form.discipline} onChange={e=>setForm({...form,discipline:e.target.value})}>{disciplines.map(d=><option key={d}>{d}</option>)}</select><select value={form.work_type} onChange={e=>setForm({...form,work_type:e.target.value})}>{workTypes.map(w=><option key={w}>{w}</option>)}</select><select value={form.sprint_id} onChange={e=>setForm({...form,sprint_id:e.target.value,status:e.target.value?"To Do":"Backlog"})}><option value="">Backlog</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><div className="formRow"><input type="date" value={form.planned_start} onChange={e=>setForm({...form,planned_start:e.target.value})}/><input type="date" value={form.planned_end} onChange={e=>setForm({...form,planned_end:e.target.value})}/></div><input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/><input type="number" min="1" value={form.points} onChange={e=>setForm({...form,points:Number(e.target.value)})}/><textarea placeholder="Definition of Done" value={form.done_definition} onChange={e=>setForm({...form,done_definition:e.target.value})}/><label>Abhängigkeiten</label><div className="chips">{(allTasks||[]).slice(0,20).map(t=><button type="button" key={t.id} className={form.dependency_ids.includes(t.id)?"chip selected":"chip"} onClick={()=>toggle("dependency_ids",t.id)}>{t.title}</button>)}</div><button className="primary"><Plus size={18}/> Aufgabe erstellen</button></form>
}

function TaskCard({task,profile,nameOf,assigneesOf,depsOf,comments,files,moveTask,patchTask,deleteTask,addComment,uploadTaskFile,removeTaskFromSprint}) {
  const [comment,setComment]=useState(""); const taskAssignees=assigneesOf(task.id); const canDelete=true; const deps=depsOf(task.id);
  return <div className={task.deadline&&new Date(task.deadline)<startOfToday()&&task.status!=="Done"?"taskCard overdue":"taskCard"}><div className="row"><strong>{task.priority} · {task.title}</strong><span className="badge">{task.points} SP</span></div><p className="muted">{task.discipline} · {task.work_type} · Deadline {task.deadline||"offen"}</p><p className="muted">Verantwortlich: {taskAssignees.map(p=>p.display_name).join(", ")||nameOf(task.owner_id)}</p><p>{task.description}</p>{deps.length>0&&<p className="muted"><GitBranch size={14}/> Abhängig von: {deps.map(d=>d.title).join(", ")}</p>}<label>Evidence / Review-Doku</label><input value={task.evidence||""} onChange={e=>patchTask(task.id,{evidence:e.target.value})}/><div className="miniSection"><h4><Paperclip size={15}/> Dateien</h4><input type="file" onChange={e=>uploadTaskFile(task.id,e.target.files?.[0])}/>{files.map(f=><a key={f.id} href={f.file_url} target="_blank"><LinkIcon size={14}/> {f.file_name}</a>)}</div><div className="miniSection"><h4><MessageCircle size={15}/> Kommentare</h4>{comments.map(c=><p key={c.id} className="comment"><b>{nameOf(c.profile_id)}:</b> {c.body}</p>)}<div className="formRow"><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Kommentar"/><button type="button" className="secondary" onClick={()=>addComment(task.id,comment,()=>setComment(""))}>Senden</button></div></div><div className="row"><select value={task.status} onChange={e=>moveTask(task,e.target.value)}>{sprintColumns.map(c=><option key={c}>{c}</option>)}</select><div className="buttonRow">{removeTaskFromSprint&&<button className="secondary" onClick={()=>removeTaskFromSprint(task.id)}>Zurück ins Backlog</button>}{canDelete&&<button className="iconBtn" onClick={()=>deleteTask(task.id)}><Trash2 size={16}/></button>}</div></div></div>
}

function OrderForm({form,setForm,profiles,submit}){return <form className="form" onSubmit={submit}><input placeholder="Was muss bestellt werden?" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><textarea placeholder="Beschreibung" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><input placeholder="Lieferant / Shop" value={form.shop} onChange={e=>setForm({...form,shop:e.target.value})}/><input placeholder="Bestellnummer" value={form.order_number} onChange={e=>setForm({...form,order_number:e.target.value})}/><input placeholder="Link" value={form.supplier_link} onChange={e=>setForm({...form,supplier_link:e.target.value})}/><input placeholder="Menge" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/><input placeholder="Preis" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/><select value={form.owner_id} onChange={e=>setForm({...form,owner_id:e.target.value})}><option value="">Verantwortlich</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select><button className="primary"><Package size={18}/> Bestellung hinzufügen</button></form>}
function ScheduleForm({form,setForm,tasks,submit}){return <form className="form" onSubmit={submit}><input placeholder="Titel" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><select value={form.task_id} onChange={e=>setForm({...form,task_id:e.target.value})}><option value="">Ohne Aufgabe</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><div className="formRow"><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></div><textarea placeholder="Notizen" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button className="primary"><CalendarDays size={18}/> Eintragen</button></form>}
function SprintForm({form,setForm,submit}){return <form className="form" onSubmit={submit}><input placeholder="Sprintname" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><textarea placeholder="Sprintziel" value={form.goal} onChange={e=>setForm({...form,goal:e.target.value})}/><div className="formRow"><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></div><input type="number" placeholder="Kapazität Story Points" value={form.capacity_points} onChange={e=>setForm({...form,capacity_points:Number(e.target.value)})}/><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{["Geplant","Aktiv","Abgeschlossen"].map(s=><option key={s}>{s}</option>)}</select><button className="primary"><Rocket size={18}/> Sprint speichern</button></form>}
function MeetingForm({form,setForm,sprints,submit}){return <form className="form" onSubmit={submit}><select value={form.sprint_id} onChange={e=>setForm({...form,sprint_id:e.target.value})}><option value="">Kein Sprint</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={form.meeting_type} onChange={e=>setForm({...form,meeting_type:e.target.value})}>{meetingTypes.map(t=><option key={t}>{t}</option>)}</select><input placeholder="Titel" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><input type="date" value={form.meeting_date} onChange={e=>setForm({...form,meeting_date:e.target.value})}/><textarea placeholder="Teilnehmer" value={form.participants} onChange={e=>setForm({...form,participants:e.target.value})}/><textarea placeholder="Entscheidungen" value={form.decisions} onChange={e=>setForm({...form,decisions:e.target.value})}/><textarea placeholder="Offene Punkte" value={form.open_points} onChange={e=>setForm({...form,open_points:e.target.value})}/><textarea placeholder="Nächste Schritte" value={form.next_steps} onChange={e=>setForm({...form,next_steps:e.target.value})}/><button className="primary"><FileText size={18}/> Protokoll speichern</button></form>}
createRoot(document.getElementById("root")).render(<App />);
