
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
const storyPointOptions = [1, 2, 3, 5, 8, 13];
const disciplines = ["Software", "Systems Engineering", "Electronics", "Mechanics", "Testing", "Manufacturing", "Documentation", "Project Management"];
const areaOptions = [
  { value: "Project Management", label: "Project Management" },
  { value: "Systems Engineering", label: "Systems Engineering" },
  { value: "Software", label: "Software" },
  { value: "Electronics", label: "Electronics" },
  { value: "Mechanics", label: "Mechanics" },
  { value: "Testing", label: "Testing" },
  { value: "Manufacturing", label: "Manufacturing / Build" },
  { value: "Documentation", label: "Documentation" },
];
const roleOptions = [
  "Project Manager",
  "Systems Engineer",
  "Software Developer",
  "Electronics Developer",
  "Mechanical Developer",
  "Test Engineer",
  "Manufacturing",
  "Documentation",
  "Team Member",
];
const roleAreaMap = {
  "Project Manager": "Project Management",
  "Systems Engineer": "Systems Engineering",
  "Software Developer": "Software",
  "Software Engineer": "Software",
  "Electronics Developer": "Electronics",
  "Electronics Engineer": "Electronics",
  "Mechanical Developer": "Mechanics",
  "Mechanical Engineer": "Mechanics",
  "Test Engineer": "Testing",
  "Manufacturing": "Manufacturing",
  "Documentation": "Documentation",
  "Team Member": "Project Management",
};
function roleToArea(role) { return roleAreaMap[role] || "Project Management"; }
function roleToIsPm(role) { return role === "Project Manager"; }
const workTypes = ["Organization", "Ordering", "Testing", "Manufacturing / Build", "Research", "Documentation", "Integration", "Meeting / Alignment", "Troubleshooting", "Design / Construction", "Review / Approval"];
const orderStatus = ["Needed", "Ordered", "Shipped", "Arrived"];
const meetingTypes = ["Sprint Planning", "Weekly", "Sprint Review", "Retrospective", "Extra Meeting"];
const levelRules = [
  { level: 1, title: "Project started", needed: 0 },
  { level: 2, title: "Team organized", needed: 2 },
  { level: 3, title: "Plan ready", needed: 5 },
  { level: 4, title: "Material secured", needed: 8 },
  { level: 5, title: "First prototype", needed: 12 },
  { level: 6, title: "Integration running", needed: 16 },
  { level: 7, title: "Demo ready", needed: 22 },
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
  const [milestones, setMilestones] = useState([]);
  const [infoItems, setInfoItems] = useState([]);
  const [genericFiles, setGenericFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => localStorage.getItem("admm-active-tab") || "dashboard");
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ email: "", password: "", displayName: "", role: "Software Developer", area: "Software" });
  const [taskForm, setTaskForm] = useState(emptyTask());
  const [sprintForm, setSprintForm] = useState(emptySprint());
  const [orderForm, setOrderForm] = useState(emptyOrder());
  const [blockerForm, setBlockerForm] = useState(emptyBlocker());
  const [scheduleForm, setScheduleForm] = useState(emptySchedule());
  const [meetingForm, setMeetingForm] = useState(emptyMeeting());
  const [milestoneForm, setMilestoneForm] = useState(emptyMilestone());
  const [infoForm, setInfoForm] = useState(emptyInfoItem());
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [message, setMessage] = useState("");
  const [celebration, setCelebration] = useState(false);

  const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("DEIN-PROJEKT"));

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, [isConfigured]);

  useEffect(() => {
    if (tab === "area" || tab === "pm") setTab("dashboard");
    else localStorage.setItem("admm-active-tab", tab);
  }, [tab]);

  useEffect(() => {
    if (!session?.user) return;
    loadAll();
    const channel = supabase
      .channel("admm-v4")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        loadAll();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session?.user?.id]);

  async function loadAll() {
    if (!session?.user) return;
    const [profileRes, profilesRes, tasksRes, sprintsRes, assigneesRes, depsRes, commentsRes, filesRes, ordersRes, blockersRes, scheduleRes, meetingsRes, notificationsRes, genericFilesRes, milestonesRes, infoItemsRes] = await Promise.all([
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
      supabase.from("generic_files").select("*").order("created_at", { ascending: false }),
      supabase.from("milestones").select("*").order("order_index", { ascending: true }),
      supabase.from("info_items").select("*").order("created_at", { ascending: false }),
    ]);
    if (!profileRes.data) {
      const fallbackName = session.user.email?.split("@")[0] || "Teammitglied";
      const insert = await supabase.from("profiles").insert({ id: session.user.id, display_name: fallbackName, role: "Software Developer", area: "Software", is_pm: false }).select().single();
      setProfile(insert.data);
    } else {
      const expectedArea = roleToArea(profileRes.data.role);
      const normalizedStoredArea = normalizeArea(profileRes.data.area);
      if (expectedArea && normalizedStoredArea !== expectedArea && profileRes.data.role !== "Team Member") {
        const fixedProfile = { ...profileRes.data, area: expectedArea, is_pm: roleToIsPm(profileRes.data.role) };
        setProfile(fixedProfile);
        await supabase.from("profiles").update({ area: expectedArea, is_pm: roleToIsPm(profileRes.data.role) }).eq("id", profileRes.data.id);
      } else {
        setProfile({ ...profileRes.data, area: normalizedStoredArea });
      }
    }
    setProfiles(profilesRes.data || []); setTasks(tasksRes.data || []); setSprints(sprintsRes.data || []);
    setAssignees(assigneesRes.data || []); setDependencies(depsRes.data || []); setComments(commentsRes.data || []);
    setFiles(filesRes.data || []); setOrders(ordersRes.data || []); setBlockers(blockersRes.data || []);
    setSchedule(scheduleRes.data || []); setMeetings(meetingsRes.data || []); setNotifications(notificationsRes.data || []); setGenericFiles(genericFilesRes.data || []); setMilestones(milestonesRes.data || []); setInfoItems(infoItemsRes.data || []);
    if (!selectedSprintId) {
      const active = (sprintsRes.data || []).find(s => s.status === "Active") || (sprintsRes.data || [])[0];
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
        role: authForm.role, area: authForm.area || roleToArea(authForm.role), is_pm: roleToIsPm(authForm.role)
      });
      setMessage("Account created. You can now sign in.");
      setAuthMode("signin");
    }
  }
  async function signIn(e) {
    e.preventDefault(); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
    if (error) setMessage(error.message);
  }
  async function patchProfile(patch) {
    if (!profile?.id) return;
    const normalizedPatch = {...patch};
    if (patch.role) {
      normalizedPatch.area = roleToArea(patch.role);
      normalizedPatch.is_pm = roleToIsPm(patch.role);
    }
    const { error } = await supabase.from("profiles").update(normalizedPatch).eq("id", profile.id);
    if (error) alert(error.message);
    else setProfile({...profile, ...normalizedPatch});
  }
  async function signOut() { await supabase.auth.signOut(); }

  const todayKey = new Date().toISOString().slice(0,10);
  const dateCurrentSprint = sprints.find(s => s.start_date && s.end_date && s.start_date <= todayKey && s.end_date >= todayKey);
  const activeSprint = dateCurrentSprint || sprints.find(s => s.status === "Active") || sprints[0];
  const selectedSprint = sprints.find(s => s.id === selectedSprintId) || activeSprint;
  const doneTasks = tasks.filter(t => t.status === "Done");
  const currentLevelNumber = sprintLevel(sprints);
  const currentLevel = { level: currentLevelNumber, title: `Sprint-Level ${currentLevelNumber}` };
  const nextLevel = null;
  const overdueTasks = tasks.filter(isOverdueTask);
  const backlogTasks = tasks;
  const sprintTasks = selectedSprint ? tasks.filter(t => t.sprint_id === selectedSprint.id) : [];
  const plannedPoints = sprintTasks.reduce((sum, t) => sum + Number(t.points || 0), 0);
  const activeSprintPoints = activeSprint ? sprintPoints(tasks, activeSprint.id) : {done:0,total:0};
  const myTaskIds = profile ? assignees.filter(a => a.profile_id === profile.id).map(a => a.task_id) : [];
  const myTasks = profile ? tasks.filter(t => t.owner_id === profile.id || myTaskIds.includes(t.id)) : [];
  const mySchedule = profile ? schedule.filter(s => s.profile_id === profile.id || appointmentVisibility(s) === "group") : [];
  const unreadNotifications = profile ? notifications.filter(n => n.profile_id === profile.id && !n.is_read) : [];

  function nameOf(id) { return profiles.find(p => p.id === id)?.display_name || "Unassigned"; }
  function assigneesOf(taskId) { return assignees.filter(a => a.task_id === taskId).map(a => profiles.find(p => p.id === a.profile_id)).filter(Boolean); }
  function commentsOf(taskId) { return comments.filter(c => c.task_id === taskId); }
  function filesOf(taskId) { return files.filter(f => f.task_id === taskId); }
  function depsOf(taskId) { return dependencies.filter(d => d.task_id === taskId).map(d => tasks.find(t => t.id === d.depends_on_task_id)).filter(Boolean); }
  function filesOfRecord(recordType, recordId) { return genericFiles.filter(f => f.record_type === recordType && f.record_id === recordId); }
  function normalizeArea(value) {
    const map = {
      PM: "Project Management",
      SE: "Systems Engineering",
      SW: "Software",
      EE: "Electronics",
      ME: "Mechanics",
      TEST: "Testing",
      MFG: "Manufacturing",
      DOC: "Documentation",
    };
    return map[value] || value || "Unassigned";
  }
  function displayArea(value) {
    return areaOptions.find(a => a.value === normalizeArea(value))?.label || normalizeArea(value);
  }
  function areaTasks(area) {
    const normalized = normalizeArea(area);
    return tasks.filter(t =>
      normalizeArea(t.discipline || t.area) === normalized ||
      normalizeArea(t.area) === normalized
    );
  }

  async function addTask(e, forceOwnerId = null) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    const primaryOwner = forceOwnerId || taskForm.owner_id || profile?.id;
    const payload = {
      title: taskForm.title, description: taskForm.description, owner_id: primaryOwner,
      area: taskForm.discipline, discipline: taskForm.discipline, work_type: taskForm.work_type,
      priority: taskForm.priority, deadline: taskForm.deadline || null, points: Number(taskForm.points || 3),
      status: taskForm.status, backlog_status: taskForm.sprint_id ? "In Sprint" : "Planned", sprint_id: taskForm.sprint_id || null,
      done_definition: taskForm.done_definition, evidence: taskForm.evidence, planned_start: taskForm.planned_start || null,
      planned_end: taskForm.planned_end || null, created_by: profile?.id
    };
    const { data, error } = await supabase.from("tasks").insert(payload).select().single();
    if (error) { alert(error.message); return; }
    const assigned = Array.from(new Set([primaryOwner, ...taskForm.assignee_ids].filter(Boolean)));
    if (assigned.length) await supabase.from("task_assignees").insert(assigned.map(profile_id => ({ task_id: data.id, profile_id })));
    if (taskForm.dependency_ids.length) await supabase.from("task_dependencies").insert(taskForm.dependency_ids.map(depends_on_task_id => ({ task_id: data.id, depends_on_task_id })));
    await notifyMany(assigned, "New task assigned", data.title);
    setTaskForm(emptyTask());
  }

  async function patchTask(id, patch) { const { error } = await supabase.from("tasks").update(patch).eq("id", id); if (error) alert(error.message); }
  async function deleteTask(id) {
    if (!confirm("Delete this task? It will be removed from backlog, sprints, assignments, comments, files and dependencies.")) return;

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
    const wasDone = isDoneStatus(task.status);
    await patchTask(task.id, { status: newStatus, backlog_status: newStatus === "Done" ? "Done" : "In Sprint" });
    if (newStatus === "Done" && !wasDone) {
      setCelebration(true);
      setTimeout(() => setCelebration(false), 1800);
    }
    await loadAll();
  }
  async function addTaskToSprint(taskId, sprintId) {
    if (!sprintId) {
      alert("There is no current sprint yet. Create a sprint under Sprints & Meetings and set it to Active.");
      return;
    }
    const { error } = await supabase
      .from("tasks")
      .update({ sprint_id: sprintId, backlog_status: "In Sprint", status: "To Do" })
      .eq("id", taskId);

    if (error) alert(error.message);
  }
  async function removeTaskFromSprint(taskId) { await patchTask(taskId, { sprint_id: null, backlog_status: "Planned", status: "Backlog" }); }

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

  async function uploadGenericFile(recordType, recordId, file) {
    if (!file || !recordId) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${recordType}/${recordId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from("task-files").upload(path, file);
    if (uploadError) { alert(uploadError.message); return; }
    const { data } = supabase.storage.from("task-files").getPublicUrl(path);
    const { error } = await supabase.from("generic_files").insert({
      record_type: recordType,
      record_id: recordId,
      profile_id: profile?.id,
      file_name: file.name,
      file_url: data.publicUrl,
      storage_path: path
    });
    if (error) alert(error.message);
  }

  async function deleteGenericFile(fileRow) {
    if (!confirm("Remove this file?")) return;
    if (fileRow.storage_path) await supabase.storage.from("task-files").remove([fileRow.storage_path]);
    const { error } = await supabase.from("generic_files").delete().eq("id", fileRow.id);
    if (error) alert(error.message);
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
    if (!confirm("Delete this sprint? Tasks will not be deleted; they will be moved back to the backlog.")) return;

    await supabase
      .from("tasks")
      .update({ sprint_id: null, backlog_status: "Planned", status: "Backlog" })
      .eq("sprint_id", id);

    const { error } = await supabase.from("sprints").delete().eq("id", id);
    if (error) alert(error.message);
    else if (selectedSprintId === id) setSelectedSprintId("");
  }
  async function addOrder(e) {
    e.preventDefault();
    if (!orderForm.name.trim()) {
      alert("Please enter what needs to be ordered.");
      return;
    }
    const payload = { ...orderForm, owner_id: orderForm.owner_id || profile?.id };
    const { error } = await supabase.from("orders").insert(payload);
    if (error) {
      alert(error.message);
      return;
    }
    setOrderForm(emptyOrder());
  }
  async function patchOrder(id, patch) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) alert(error.message);
  }
  async function deleteOrder(id) {
    if (!confirm("Delete this order?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) alert(error.message);
  }
  async function addBlocker(e) {
    e.preventDefault();
    if (!blockerForm.question.trim()) {
      alert("Please enter a question or blocker.");
      return;
    }
    const { error } = await supabase.from("blockers").insert({ ...blockerForm, owner_id: profile?.id, status: "Open", answer: "" });
    if (error) alert(error.message); else setBlockerForm(emptyBlocker());
  }
  async function patchBlocker(id, patch) {
    const { error } = await supabase.from("blockers").update(patch).eq("id", id);
    if (error) alert(error.message);
  }
  async function deleteBlocker(id) {
    if (!confirm("Delete this question / blocker?")) return;
    const { error } = await supabase.from("blockers").delete().eq("id", id);
    if (error) alert(error.message);
  }
  async function addSchedule(e) {
    e.preventDefault(); if (!scheduleForm.title.trim()) return;
    const { error } = await supabase.from("schedule_items").insert({ profile_id: profile.id, task_id: scheduleForm.task_id || null, title: scheduleForm.title, start_date: scheduleForm.start_date, end_date: scheduleForm.end_date || null, notes: scheduleForm.notes, visibility: scheduleForm.visibility || "private" });
    if (error) alert(error.message); else setScheduleForm(emptySchedule());
  }
  async function deleteSchedule(id) {
    if (!confirm("Delete this calendar entry?")) return;
    const { error } = await supabase.from("schedule_items").delete().eq("id", id);
    if (error) alert(error.message);
  }
  async function addMeeting(e) {
    e.preventDefault(); if (!meetingForm.title.trim()) return;
    const { error } = await supabase.from("meetings").insert({ ...meetingForm, sprint_id: meetingForm.sprint_id || null, created_by: profile?.id });
    if (error) alert(error.message); else setMeetingForm(emptyMeeting());
  }
  async function patchMeeting(id, patch) {
    const { error } = await supabase.from("meetings").update(patch).eq("id", id);
    if (error) alert(error.message);
  }
  async function deleteMeeting(id) {
    if (!confirm("Delete this meeting?")) return;
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) alert(error.message);
  }
  async function addMilestone(e) {
    e.preventDefault();
    if (!milestoneForm.title.trim()) return;
    const desiredOrder = Math.max(1, Number(milestoneForm.order_index || 1));

    const toShift = milestones
      .filter(m => Number(m.order_index || 1) >= desiredOrder)
      .sort((a,b) => Number(b.order_index || 1) - Number(a.order_index || 1));

    for (const item of toShift) {
      await supabase.from("milestones").update({
        order_index: Number(item.order_index || 1) + 1
      }).eq("id", item.id);
    }

    const { error } = await supabase.from("milestones").insert({
      title: milestoneForm.title,
      target_date: milestoneForm.target_date || null,
      description: milestoneForm.description || "",
      status: milestoneForm.status || "Planned",
      order_index: desiredOrder,
      created_by: profile?.id
    });
    if (error) alert(error.message);
    else {
      setMilestoneForm(emptyMilestone());
      await loadAll();
    }
  }
  async function patchMilestone(id, patch) {
    const { error } = await supabase.from("milestones").update(patch).eq("id", id);
    if (error) alert(error.message);
    else await loadAll();
  }
  async function deleteMilestone(id) {
    if (!confirm("Delete this milestone?")) return;
    const { error } = await supabase.from("milestones").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadAll();
  }
  async function addInfoItem(e) {
    e.preventDefault();
    if (!infoForm.title.trim()) return;
    const { error } = await supabase.from("info_items").insert({
      title: infoForm.title,
      description: infoForm.description || "",
      link_url: infoForm.link_url || "",
      created_by: profile?.id
    });
    if (error) alert(error.message);
    else {
      setInfoForm(emptyInfoItem());
      await loadAll();
    }
  }
  async function patchInfoItem(id, patch) {
    const { error } = await supabase.from("info_items").update(patch).eq("id", id);
    if (error) alert(error.message);
    else await loadAll();
  }
  async function deleteInfoItem(id) {
    if (!confirm("Delete this info item?")) return;
    const { error } = await supabase.from("info_items").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadAll();
  }
  async function notifyMany(profileIds, title, body) {
    const rows = profileIds.filter(Boolean).map(profile_id => ({ profile_id, title, body }));
    if (rows.length) await supabase.from("notifications").insert(rows);
  }

  if (loading) return <main className="page center">Loading...</main>;
  if (!isConfigured) return <main className="page center"><section className="loginCard"><h1>Supabase missing</h1><p>Check Vercel environment variables or your local .env.</p></section></main>;

  if (!session) return (
    <main className="page loginPage">
      <section className="loginCard">
        <div className="brandCircle"><Rocket /></div>
        <h1>ADMM Team Planner</h1>
        <p className="muted">Project workspace for backlog, sprints, calendar, files and team planning.</p>
        <div className="switch"><button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>Sign in</button><button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>Register</button></div>
        <form className="form" onSubmit={authMode === "signin" ? signIn : signUp}>
          {authMode === "signup" && <>
            <input placeholder="Name" value={authForm.displayName} onChange={e => setAuthForm({ ...authForm, displayName: e.target.value })} />
            <select value={authForm.role} onChange={e => {
              const nextRole = e.target.value;
              setAuthForm({ ...authForm, role: nextRole, area: roleToArea(nextRole) });
            }}>
              {roleOptions.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
            <select value={authForm.area} onChange={e => setAuthForm({ ...authForm, area: e.target.value })}>
              {areaOptions.map(area => <option key={area.value} value={area.value}>{area.label}</option>)}
            </select>
          </>}
          <input placeholder="Email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
          <input placeholder="Password" type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
          <button className="primary">{authMode === "signin" ? "Sign in" : "Create account"}</button>
        </form>{message && <p className="message">{message}</p>}
      </section>
    </main>
  );

  return (
    <main className="page">
      <header className="topbar">
        <div><p className="eyebrow">ADMM Team Planner</p><h1>Backlog · Sprints · Team Overview</h1><p className="muted">Current Sprint: {activeSprint?.name || "No Sprint yet"} · Goal: {activeSprint?.goal || "No goal yet"}</p></div>
        <UserBox profile={profile} email={session.user.email} unreadCount={unreadNotifications.length} patchProfile={patchProfile} signOut={signOut} displayArea={displayArea}/>
      </header>

      <section className="stats">
        <Stat icon={<Rocket/>} label="Current Sprint" value={activeSprint?.name || "-"} />
        <Stat icon={<ClipboardList/>} label="Backlog" value={backlogTasks.length} />
        <button className="statButton" onClick={() => setTab("overdue")}><Stat icon={<AlertTriangle/>} label="Overdue" value={overdueTasks.length} danger={overdueTasks.length > 0} /></button>
        <Stat icon={<Star/>} label={`Level ${currentLevel.level}`} value={currentLevel.title} />
      </section>

      <section className="levelCard">
        <div><h2>{activeSprint?.name || "No current sprint"}</h2><p>Level {currentLevel.level}: The level increases by 1 after every completed sprint.</p></div>
        <div className="capacity"><strong>{activeSprintPoints.done}/{activeSprintPoints.total}</strong><span>Story Points Done</span></div>
      </section>

      <nav className="tabs">
        {["dashboard","backlog","sprint","history","me","calendar","orders","blockers","meetings","gantt","milestones","info"].map(id => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {id === "area" ? `${displayArea(profile?.area)}-Übersicht` : labelForTab(id)}
          </button>
        ))}
        
      </nav>

      {tab === "dashboard" && <Dashboard activeSprint={activeSprint} tasks={tasks} sprintTasks={sprintTasks} overdueTasks={overdueTasks} orders={orders} blockers={blockers} currentLevel={currentLevel} plannedPoints={plannedPoints} />}
      {tab === "overdue" && <OverdueList tasks={overdueTasks} nameOf={nameOf} assigneesOf={assigneesOf} setTab={setTab} />}
      {tab === "backlog" && <Backlog tasks={backlogTasks} profiles={profiles} sprints={sprints} activeSprint={activeSprint} form={taskForm} setForm={setTaskForm} addTask={addTask} addTaskToSprint={addTaskToSprint} deleteTask={deleteTask} />}
      {tab === "sprint" && <SprintBoard sprints={sprints} activeSprint={selectedSprint} setSelectedSprintId={setSelectedSprintId} tasks={sprintTasks} profile={profile} nameOf={nameOf} assigneesOf={assigneesOf} depsOf={depsOf} commentsOf={commentsOf} filesOf={filesOf} moveTask={moveTask} patchTask={patchTask} deleteTask={deleteTask} addComment={addComment} uploadTaskFile={uploadTaskFile} removeTaskFromSprint={removeTaskFromSprint} />}
      {tab === "history" && <SprintHistory sprints={sprints} tasks={tasks} meetings={meetings} setSelectedSprintId={setSelectedSprintId} setTab={setTab} />}
      {tab === "me" && <MyArea profile={profile} tasks={myTasks} schedule={mySchedule} meetings={meetings} form={scheduleForm} setForm={setScheduleForm} addSchedule={addSchedule} deleteSchedule={deleteSchedule} nameOf={nameOf} assigneesOf={assigneesOf} commentsOf={commentsOf} filesOf={filesOf} moveTask={moveTask} patchTask={patchTask} deleteTask={deleteTask} addComment={addComment} uploadTaskFile={uploadTaskFile} />}
      {tab === "calendar" && <TeamCalendar sprints={sprints} tasks={tasks} schedule={schedule} meetings={meetings} profiles={profiles} assigneesOf={assigneesOf} nameOf={nameOf} />}
      {tab === "orders" && <Orders orders={orders} profiles={profiles} form={orderForm} setForm={setOrderForm} addOrder={addOrder} patchOrder={patchOrder} deleteOrder={deleteOrder} nameOf={nameOf} filesOfRecord={filesOfRecord} uploadGenericFile={uploadGenericFile} deleteGenericFile={deleteGenericFile} />}
      {tab === "blockers" && <Blockers blockers={blockers} form={blockerForm} setForm={setBlockerForm} addBlocker={addBlocker} patchBlocker={patchBlocker} deleteBlocker={deleteBlocker} nameOf={nameOf} filesOfRecord={filesOfRecord} uploadGenericFile={uploadGenericFile} deleteGenericFile={deleteGenericFile} />}
      {tab === "meetings" && <Meetings sprints={sprints} sprintForm={sprintForm} setSprintForm={setSprintForm} addSprint={addSprint} patchSprint={patchSprint} deleteSprint={deleteSprint} meetingForm={meetingForm} setMeetingForm={setMeetingForm} addMeeting={addMeeting} patchMeeting={patchMeeting} deleteMeeting={deleteMeeting} meetings={meetings} filesOfRecord={filesOfRecord} uploadGenericFile={uploadGenericFile} deleteGenericFile={deleteGenericFile} />}
      {tab === "gantt" && <Gantt tasks={tasks} sprints={sprints} />}
      {tab === "milestones" && <Milestones sprints={sprints} milestones={milestones} form={milestoneForm} setForm={setMilestoneForm} addMilestone={addMilestone} patchMilestone={patchMilestone} deleteMilestone={deleteMilestone} />}
      {tab === "info" && <InfoBoard items={infoItems} form={infoForm} setForm={setInfoForm} addInfoItem={addInfoItem} patchInfoItem={patchInfoItem} deleteInfoItem={deleteInfoItem} nameOf={nameOf} filesOfRecord={filesOfRecord} uploadGenericFile={uploadGenericFile} deleteGenericFile={deleteGenericFile} />}
      {celebration && <DoneFireworks />}
    </main>
  );
}

function labelForTab(id) {
  return ({dashboard:"Dashboard", backlog:"Backlog", sprint:"Current Sprint", history:"Sprint History", me:"My Area", orders:"Orders", blockers:"Questions & Blockers", calendar:"Team Calendar", meetings:"Sprints & Meetings", gantt:"Gantt", milestones:"Milestones", info:"Info Board"})[id];
}
function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function taskEndDate(task) {
  return task.planned_end || task.deadline || null;
}
function isDoneStatus(status) {
  return status === "Done" || status === "Erledigt";
}
function isCompletedSprint(status) {
  return status === "Completed" || status === "Abgeschlossen";
}
function appointmentVisibility(item) {
  return item.visibility || "private";
}
function isOverdueTask(task) {
  const end = taskEndDate(task);
  return Boolean(end && new Date(end) < startOfToday() && !isDoneStatus(task.status));
}

function parsePriceValue(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace("€", "").replace(/\s/g, "").replace(",", ".");
  const number = Number.parseFloat(cleaned);
  return Number.isFinite(number) ? number : 0;
}
function formatEuro(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(value || 0);
}
function downloadOrdersCsv(orders, nameOf) {
  const header = ["Part", "Description", "Supplier / Shop", "Order number", "Quantity", "Unit price", "Total price", "Status", "Owner", "Link"];
  const rows = orders.map(o => {
    const quantity = Number.parseFloat(String(o.quantity || "1").replace(",", ".")) || 1;
    const unitPrice = parsePriceValue(o.price);
    return [
      o.name || "",
      o.description || "",
      o.shop || "",
      o.order_number || "",
      o.quantity || "1",
      o.price || "",
      formatEuro(unitPrice * quantity),
      o.status || "",
      nameOf(o.owner_id),
      o.supplier_link || ""
    ];
  });
  const csv = [header, ...rows]
    .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "admm_bestellungen.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function sprintTone(sprintId) {
  if (!sprintId) return "sprint-tone-0";
  const chars = String(sprintId);
  let total = 0;
  for (let i = 0; i < chars.length; i++) total += chars.charCodeAt(i);
  return `sprint-tone-${(total % 8) + 1}`;
}
function personTone(profileId, profiles = []) {
  const index = Math.max(0, profiles.findIndex(p => p.id === profileId));
  return `person-${(index % 10) + 1}`;
}
function sprintLevel(sprints) { return sprints.filter(s => isCompletedSprint(s.status)).length + 1; }
function sprintPoints(tasks, sprintId) {
  const sprintTasks = tasks.filter(t => t.sprint_id === sprintId);
  const total = sprintTasks.reduce((sum, t) => sum + Number(t.points || 0), 0);
  const done = sprintTasks.filter(t => isDoneStatus(t.status)).reduce((sum, t) => sum + Number(t.points || 0), 0);
  return { done, total };
}
function getTaskRange(tasks) {
  const dates = tasks.flatMap(t => [t.planned_start, t.planned_end || t.deadline]).filter(Boolean).sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}
function daysBetweenDates(start, end) {
  const result = [];
  if (!start || !end) return result;
  const s = new Date(start); const e = new Date(end);
  s.setHours(12,0,0,0); e.setHours(12,0,0,0);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) result.push(d.toISOString().slice(0,10));
  return result;
}
function dateToColumn(date, days) {
  const index = days.indexOf(date);
  return index >= 0 ? index + 2 : 2;
}
function buildBurndownData(sprint, tasks) {
  const sprintTasks = tasks.filter(t => t.sprint_id === sprint.id);
  const total = sprintTasks.reduce((sum,t)=>sum+Number(t.points||0),0);
  const done = sprintTasks.filter(t => isDoneStatus(t.status)).reduce((sum,t)=>sum+Number(t.points||0),0);
  const dates = daysBetweenDates(sprint.start_date, sprint.end_date);
  if (!dates.length) return [{date:"Today", remaining: Math.max(0,total-done)}];
  return dates.map((date, index) => {
    const progress = dates.length === 1 ? 1 : index / (dates.length - 1);
    const estimatedDone = Math.round(done * progress);
    return {date, remaining: Math.max(0, total - estimatedDone)};
  });
}
function daysOverdue(dateString) { return Math.max(0, Math.ceil((startOfToday() - new Date(dateString)) / (1000*60*60*24))); }
function canMoveTask(task, newStatus, profile, taskAssignees, deps) {
  if (!profile) return { ok: false, message: "Please sign in." };
  const isOwner = task.owner_id === profile.id || taskAssignees.some(p => p.id === profile.id);
  if (!isOwner && !profile.is_pm) return { ok: false, message: "Only owners or the PM may move this task." };
  if (newStatus === "Doing" && (!task.description || !task.deadline)) return { ok: false, message: "To move to Doing, the task needs description and deadline." };
  if (newStatus === "Review" && (!task.done_definition || !task.evidence)) return { ok: false, message: "To move to Review, the task needs a Definition of Done and evidence/review notes." };
  if (newStatus === "Done" && task.status !== "Review") return { ok: false, message: "A task can only move to Done after Review." };
  if (newStatus === "Done" && deps.some(d => d.status !== "Done")) return { ok: false, message: "Dependencies are not Done yet." };
  return { ok: true };
}

function emptyTask(){return{title:"",description:"",owner_id:"",assignee_ids:[],dependency_ids:[],discipline:"Software",work_type:"Organization",priority:"P3",deadline:"",points:3,status:"Backlog",sprint_id:"",done_definition:"",evidence:"",planned_start:"",planned_end:""}}
function emptySprint(){return{name:"",goal:"",start_date:"",end_date:"",status:"Planned",capacity_points:0}}
function emptyOrder(){return{name:"",description:"",shop:"",order_number:"",quantity:"1",price:"",supplier_link:"",owner_id:"",status:"Needed"}}
function emptyBlocker(){return{question:"",tried:"",needed_from:""}}
function emptySchedule(){return{title:"",task_id:"",start_date:new Date().toISOString().slice(0,10),end_date:"",notes:"",visibility:"private"}}
function emptyMeeting(){return{sprint_id:"",meeting_type:"Weekly",title:"",meeting_date:new Date().toISOString().slice(0,10),participants:"",decisions:"",open_points:"",next_steps:""}}
function emptyMilestone(){return{title:"",target_date:new Date().toISOString().slice(0,10),description:"",status:"Planned",order_index:1}}
function emptyInfoItem(){return{title:"",description:"",link_url:""}}
function Stat({icon,label,value,danger}){return <div className={danger?"stat dangerStat":"stat"}><div className="statIcon">{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div>}
function Card({title,children}){return <section className="card"><h2>{title}</h2>{children}</section>}

function UserBox({profile,email,unreadCount,patchProfile,signOut,displayArea}) {
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState({display_name: profile?.display_name || "", role: profile?.role || "Team Member"});
  async function save() {
    await patchProfile({display_name: draft.display_name, role: draft.role});
    setEditing(false);
  }
  return <div className="userBox">
    {!editing ? <>
      <strong>{profile?.display_name || email}</strong>
      <span>{profile?.role} · {displayArea(profile?.area)}</span>
      <span>{unreadCount} new notifications</span>
      <div className="buttonRow"><button className="secondary" onClick={()=>setEditing(true)}>Edit profile</button><button className="secondary" onClick={signOut}><LogOut size={16}/> Logout</button></div>
    </> : <>
      <input value={draft.display_name} onChange={e=>setDraft({...draft,display_name:e.target.value})} placeholder="Name"/>
      <select value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})}>{roleOptions.map(role=><option key={role} value={role}>{role}</option>)}</select>
      <div className="buttonRow"><button className="primary" onClick={save}>Save</button><button className="secondary" onClick={()=>setEditing(false)}>Cancel</button></div>
    </>}
  </div>
}

function Dashboard({activeSprint,tasks,sprintTasks,overdueTasks,orders,blockers,currentLevel,plannedPoints}) {
  const sprintDonePoints = activeSprint ? sprintPoints(tasks, activeSprint.id).done : 0;
  const sprintTotalPoints = activeSprint ? sprintPoints(tasks, activeSprint.id).total : 0;
  return <section className="grid two">
    <Card title="Project Status">
      <ul className="checkList">
        <li>Current Sprint: {activeSprint?.name || "-"}</li>
        <li>Sprint Goal: {activeSprint?.goal || "-"}</li>
        <li>Sprint Tasks: {sprintTasks.length}</li>
        <li>Story Points Done: {sprintDonePoints}/{sprintTotalPoints}</li>
        <li>Done Tasks Total: {tasks.filter(t=>isDoneStatus(t.status)).length}</li>
        <li>Team Level: Level {currentLevel.level}</li>
      </ul>
    </Card>
    <Card title="Risks">
      <ul className="checkList">
        <li>Overdue tasks: {overdueTasks.length}</li>
        <li>Open orders: {orders.filter(o=>o.status!=="Arrived" && o.status!=="Angekommen").length}</li>
        <li>Open blockers: {blockers.filter(b=>b.status!=="Resolved" && b.status!=="Gelöst").length}</li>
      </ul>
    </Card>
  </section>
}

function OverdueList({tasks,nameOf,assigneesOf,setTab}) {
  return <section className="card">
    <div className="row">
      <h2>Overdue Tasks</h2>
      <button className="secondary" onClick={()=>setTab("dashboard")}>Back to Dashboard</button>
    </div>
    <p className="muted">A task is overdue only if its end date or deadline is in the past and it is not marked Done.</p>
    <div className="taskList">
      {tasks.length === 0 && <p className="empty">No overdue tasks.</p>}
      {tasks.map(t => <div className="itemCard dangerBorder" key={t.id}>
        <div className="row"><strong>{t.title}</strong><span className="badge danger">{taskEndDate(t)}</span></div>
        <p>{t.description || "No description."}</p>
        <p className="muted">Owner: {assigneesOf(t.id).map(p=>p.display_name).join(", ") || nameOf(t.owner_id)} · Status: {t.status} · {t.points || 0} SP</p>
      </div>)}
    </div>
  </section>
}

function Backlog({tasks,profiles,sprints,activeSprint,form,setForm,addTask,addTaskToSprint,deleteTask}) {
  return <section className="grid two">
    <Card title="New Backlog Task">
      <TaskForm form={form} setForm={setForm} profiles={profiles} sprints={sprints} allTasks={tasks} submit={addTask}/>
    </Card>
    <div>
      <h2>Backlog by Priority</h2>
      <p className="muted">All tasks stay visible. Click a task to show details.</p>
      <div className="taskList">
        {tasks.map(task=>
          <BacklogTaskCard key={task.id} task={task} profiles={profiles} activeSprint={activeSprint} addTaskToSprint={addTaskToSprint} deleteTask={deleteTask}/>
        )}
      </div>
    </div>
  </section>
}

function BacklogTaskCard({task,profiles,activeSprint,addTaskToSprint,deleteTask}) {
  const [open,setOpen] = useState(false);
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState({
    title: task.title || "",
    description: task.description || "",
    owner_id: task.owner_id || "",
    priority: task.priority || "P3",
    discipline: task.discipline || task.area || "Software",
    work_type: task.work_type || "Organization",
    points: task.points || 3,
    deadline: task.deadline || "",
    planned_start: task.planned_start || "",
    planned_end: task.planned_end || "",
    done_definition: task.done_definition || "",
    evidence: task.evidence || ""
  });
  async function saveBacklogTask() {
    const { error } = await supabase.from("tasks").update({
      title: draft.title,
      description: draft.description,
      owner_id: draft.owner_id || null,
      priority: draft.priority,
      area: draft.discipline,
      discipline: draft.discipline,
      work_type: draft.work_type,
      points: Number(draft.points || 3),
      deadline: draft.deadline || null,
      planned_start: draft.planned_start || null,
      planned_end: draft.planned_end || null,
      done_definition: draft.done_definition,
      evidence: draft.evidence
    }).eq("id", task.id);
    if (error) alert(error.message);
    else setEditing(false);
  }
  return <div className="itemCard compactTask">
    <div className="row clickable" onClick={()=>setOpen(!open)}>
      <strong>{task.title}</strong>
      <span className="badge">{task.priority} · {task.points} SP</span>
    </div>
    {open && !editing && <>
      <p>{task.description || "No description."}</p>
      <p className="muted">{task.discipline} · {task.work_type} · Deadline {task.deadline || "open"} · Period {task.planned_start || "open"} → {task.planned_end || task.deadline || "open"}</p>
      <p><b>Definition of Done:</b> {task.done_definition || "-"}</p>
      <p><b>Evidence:</b> {task.evidence || "-"}</p>
      <div className="buttonRow">
        <button className="secondary" onClick={()=>addTaskToSprint(task.id, activeSprint?.id)}>Move to current sprint</button>
        <button className="secondary" onClick={()=>setEditing(true)}>Edit</button>
        <button className="iconBtn" onClick={()=>deleteTask(task.id)} title="Delete task"><Trash2 size={16}/></button>
      </div>
    </>}
    {open && editing && <div className="form">
      <input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Title"/>
      <textarea value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Description"/>
      <select value={draft.owner_id} onChange={e=>setDraft({...draft,owner_id:e.target.value})}>
        <option value="">Main owner</option>
        {profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}
      </select>
      <div className="formRow">
        <select value={draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value})}>{priorities.map(p=><option key={p}>{p}</option>)}</select>
        <select value={draft.points} onChange={e=>setDraft({...draft,points:Number(e.target.value)})}>{storyPointOptions.map(p=><option key={p} value={p}>{p} SP</option>)}</select>
      </div>
      <select value={draft.discipline} onChange={e=>setDraft({...draft,discipline:e.target.value})}>{disciplines.map(d=><option key={d}>{d}</option>)}</select>
      <select value={draft.work_type} onChange={e=>setDraft({...draft,work_type:e.target.value})}>{workTypes.map(w=><option key={w}>{w}</option>)}</select>
      <div className="formRow"><input type="date" value={draft.planned_start || ""} onChange={e=>setDraft({...draft,planned_start:e.target.value})}/><input type="date" value={draft.planned_end || ""} onChange={e=>setDraft({...draft,planned_end:e.target.value})}/></div>
      <input type="date" value={draft.deadline || ""} onChange={e=>setDraft({...draft,deadline:e.target.value})}/>
      <textarea placeholder="Definition of Done" value={draft.done_definition || ""} onChange={e=>setDraft({...draft,done_definition:e.target.value})}/>
      <textarea placeholder="Evidence / Review notes" value={draft.evidence || ""} onChange={e=>setDraft({...draft,evidence:e.target.value})}/>
      <div className="buttonRow"><button className="primary" type="button" onClick={saveBacklogTask}>Save</button><button className="secondary" type="button" onClick={()=>setEditing(false)}>Cancel</button></div>
    </div>}
  </div>
}

function SprintBoard({sprints,activeSprint,setSelectedSprintId,tasks,profile,nameOf,assigneesOf,depsOf,commentsOf,filesOf,moveTask,patchTask,deleteTask,addComment,uploadTaskFile,removeTaskFromSprint}) {
  const points = activeSprint ? sprintPoints(tasks, activeSprint.id) : {done:0,total:0};
  return <section>
    <div className="toolbar">
      <select value={activeSprint?.id || ""} onChange={e=>setSelectedSprintId(e.target.value)}>{sprints.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <span>{activeSprint?.goal}</span>
      <strong>{points.done}/{points.total} Story Points</strong>
    </div>
    {activeSprint && <BurndownChart sprint={activeSprint} tasks={tasks}/>}
    <div className="kanban">{sprintColumns.map(col=><div className="column" key={col}><h3>{col}</h3>{tasks.filter(t=>t.status===col).map(task=><TaskCard key={task.id} task={task} profile={profile} nameOf={nameOf} assigneesOf={assigneesOf} depsOf={depsOf} comments={commentsOf(task.id)} files={filesOf(task.id)} moveTask={moveTask} patchTask={patchTask} deleteTask={deleteTask} addComment={addComment} uploadTaskFile={uploadTaskFile} removeTaskFromSprint={removeTaskFromSprint}/>)}</div>)}</div>
  </section>
}
function BurndownChart({sprint,tasks}) {
  const data = buildBurndownData(sprint, tasks);
  const max = Math.max(1, ...data.map(d=>Number(d.remaining || 0)));
  const points = data.map((d,i)=>{
    const x = data.length === 1 ? 10 : 10 + (i/(data.length-1))*80;
    const y = 90 - (Number(d.remaining || 0)/max)*75;
    return `${x},${y}`;
  }).join(" ");
  return <section className="card miniBurn">
    <div className="row"><h2>Burndown Chart</h2><span className="muted">Remaining Story Points</span></div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3"/></svg>
    <div className="chartLabels"><span>{data[0]?.date}</span><span>{data[data.length-1]?.date}</span></div>
  </section>
}

function SprintHistory({sprints,tasks,meetings,setSelectedSprintId,setTab}) {
  return <section className="taskList">
    {sprints.map(s=>{
      const st=tasks.filter(t=>t.sprint_id===s.id);
      const done=st.filter(t=>isDoneStatus(t.status)).length;
      const points=sprintPoints(tasks,s.id);
      return <div className="itemCard" key={s.id}>
        <div className="row">
          <strong>{s.name}</strong>
          <button className="secondary" onClick={()=>{setSelectedSprintId(s.id); setTab("sprint");}}>Open</button>
        </div>
        <p>{s.goal}</p>
        <p className="muted">{s.start_date} to {s.end_date} · {s.status} · {done}/{st.length} tasks done · {points.done}/{points.total} SP</p>
        <p><b>Meetings:</b> {meetings.filter(m=>m.sprint_id===s.id).length}</p>
      </div>
    })}
  </section>
}

function MyArea({profile,tasks,schedule,meetings,form,setForm,addSchedule,deleteSchedule,nameOf,assigneesOf,commentsOf,filesOf,moveTask,patchTask,deleteTask,addComment,uploadTaskFile}) {
  return <section className="grid two">
    <div className="stack">
      <MyCalendar tasks={tasks} schedule={schedule} meetings={meetings} form={form} setForm={setForm} addSchedule={addSchedule} deleteSchedule={deleteSchedule}/>
      <Card title="My Appointments as List">
        <div className="taskList">
          {schedule.map(s=><div className="itemCard" key={s.id}>
            <div className="row"><strong>{s.title}</strong><button className="iconBtn" onClick={()=>deleteSchedule(s.id)} title="Delete appointment"><Trash2 size={16}/></button></div>
            <p className="muted">{s.start_date}{s.end_date?` to ${s.end_date}`:""}</p><p>{s.notes}</p>
          </div>)}
        </div>
      </Card>
    </div>
    <div>
      <h2>My Tasks</h2>
      <p className="muted">Tasks assigned to you as main owner or additional owner appear here.</p>
      <div className="taskList">
        {tasks.length === 0 && <p className="empty">No assigned tasks.</p>}
        {tasks.map(t=><TaskCard key={t.id} task={t} profile={profile} nameOf={nameOf} assigneesOf={assigneesOf} depsOf={()=>[]} comments={commentsOf(t.id)} files={filesOf(t.id)} moveTask={moveTask} patchTask={patchTask} deleteTask={deleteTask} addComment={addComment} uploadTaskFile={uploadTaskFile}/>)}
      </div>
    </div>
  </section>
}


function getCalendarRange(viewDate, mode) {
  const base = new Date(viewDate);
  if (mode === "week") {
    const day = base.getDay() || 7;
    const start = new Date(base);
    start.setDate(base.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }

  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);

  const start = new Date(monthStart);
  const startDay = start.getDay() || 7;
  start.setDate(start.getDate() - startDay + 1);

  const end = new Date(monthEnd);
  const endDay = end.getDay() || 7;
  end.setDate(end.getDate() + (7 - endDay));

  return { start, end };
}

function fmtDate(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function shiftDate(date, mode, amount) {
  const next = new Date(date);
  if (mode === "week") next.setDate(next.getDate() + amount * 7);
  else next.setMonth(next.getMonth() + amount);
  return next;
}

function CalendarGrid({ items, title }) {
  const [mode, setMode] = useState("month");
  const [viewDate, setViewDate] = useState(new Date());
  const [openItemKey, setOpenItemKey] = useState("");
  const { start, end } = getCalendarRange(viewDate, mode);

  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const visibleItems = items.filter(item => {
    if (!item.start) return false;
    const itemStart = item.start;
    const itemEnd = item.end || item.start;
    return itemStart <= fmtDate(end) && itemEnd >= fmtDate(start);
  });

  const monthTitle = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function calendarRank(item) {
    if (item.tone === "sprint") return 0;
    if (item.tone === "meeting" || item.tone === "privateAppointment" || item.tone === "groupAppointment") return 1;
    return 2;
  }

  return <div className="calendarShell">
    <div className="calendarToolbar">
      <h2>{title}</h2>
      <div className="buttonRow">
        <button className="secondary" type="button" onClick={() => setViewDate(shiftDate(viewDate, mode, -1))}>Back</button>
        <select value={mode} onChange={e => setMode(e.target.value)}>
          <option value="month">Month</option>
          <option value="week">Week</option>
        </select>
        <button className="secondary" type="button" onClick={() => setViewDate(new Date())}>Today</button>
        <button className="secondary" type="button" onClick={() => setViewDate(shiftDate(viewDate, mode, 1))}>Next</button>
      </div>
    </div>
    <p className="muted">{mode === "month" ? monthTitle : `${fmtDate(start)} to ${fmtDate(end)}`}</p>
    <div className={mode === "week" ? "calendarGrid week" : "calendarGrid month"}>
      {days.map(day => {
        const dayKey = fmtDate(day);
        const dayItems = visibleItems
          .filter(item => item.start <= dayKey && (item.end || item.start) >= dayKey)
          .sort((a,b) => calendarRank(a) - calendarRank(b) || String(a.title).localeCompare(String(b.title)));
        return <div className="calendarDay" key={dayKey}>
          <div className="calendarDate">{day.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "2-digit" })}</div>
          {dayItems.map(item => {
            const itemKey = `${dayKey}-${item.id}`;
            const isOpen = openItemKey === itemKey;
            return <div className={`calendarPill ${item.tone || "task"}`} key={itemKey} onClick={() => setOpenItemKey(isOpen ? "" : itemKey)}>
              <strong>{item.title}</strong>
              {isOpen && <>
                <small>{item.type}</small>
                <small>{item.meta}</small>
                <small>{item.start}{item.end && item.end !== item.start ? ` → ${item.end}` : ""}</small>
              </>}
            </div>
          })}
        </div>
      })}
    </div>
  </div>
}

function TeamCalendar({sprints,tasks,schedule,meetings,profiles,assigneesOf,nameOf}) {
  const items = [
    ...sprints.map(s => ({
      id:`sprint-${s.id}`,
      type:"Sprint",
      title:s.name,
      start:s.start_date,
      end:s.end_date || s.start_date,
      meta:s.goal || s.status,
      tone:"sprint"
    })),
    ...schedule.filter(s => appointmentVisibility(s) === "group").map(s => ({
      id:`group-${s.id}`,
      type:"Group Appointment",
      title:s.title,
      start:s.start_date,
      end:s.end_date || s.start_date,
      meta:s.notes || nameOf(s.profile_id),
      tone:"groupAppointment"
    })),
    ...meetings.map(m => ({
      id:`meeting-${m.id}`,
      type:"Meeting",
      title:m.title,
      start:m.meeting_date,
      end:m.meeting_date,
      meta:`${m.meeting_type || ""} ${m.participants ? "· " + m.participants : ""}`,
      tone:"meeting"
    })),
    ...tasks.map(t => {
      const assigned = assigneesOf(t.id);
      const ownerId = assigned[0]?.id || t.owner_id;
      return {
        id:`task-${t.id}`,
        type:"Task",
        title:t.title,
        start:t.planned_start || t.deadline,
        end:t.planned_end || t.deadline,
        meta:`${nameOf(ownerId)} · ${t.discipline || t.area} · ${t.status} · ${t.priority}`,
        tone: personTone(ownerId, profiles)
      };
    }),
  ].filter(i=>i.start);

  return <section className="card">
    <CalendarGrid items={items} title="Team Calendar"/>
    <div className="personLegend">
      <span className="legendChip groupAppointment">Group appointment</span>
      <span className="legendChip sprint">Sprint</span>
      {profiles.map(p => <span key={p.id} className={`legendChip ${personTone(p.id, profiles)}`}>{p.display_name}</span>)}
    </div>
  </section>
}

function MyCalendar({tasks,schedule,meetings,form,setForm,addSchedule,deleteSchedule}) {
  const items = [
    ...tasks.map(t => ({ id:`task-${t.id}`, type:"Task", title:t.title, start:t.planned_start || t.deadline, end:t.planned_end || t.deadline, meta:`${t.status} · ${t.discipline || t.area}`, tone:"task" })),
    ...schedule.filter(s => appointmentVisibility(s) === "private").map(s => ({ id:`schedule-${s.id}`, type:"Private Appointment", title:s.title, start:s.start_date, end:s.end_date || s.start_date, meta:s.notes || "", tone:"privateAppointment" })),
    ...schedule.filter(s => appointmentVisibility(s) === "group").map(s => ({ id:`group-${s.id}`, type:"Group Appointment", title:s.title, start:s.start_date, end:s.end_date || s.start_date, meta:s.notes || "", tone:"groupAppointment" })),
    ...meetings.map(m => ({ id:`meeting-${m.id}`, type:"Meeting", title:m.title, start:m.meeting_date, end:m.meeting_date, meta:`${m.meeting_type || ""} ${m.participants ? "· " + m.participants : ""}`, tone:"meeting" })),
  ].filter(i=>i.start);
  return <section className="grid two">
    <Card title="Add Appointment"><ScheduleForm form={form} setForm={setForm} tasks={tasks} submit={addSchedule}/></Card>
    <section className="card"><CalendarGrid items={items} title="My Calendar"/></section>
  </section>
}

function Orders({orders,profiles,form,setForm,addOrder,patchOrder,deleteOrder,nameOf,filesOfRecord,uploadGenericFile,deleteGenericFile}) {
  const totalPrice = orders.reduce((sum,o)=>{
    const quantity = Number.parseFloat(String(o.quantity || "1").replace(",", ".")) || 1;
    return sum + parsePriceValue(o.price) * quantity;
  }, 0);

  return <section className="grid two">
    <Card title="Add Order">
      <OrderForm form={form} setForm={setForm} profiles={profiles} submit={addOrder}/>
      <div className="priceSummary">
        <strong>Total price of all orders</strong>
        <span>{formatEuro(totalPrice)}</span>
      </div>
      <button className="secondary" type="button" onClick={()=>downloadOrdersCsv(orders, nameOf)}>
        Export Excel-compatible CSV
      </button>
    </Card>
    <div className="taskList">
      <div className="ordersTableWrap">
        <table className="ordersTable">
          <thead>
            <tr>
              <th>Part</th>
              <th>Quantity</th>
              <th>Unit price</th>
              <th>Total</th>
              <th>Status</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const quantity = Number.parseFloat(String(o.quantity || "1").replace(",", ".")) || 1;
              const unitPrice = parsePriceValue(o.price);
              return <tr key={o.id}>
                <td>{o.name || "Ordering"}</td>
                <td>{o.quantity || "1"}</td>
                <td>{formatEuro(unitPrice)}</td>
                <td>{formatEuro(unitPrice * quantity)}</td>
                <td>{o.status}</td>
                <td>{nameOf(o.owner_id)}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
      {orders.map(o => <EditableOrder key={o.id} order={o} profiles={profiles} patchOrder={patchOrder} deleteOrder={deleteOrder} nameOf={nameOf} files={filesOfRecord("order", o.id)} uploadGenericFile={uploadGenericFile} deleteGenericFile={deleteGenericFile}/>)}
    </div>
  </section>
}
function EditableOrder({order,profiles,patchOrder,deleteOrder,nameOf,files,uploadGenericFile,deleteGenericFile}) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({...order});
  async function save() {
    await patchOrder(order.id, {
      name: draft.name || draft.item || "",
      description: draft.description || "",
      shop: draft.shop || "",
      order_number: draft.order_number || "",
      quantity: draft.quantity || "1",
      price: draft.price || "",
      supplier_link: draft.supplier_link || "",
      owner_id: draft.owner_id || null,
      status: draft.status || "Needed"
    });
    setEditing(false);
  }
  return <div className="itemCard">
    {!editing ? <>
      <div className="row"><strong>{order.name || order.item || "Ordering"}</strong><span className="badge">{order.status}</span></div>
      <p>{order.description}</p>
      <p className="muted">{order.shop} · {order.order_number} · Quantity {order.quantity || "1"} · Unit price {order.price || "-"} · Total {formatEuro(parsePriceValue(order.price) * (Number.parseFloat(String(order.quantity || "1").replace(",", ".")) || 1))} · {nameOf(order.owner_id)}</p>
      {order.supplier_link&&<a href={order.supplier_link} target="_blank" rel="noreferrer">Open link</a>}
    </> : <div className="form">
      <input value={draft.name || ""} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="What needs to be ordered?"/>
      <textarea value={draft.description || ""} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Description"/>
      <input value={draft.shop || ""} onChange={e=>setDraft({...draft,shop:e.target.value})} placeholder="Supplier / Shop"/>
      <input value={draft.order_number || ""} onChange={e=>setDraft({...draft,order_number:e.target.value})} placeholder="Order number"/>
      <input value={draft.supplier_link || ""} onChange={e=>setDraft({...draft,supplier_link:e.target.value})} placeholder="Link"/>
      <div className="formRow"><input value={draft.quantity || ""} onChange={e=>setDraft({...draft,quantity:e.target.value})} placeholder="Quantity"/><input value={draft.price || ""} onChange={e=>setDraft({...draft,price:e.target.value})} placeholder="Price"/></div>
      <select value={draft.owner_id || ""} onChange={e=>setDraft({...draft,owner_id:e.target.value})}><option value="">Owner</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select>
      <select value={draft.status || "Needed"} onChange={e=>setDraft({...draft,status:e.target.value})}>{orderStatus.map(s=><option key={s}>{s}</option>)}</select>
    </div>}
    <FileBox title="Files for order" files={files} onUpload={file=>uploadGenericFile("order", order.id, file)} onDelete={deleteGenericFile}/>
    <div className="buttonRow">
      {!editing ? <button className="secondary" onClick={()=>setEditing(true)}>Edit</button> : <><button className="primary" onClick={save}>Save</button><button className="secondary" onClick={()=>setEditing(false)}>Cancel</button></>}
      <select value={order.status} onChange={e=>patchOrder(order.id,{status:e.target.value})}>{orderStatus.map(s=><option key={s}>{s}</option>)}</select>
      <button className="iconBtn" onClick={()=>deleteOrder(order.id)} title="Ordering löschen"><Trash2 size={16}/></button>
    </div>
  </div>
}

function Blockers({blockers,form,setForm,addBlocker,patchBlocker,deleteBlocker,nameOf,filesOfRecord,uploadGenericFile,deleteGenericFile}) {
  const sortedBlockers = [...blockers].sort((a,b) => {
    if ((a.status === "Resolved") !== (b.status === "Resolved")) return a.status === "Resolved" ? 1 : -1;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
  return <section className="grid two">
    <Card title="Post Blocker">
      <form className="form" onSubmit={addBlocker}>
        <textarea placeholder="Problem / Question" value={form.question} onChange={e=>setForm({...form,question:e.target.value})}/>
        <textarea placeholder="Already tried" value={form.tried} onChange={e=>setForm({...form,tried:e.target.value})}/>
        <input placeholder="Help needed from" value={form.needed_from} onChange={e=>setForm({...form,needed_from:e.target.value})}/>
        <button className="primary"><HelpCircle size={18}/> Post</button>
      </form>
    </Card>
    <div className="taskList">
      {sortedBlockers.map(b => <EditableBlocker key={b.id} blocker={b} patchBlocker={patchBlocker} deleteBlocker={deleteBlocker} files={filesOfRecord("blocker", b.id)} uploadGenericFile={uploadGenericFile} deleteGenericFile={deleteGenericFile}/>)}
    </div>
  </section>
}
function EditableBlocker({blocker,patchBlocker,deleteBlocker,files,uploadGenericFile,deleteGenericFile}) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({...blocker});
  async function save() {
    await patchBlocker(blocker.id, {
      question: draft.question || "",
      tried: draft.tried || "",
      needed_from: draft.needed_from || "",
      answer: draft.answer || "",
      status: draft.status || "Open"
    });
    setEditing(false);
  }
  return <div className={blocker.status === "Resolved" ? "itemCard resolved" : "itemCard"}>
    {!editing ? <>
      <div className="row"><strong>{blocker.question}</strong><span className={blocker.status==="Resolved"?"badge done":"badge danger"}>{blocker.status}</span></div>
      <p><b>Already tried:</b> {blocker.tried || "-"}</p>
      <p><b>Help from:</b> {blocker.needed_from || "-"}</p>
      <p><b>Answer / Solution:</b> {blocker.answer || "No answer yet"}</p>
    </> : <div className="form">
      <textarea value={draft.question || ""} onChange={e=>setDraft({...draft,question:e.target.value})} placeholder="Frage / Problem"/>
      <textarea value={draft.tried || ""} onChange={e=>setDraft({...draft,tried:e.target.value})} placeholder="Already tried"/>
      <input value={draft.needed_from || ""} onChange={e=>setDraft({...draft,needed_from:e.target.value})} placeholder="Help needed from"/>
      <textarea value={draft.answer || ""} onChange={e=>setDraft({...draft,answer:e.target.value})} placeholder="Answer / Solution — jeder kann hier antworten"/>
      <select value={draft.status || "Open"} onChange={e=>setDraft({...draft,status:e.target.value})}>{["Open","In Clarification","Resolved"].map(s=><option key={s}>{s}</option>)}</select>
    </div>}
    <FileBox title="Files for question" files={files} onUpload={file=>uploadGenericFile("blocker", blocker.id, file)} onDelete={deleteGenericFile}/>
    <div className="buttonRow">
      {!editing ? <button className="secondary" onClick={()=>setEditing(true)}>Edit / Antworten</button> : <><button className="primary" onClick={save}>Save</button><button className="secondary" onClick={()=>setEditing(false)}>Cancel</button></>}
      <select value={blocker.status || "Open"} onChange={e=>patchBlocker(blocker.id,{status:e.target.value})}>{["Open","In Clarification","Resolved"].map(s=><option key={s}>{s}</option>)}</select>
      <button className="iconBtn" onClick={()=>deleteBlocker(blocker.id)} title="Blocker löschen"><Trash2 size={16}/></button>
    </div>
  </div>
}

function Meetings({sprints,sprintForm,setSprintForm,addSprint,patchSprint,deleteSprint,meetingForm,setMeetingForm,addMeeting,patchMeeting,deleteMeeting,meetings,filesOfRecord,uploadGenericFile,deleteGenericFile}) {
  return <section className="grid two">
    <div className="stack"><Card title="Create Sprint"><SprintForm form={sprintForm} setForm={setSprintForm} submit={addSprint}/></Card><Card title="Meeting"><MeetingForm form={meetingForm} setForm={setMeetingForm} sprints={sprints} submit={addMeeting}/></Card></div>
    <div className="stack">
      <h2>Sprints</h2>
      {sprints.map(s => <EditableSprint key={s.id} sprint={s} patchSprint={patchSprint} deleteSprint={deleteSprint} files={filesOfRecord("sprint", s.id)} uploadGenericFile={uploadGenericFile} deleteGenericFile={deleteGenericFile}/>)}
      <h2>Meetings</h2>
      {meetings.map(m => <EditableMeeting key={m.id} meeting={m} patchMeeting={patchMeeting} deleteMeeting={deleteMeeting} files={filesOfRecord("meeting", m.id)} uploadGenericFile={uploadGenericFile} deleteGenericFile={deleteGenericFile}/>)}
    </div>
  </section>
}
function EditableSprint({sprint,patchSprint,deleteSprint,files,uploadGenericFile,deleteGenericFile}) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({...sprint});
  async function save(){ await patchSprint(sprint.id, draft); setEditing(false); }
  return <div className="itemCard">
    {!editing ? <>
      <div className="row"><strong>{sprint.name}</strong><span className="badge">{sprint.status}</span></div>
      <p>{sprint.goal}</p><p className="muted">{sprint.start_date} bis {sprint.end_date} · Kapazität {sprint.capacity_points}</p>
    </> : <div className="form">
      <input value={draft.name || ""} onChange={e=>setDraft({...draft,name:e.target.value})}/>
      <textarea value={draft.goal || ""} onChange={e=>setDraft({...draft,goal:e.target.value})}/>
      <div className="formRow"><input type="date" value={draft.start_date || ""} onChange={e=>setDraft({...draft,start_date:e.target.value})}/><input type="date" value={draft.end_date || ""} onChange={e=>setDraft({...draft,end_date:e.target.value})}/></div>
      <input type="number" value={draft.capacity_points || 0} onChange={e=>setDraft({...draft,capacity_points:Number(e.target.value)})}/>
      <select value={draft.status || "Planned"} onChange={e=>setDraft({...draft,status:e.target.value})}>{["Planned","Active","Completed"].map(x=><option key={x}>{x}</option>)}</select>
    </div>}
    <FileBox title="Files for sprint" files={files} onUpload={file=>uploadGenericFile("sprint", sprint.id, file)} onDelete={deleteGenericFile}/>
    <div className="buttonRow">
      {!editing ? <button className="secondary" onClick={()=>setEditing(true)}>Edit</button> : <><button className="primary" onClick={save}>Save</button><button className="secondary" onClick={()=>setEditing(false)}>Cancel</button></>}
      <select value={sprint.status} onChange={e=>patchSprint(sprint.id,{status:e.target.value})}>{["Planned","Active","Completed"].map(x=><option key={x}>{x}</option>)}</select>
      <button className="iconBtn" onClick={()=>deleteSprint(sprint.id)}><Trash2 size={16}/></button>
    </div>
  </div>
}
function EditableMeeting({meeting,patchMeeting,deleteMeeting,files,uploadGenericFile,deleteGenericFile}) {
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState({...meeting});

  async function save() {
    await patchMeeting(meeting.id, {
      sprint_id: draft.sprint_id || null,
      meeting_type: draft.meeting_type || "Weekly",
      title: draft.title || "",
      meeting_date: draft.meeting_date || null,
      participants: draft.participants || "",
      decisions: draft.decisions || "",
      open_points: draft.open_points || "",
      next_steps: draft.next_steps || ""
    });
    setEditing(false);
  }

  return <div className="itemCard">
    {!editing ? <>
      <div className="row">
        <strong>{meeting.title}</strong>
        <button className="iconBtn" onClick={()=>deleteMeeting(meeting.id)} title="Protokoll löschen"><Trash2 size={16}/></button>
      </div>
      <p className="muted">{meeting.meeting_type} · {meeting.meeting_date}</p>
      <p><b>Partnehmer:</b> {meeting.participants || "-"}</p>
      <p><b>Decisions:</b> {meeting.decisions || "-"}</p>
      <p><b>Open:</b> {meeting.open_points || "-"}</p>
      <p><b>Next Steps:</b> {meeting.next_steps || "-"}</p>
    </> : <div className="form">
      <select value={draft.meeting_type || "Weekly"} onChange={e=>setDraft({...draft,meeting_type:e.target.value})}>
        {meetingTypes.map(t=><option key={t}>{t}</option>)}
      </select>
      <input value={draft.title || ""} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Title"/>
      <input type="date" value={draft.meeting_date || ""} onChange={e=>setDraft({...draft,meeting_date:e.target.value})}/>
      <textarea value={draft.participants || ""} onChange={e=>setDraft({...draft,participants:e.target.value})} placeholder="Partnehmer"/>
      <textarea value={draft.decisions || ""} onChange={e=>setDraft({...draft,decisions:e.target.value})} placeholder="Decisions"/>
      <textarea value={draft.open_points || ""} onChange={e=>setDraft({...draft,open_points:e.target.value})} placeholder="Opene Punkte"/>
      <textarea value={draft.next_steps || ""} onChange={e=>setDraft({...draft,next_steps:e.target.value})} placeholder="Next Steps"/>
    </div>}

    <FileBox title="Files for meeting" files={files} onUpload={file=>uploadGenericFile("meeting", meeting.id, file)} onDelete={deleteGenericFile}/>

    <div className="buttonRow">
      {!editing
        ? <button className="secondary" type="button" onClick={()=>setEditing(true)}>Edit Meeting</button>
        : <>
            <button className="primary" type="button" onClick={save}>Save</button>
            <button className="secondary" type="button" onClick={()=>setEditing(false)}>Cancel</button>
          </>
      }
    </div>
  </div>
}

function Gantt({tasks,sprints=[]}) {
  const weeks = buildGanttWeeks();
  const months = buildGanttMonths(weeks);

  const sprintNameById = (id) => sprints.find(s => s.id === id)?.name || "Unknown Sprint";

  const datedTasks = [...tasks]
    .filter(t => t.planned_start || t.planned_end || t.deadline)
    .sort((a,b) => {
      const sprintCompare = String(a.sprint_id || "zz-backlog").localeCompare(String(b.sprint_id || "zz-backlog"));
      if (sprintCompare !== 0) return sprintCompare;
      return String(a.planned_start || a.deadline || "").localeCompare(String(b.planned_start || b.deadline || ""));
    });

  const rows = [];
  let lastSprint = null;
  datedTasks.forEach(task => {
    const group = task.sprint_id ? sprintNameById(task.sprint_id) : "Backlog / No Sprint";
    if (group !== lastSprint) {
      rows.push({type:"group", id:`group-${group}`, title:group});
      lastSprint = group;
    }
    rows.push({type:"task", ...task});
  });

  return <section className="card">
    <h2>Gantt View</h2>
    {datedTasks.length === 0 && <p className="empty">No tasks with start/end date or deadline yet.</p>}

    {datedTasks.length > 0 && <div className="ganttPlannerScroll">
      <div className="ganttPlanner" style={{gridTemplateColumns:`280px repeat(${weeks.length}, 92px)`}}>
        <div className="ganttPlannerTaskHead">Taskname</div>
        {months.map(month => <div key={month.label} className="ganttPlannerMonth" style={{gridColumn:`${month.start + 2} / ${month.end + 3}`, gridRow: 1}}>{month.label}</div>)}
        <div className="ganttPlannerSubHead" style={{gridColumn: 1, gridRow: 2}}></div>
        {weeks.map((w,index) => <div key={w.key} className="ganttPlannerWeek" style={{gridColumn: index + 2, gridRow: 2}}>{w.week}W</div>)}

        {rows.map((rowItem, rowIndex) => {
          const row = rowIndex + 3;
          if (rowItem.type === "group") {
            return <React.Fragment key={rowItem.id}>
              <div className="ganttSprintGroup" style={{gridColumn: 1, gridRow: row}}>{rowItem.title}</div>
              {weeks.map((w,index) => <div key={`${rowItem.id}-${w.key}`} className="ganttSprintGroupCell" style={{gridColumn: index + 2, gridRow: row}}></div>)}
            </React.Fragment>
          }

          const task = rowItem;
          const taskStart = task.planned_start || task.deadline;
          const taskEnd = task.planned_end || task.deadline || taskStart;
          const startWeek = weekIndexForDate(taskStart, weeks);
          const endWeek = Math.max(startWeek + 1, weekIndexForDate(taskEnd, weeks) + 1);

          return <React.Fragment key={task.id}>
            <div className="ganttPlannerTask" style={{gridColumn: 1, gridRow: row}}><strong>{task.title}</strong></div>
            {weeks.map((w,index) => <div key={`${task.id}-${w.key}`} className="ganttPlannerCell" style={{gridColumn: index + 2, gridRow: row}}></div>)}
            <div className={`ganttPlannerBar ${sprintTone(task.sprint_id)}`} style={{gridColumn:`${startWeek + 2} / ${endWeek + 2}`, gridRow: row}} title={`${task.title}: ${taskStart} → ${taskEnd}`}></div>
          </React.Fragment>
        })}
      </div>
    </div>}
  </section>
}

function buildGanttWeeks() {
  const months = [
    {month: 4, label: "May 2026"},
    {month: 5, label: "Jun 2026"},
    {month: 6, label: "Jul 2026"},
  ];
  const weeks = [];
  months.forEach(monthInfo => {
    const year = 2026;
    const daysInMonth = new Date(year, monthInfo.month + 1, 0).getDate();
    for (let week = 1; week <= 5; week++) {
      const startDay = (week - 1) * 7 + 1;
      if (startDay > daysInMonth) continue;
      const endDay = Math.min(startDay + 6, daysInMonth);
      weeks.push({
        key: `${year}-${monthInfo.month + 1}-${week}`,
        week,
        monthLabel: monthInfo.label,
        start: new Date(year, monthInfo.month, startDay).toISOString().slice(0,10),
        end: new Date(year, monthInfo.month, endDay).toISOString().slice(0,10)
      });
    }
  });
  return weeks;
}
function buildGanttMonths(weeks) {
  const months = [];
  weeks.forEach((w, index) => {
    const existing = months.find(m => m.label === w.monthLabel);
    if (existing) existing.end = index;
    else months.push({label: w.monthLabel, start: index, end: index});
  });
  return months;
}
function weekIndexForDate(date, weeks) {
  if (!date || !weeks.length) return 0;
  const idx = weeks.findIndex(w => date >= w.start && date <= w.end);
  if (idx >= 0) return idx;
  if (date < weeks[0].start) return 0;
  return weeks.length - 1;
}

function Milestones({sprints,milestones,form,setForm,addMilestone,patchMilestone,deleteMilestone}) {
  const sorted = [...milestones].sort((a,b) => Number(a.order_index || 0) - Number(b.order_index || 0));

  return <section className="card">
    <h2>Milestones</h2>
    <p className="muted">Add as many milestones as you need. If you add a milestone with an existing order number, existing milestones move one step back.</p>

    <div className="manualMilestoneTimeline">
      {sorted.length === 0 && <p className="empty">No milestones yet.</p>}
      {sorted.map((m,index)=><EditableMilestone key={m.id} milestone={m} index={index + 1} isLast={index === sorted.length - 1} patchMilestone={patchMilestone} deleteMilestone={deleteMilestone}/>) }
    </div>

    <Card title="Add Milestone">
      <form className="form" onSubmit={addMilestone}>
        <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Milestone title"/>
        <input type="date" value={form.target_date || ""} onChange={e=>setForm({...form,target_date:e.target.value})}/>
        <select value={form.order_index || 1} onChange={e=>setForm({...form,order_index:Number(e.target.value)})}>{Array.from({length:20},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select>
        <textarea value={form.description || ""} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description"/>
        <select value={form.status || "Planned"} onChange={e=>setForm({...form,status:e.target.value})}>
          {["Planned","Active","Done"].map(s=><option key={s}>{s}</option>)}
        </select>
        <button className="primary">Add Milestone</button>
      </form>
    </Card>
  </section>
}

function EditableMilestone({milestone,index,isLast,patchMilestone,deleteMilestone}) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({...milestone});

  async function save() {
    await patchMilestone(milestone.id,{
      title:draft.title || "",
      target_date:draft.target_date || null,
      description:draft.description || "",
      status:draft.status || "Planned",
      order_index:Number(draft.order_index || index)
    });
    setEditing(false);
  }

  return <div className="manualMilestoneNode">
    {!editing ? <div className="manualMilestoneCard">
      <strong>#{milestone.order_index || index} {milestone.title}</strong>
      <span>{milestone.target_date || "No date"}</span>
      <small>{milestone.status}</small>
      <p>{milestone.description}</p>
      <div className="buttonRow">
        <button className="secondary" onClick={()=>setEditing(true)}>Edit</button>
        <button className="iconBtn" onClick={()=>deleteMilestone(milestone.id)}><Trash2 size={14}/></button>
      </div>
    </div> : <div className="manualMilestoneCard form">
      <input value={draft.title || ""} onChange={e=>setDraft({...draft,title:e.target.value})}/>
      <input type="date" value={draft.target_date || ""} onChange={e=>setDraft({...draft,target_date:e.target.value})}/>
      <select value={draft.order_index || index} onChange={e=>setDraft({...draft,order_index:Number(e.target.value)})}>{Array.from({length:20},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select>
      <textarea value={draft.description || ""} onChange={e=>setDraft({...draft,description:e.target.value})}/>
      <select value={draft.status || "Planned"} onChange={e=>setDraft({...draft,status:e.target.value})}>{["Planned","Active","Done"].map(s=><option key={s}>{s}</option>)}</select>
      <div className="buttonRow">
        <button className="primary" type="button" onClick={save}>Save</button>
        <button className="secondary" type="button" onClick={()=>setEditing(false)}>Cancel</button>
      </div>
    </div>}
    <div className="manualMilestoneStem"></div>
    {milestone.status === "Active" && <div className="workerIcon" title="Active milestone">👷</div>}
    {isLast && <div className="finishFlag" title="Final milestone">🚩</div>}
    <div className="manualMilestoneDot"></div>
  </div>
}

function DoneFireworks() {
  return <div className="doneFireworks" aria-label="Task completed">
    <span>🎆</span><span>✨</span><span>🎇</span><span>✨</span><span>🎆</span>
  </div>
}

function InfoBoard({items,form,setForm,addInfoItem,patchInfoItem,deleteInfoItem,nameOf,filesOfRecord,uploadGenericFile,deleteGenericFile}) {
  return <section className="grid two">
    <Card title="Add Info">
      <form className="form" onSubmit={addInfoItem}>
        <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title"/>
        <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description"/>
        <input value={form.link_url} onChange={e=>setForm({...form,link_url:e.target.value})} placeholder="Link"/>
        <button className="primary">Add Info</button>
      </form>
    </Card>
    <div className="taskList">
      {items.length === 0 && <p className="empty">No info items yet.</p>}
      {items.map(item => <EditableInfoItem
        key={item.id}
        item={item}
        patchInfoItem={patchInfoItem}
        deleteInfoItem={deleteInfoItem}
        nameOf={nameOf}
        files={filesOfRecord("info", item.id)}
        uploadGenericFile={uploadGenericFile}
        deleteGenericFile={deleteGenericFile}
      />)}
    </div>
  </section>
}

function EditableInfoItem({item,patchInfoItem,deleteInfoItem,nameOf,files,uploadGenericFile,deleteGenericFile}) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({...item});
  async function save() {
    await patchInfoItem(item.id,{
      title:draft.title || "",
      description:draft.description || "",
      link_url:draft.link_url || ""
    });
    setEditing(false);
  }
  return <div className="itemCard">
    {!editing ? <>
      <div className="row"><strong>{item.title}</strong><button className="iconBtn" onClick={()=>deleteInfoItem(item.id)}><Trash2 size={16}/></button></div>
      <p>{item.description}</p>
      {item.link_url && <a href={item.link_url} target="_blank" rel="noreferrer"><LinkIcon size={14}/> Open link</a>}
      <p className="muted">By {nameOf(item.created_by)}</p>
    </> : <div className="form">
      <input value={draft.title || ""} onChange={e=>setDraft({...draft,title:e.target.value})}/>
      <textarea value={draft.description || ""} onChange={e=>setDraft({...draft,description:e.target.value})}/>
      <input value={draft.link_url || ""} onChange={e=>setDraft({...draft,link_url:e.target.value})}/>
    </div>}
    <FileBox title="Files" files={files} onUpload={file=>uploadGenericFile("info", item.id, file)} onDelete={deleteGenericFile}/>
    <div className="buttonRow">
      {!editing ? <button className="secondary" onClick={()=>setEditing(true)}>Edit</button> : <>
        <button className="primary" onClick={save}>Save</button>
        <button className="secondary" onClick={()=>setEditing(false)}>Cancel</button>
      </>}
    </div>
  </div>
}

function TaskForm({form,setForm,profiles,sprints,allTasks,submit}) {
  function toggle(listName,id){const exists=form[listName].includes(id); setForm({...form,[listName]:exists?form[listName].filter(x=>x!==id):[...form[listName],id]})}
  return <form className="form" onSubmit={submit}><input placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><textarea placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><select value={form.owner_id} onChange={e=>setForm({...form,owner_id:e.target.value})}><option value="">Main owner</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select><label>Weitere Ownere</label><div className="chips">{profiles.map(p=><button type="button" key={p.id} className={form.assignee_ids.includes(p.id)?"chip selected":"chip"} onClick={()=>toggle("assignee_ids",p.id)}>{p.display_name}</button>)}</div><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{priorities.map(p=><option key={p}>{p}</option>)}</select><select value={form.discipline} onChange={e=>setForm({...form,discipline:e.target.value})}>{disciplines.map(d=><option key={d}>{d}</option>)}</select><select value={form.work_type} onChange={e=>setForm({...form,work_type:e.target.value})}>{workTypes.map(w=><option key={w}>{w}</option>)}</select><select value={form.sprint_id} onChange={e=>setForm({...form,sprint_id:e.target.value,status:e.target.value?"To Do":"Backlog"})}><option value="">Backlog</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><div className="formRow"><input type="date" value={form.planned_start} onChange={e=>setForm({...form,planned_start:e.target.value})}/><input type="date" value={form.planned_end} onChange={e=>setForm({...form,planned_end:e.target.value})}/></div><input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/><select value={form.points} onChange={e=>setForm({...form,points:Number(e.target.value)})}>{storyPointOptions.map(p=><option key={p} value={p}>{p} SP</option>)}</select><textarea placeholder="Definition of Done" value={form.done_definition} onChange={e=>setForm({...form,done_definition:e.target.value})}/><label>Abhängigkeiten</label><div className="chips">{(allTasks||[]).slice(0,20).map(t=><button type="button" key={t.id} className={form.dependency_ids.includes(t.id)?"chip selected":"chip"} onClick={()=>toggle("dependency_ids",t.id)}>{t.title}</button>)}</div><button className="primary"><Plus size={18}/> Aufgabe erstellen</button></form>
}

function TaskCard({task,profile,nameOf,assigneesOf,depsOf,comments,files,moveTask,patchTask,deleteTask,addComment,uploadTaskFile,removeTaskFromSprint}) {
  const [open,setOpen]=useState(false);
  const [comment,setComment]=useState("");
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({
    title: task.title || "",
    description: task.description || "",
    priority: task.priority || "P3",
    discipline: task.discipline || task.area || "Software",
    work_type: task.work_type || "Organization",
    deadline: task.deadline || "",
    points: task.points || 3,
    planned_start: task.planned_start || "",
    planned_end: task.planned_end || "",
    done_definition: task.done_definition || "",
    evidence: task.evidence || ""
  });
  const taskAssignees=assigneesOf(task.id);
  const deps=depsOf(task.id);
  async function saveEdit() {
    await patchTask(task.id, {...draft, area: draft.discipline, points: Number(draft.points || 3), deadline: draft.deadline || null, planned_start: draft.planned_start || null, planned_end: draft.planned_end || null});
    setEditing(false);
  }
  return <div className={task.deadline&&new Date(task.deadline)<startOfToday()&&task.status!=="Done"?"taskCard overdue":"taskCard"}>
    <div className="row clickable" onClick={()=>setOpen(!open)}><strong>{task.title}</strong><span className="badge">{task.priority} · {task.points} SP</span></div>
    {open && !editing && <>
      <p className="muted">{task.discipline} · {task.work_type} · Deadline {task.deadline||"open"}</p>
      <p className="muted">Owner: {taskAssignees.map(p=>p.display_name).join(", ")||nameOf(task.owner_id)}</p>
      <p>{task.description}</p>
      {deps.length>0&&<p className="muted"><GitBranch size={14}/> Depends on: {deps.map(d=>d.title).join(", ")}</p>}
      <p><b>Definition of Done:</b> {task.done_definition || "-"}</p>
      <p><b>Evidence:</b> {task.evidence || "-"}</p>
    </>}
    {open && editing && <div className="form">
      <input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/>
      <textarea value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/>
      <div className="formRow"><select value={draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value})}>{priorities.map(p=><option key={p}>{p}</option>)}</select><select value={draft.points} onChange={e=>setDraft({...draft,points:Number(e.target.value)})}>{storyPointOptions.map(p=><option key={p} value={p}>{p} SP</option>)}</select></div>
      <select value={draft.discipline} onChange={e=>setDraft({...draft,discipline:e.target.value})}>{disciplines.map(d=><option key={d}>{d}</option>)}</select>
      <select value={draft.work_type} onChange={e=>setDraft({...draft,work_type:e.target.value})}>{workTypes.map(w=><option key={w}>{w}</option>)}</select>
      <div className="formRow"><input type="date" value={draft.planned_start} onChange={e=>setDraft({...draft,planned_start:e.target.value})}/><input type="date" value={draft.planned_end} onChange={e=>setDraft({...draft,planned_end:e.target.value})}/></div>
      <input type="date" value={draft.deadline} onChange={e=>setDraft({...draft,deadline:e.target.value})}/>
      <textarea placeholder="Definition of Done" value={draft.done_definition} onChange={e=>setDraft({...draft,done_definition:e.target.value})}/>
      <textarea placeholder="Evidence / Review notes" value={draft.evidence} onChange={e=>setDraft({...draft,evidence:e.target.value})}/>
      <div className="buttonRow"><button className="primary" type="button" onClick={saveEdit}>Save</button><button className="secondary" type="button" onClick={()=>setEditing(false)}>Cancel</button></div>
    </div>}
    {open && <>
      <div className="miniSection"><h4><Paperclip size={15}/> Files</h4><input type="file" onChange={e=>uploadTaskFile(task.id,e.target.files?.[0])}/>{files.map(f=><a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"><LinkIcon size={14}/> {f.file_name}</a>)}</div>
      <div className="miniSection"><h4><MessageCircle size={15}/> Comments</h4>{comments.map(c=><p key={c.id} className="comment"><b>{nameOf(c.profile_id)}:</b> {c.body}</p>)}<div className="formRow"><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Comment"/><button type="button" className="secondary" onClick={()=>addComment(task.id,comment,()=>setComment(""))}>Send</button></div></div>
      <div className="row"><select value={task.status} onChange={e=>moveTask(task,e.target.value)}>{sprintColumns.map(c=><option key={c}>{c}</option>)}</select><div className="buttonRow"><button className="secondary" type="button" onClick={()=>setEditing(!editing)}>Edit</button>{removeTaskFromSprint&&<button className="secondary" onClick={()=>removeTaskFromSprint(task.id)}>Move back to Backlog</button>}<button className="iconBtn" onClick={()=>deleteTask(task.id)}><Trash2 size={16}/></button></div></div>
    </>}
  </div>
}

function FileBox({title,files,onUpload,onDelete}) {
  return <div className="miniSection">
    <h4><Paperclip size={15}/> {title}</h4>
    <input type="file" onChange={e=>onUpload(e.target.files?.[0])}/>
    {files?.length === 0 && <p className="muted">Noch keine Files.</p>}
    {files?.map(f => <div className="fileRow" key={f.id}>
      <a href={f.file_url} target="_blank" rel="noreferrer"><LinkIcon size={14}/> {f.file_name}</a>
      <button className="miniDelete" type="button" onClick={()=>onDelete(f)}><Trash2 size={12}/></button>
    </div>)}
  </div>
}

function OrderForm({form,setForm,profiles,submit}){return <form className="form" onSubmit={submit}><input placeholder="What needs to be ordered?" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><textarea placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><input placeholder="Lieferant / Supplier / Shop" value={form.shop} onChange={e=>setForm({...form,shop:e.target.value})}/><input placeholder="Order number" value={form.order_number} onChange={e=>setForm({...form,order_number:e.target.value})}/><input placeholder="Link" value={form.supplier_link} onChange={e=>setForm({...form,supplier_link:e.target.value})}/><input placeholder="Quantity" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/><input placeholder="Price" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/><select value={form.owner_id} onChange={e=>setForm({...form,owner_id:e.target.value})}><option value="">Owner</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select><button className="primary"><Package size={18}/> Add Order</button></form>}
function ScheduleForm({form,setForm,tasks,submit}){return <form className="form" onSubmit={submit}><input placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><select value={form.task_id} onChange={e=>setForm({...form,task_id:e.target.value})}><option value="">Ohne Aufgabe</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><div className="formRow"><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></div><textarea placeholder="Notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><select value={form.visibility || "private"} onChange={e=>setForm({...form,visibility:e.target.value})}><option value="private">Private Appointment</option><option value="group">Group Appointment</option></select><button className="primary"><CalendarDays size={18}/> Add</button></form>}
function SprintForm({form,setForm,submit}){return <form className="form" onSubmit={submit}><input placeholder="Sprintname" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><textarea placeholder="Sprint Goal" value={form.goal} onChange={e=>setForm({...form,goal:e.target.value})}/><div className="formRow"><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></div><input type="number" placeholder="Kapazität Story Points" value={form.capacity_points} onChange={e=>setForm({...form,capacity_points:Number(e.target.value)})}/><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{["Planned","Active","Completed"].map(s=><option key={s}>{s}</option>)}</select><button className="primary"><Rocket size={18}/> Sprint speichern</button></form>}
function MeetingForm({form,setForm,sprints,submit}){return <form className="form" onSubmit={submit}><select value={form.sprint_id} onChange={e=>setForm({...form,sprint_id:e.target.value})}><option value="">Kein Sprint</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={form.meeting_type} onChange={e=>setForm({...form,meeting_type:e.target.value})}>{meetingTypes.map(t=><option key={t}>{t}</option>)}</select><input placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><input type="date" value={form.meeting_date} onChange={e=>setForm({...form,meeting_date:e.target.value})}/><textarea placeholder="Partnehmer" value={form.participants} onChange={e=>setForm({...form,participants:e.target.value})}/><textarea placeholder="Decisions" value={form.decisions} onChange={e=>setForm({...form,decisions:e.target.value})}/><textarea placeholder="Opene Punkte" value={form.open_points} onChange={e=>setForm({...form,open_points:e.target.value})}/><textarea placeholder="Next Steps" value={form.next_steps} onChange={e=>setForm({...form,next_steps:e.target.value})}/><button className="primary"><FileText size={18}/> Protokoll speichern</button></form>}
createRoot(document.getElementById("root")).render(<App />);
