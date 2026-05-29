"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import emailjs from "@emailjs/browser";

interface Contributor {
  name: string;
  email: string;
  github: string;
  role: string;
  access: string;
  added: string;
}

interface Project {
  id: string;
  name: string;
  repo: string;
  description: string;
  color: string;
  private?: boolean;
  stars?: number;
  updatedAt?: string;
}

const T = {
  bg: "#0a0b0f",
  bgGrid: "rgba(255,255,255,0.015)",
  surface: "#11131a",
  surfaceRaised: "#161924",
  surfaceHover: "#1a1e2b",
  border: "#1f2330",
  borderStrong: "#2a3042",
  text: "#eef0f5",
  textMute: "#7a8194",
  textFaint: "#4a5060",
  accent: "#6366f1",
  accentGlow: "rgba(99, 102, 241, 0.12)",
  accentText: "#a5b4fc",
  green: "#22c55e",
  greenSoft: "rgba(34, 197, 94, 0.12)",
  red: "#ef4444",
  redSoft: "rgba(239, 68, 68, 0.12)",
  amber: "#f59e0b",
  amberSoft: "rgba(245, 158, 11, 0.12)",
  blue: "#3b82f6",
  blueSoft: "rgba(59, 130, 246, 0.12)",
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

const PROJECT_COLORS = ["#6366f1", "#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#14b8a6"];

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const avatarBg = (name: string) => {
  const colors = [T.accent, T.blue, T.green, T.amber, "#ec4899", "#14b8a6"];
  return colors[name.charCodeAt(0) % colors.length];
};

const timeAgo = (date: string) => {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
};

export default function AdminDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", github: "", role: "", access: "Write" });
  const [activity, setActivity] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "contributors" | "activity">("overview");
  const adminEmail = auth.currentUser?.email || "mgodimgodi6@gmail.com";

  // ── Load repos on mount ──────────────────────────────
  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((data) => {
        if (data.repos && data.repos.length > 0) {
          const colored: Project[] = data.repos.map((r: any, i: number) => ({
            ...r,
            color: PROJECT_COLORS[i % PROJECT_COLORS.length],
          }));
          setProjects(colored);
          setActiveProject(colored[0]);
        }
        setLoadingProjects(false);
      })
      .catch(() => setLoadingProjects(false));
  }, []);

  // ── Fetch activity for a specific project ────────────
  const fetchActivityForProject = useCallback(async (project: Project) => {
    setLoadingActivity(true);
    setActivity([]);
    setPrs([]);
    setRuns([]);
    try {
      const res = await fetch(`/api/activity?repo=${encodeURIComponent(project.repo)}`);
      const data = await res.json();
      setActivity(Array.isArray(data.commits) ? data.commits : []);
      setPrs(Array.isArray(data.prs) ? data.prs : []);
      setRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch (err) {
      console.error("Activity fetch error:", err);
    }
    setLoadingActivity(false);
  }, []);

  // ── When active project changes ──────────────────────
  useEffect(() => {
    if (!activeProject) return;
    // Load contributors for this project
    const saved = localStorage.getItem(`contributors_${activeProject.id}`);
    setContributors(saved ? JSON.parse(saved) : []);
    // Load activity for this project
    fetchActivityForProject(activeProject);
  }, [activeProject, fetchActivityForProject]);

  // ── Switch project ───────────────────────────────────
  const switchProject = (project: Project) => {
    if (activeProject?.id === project.id) return;
    setActiveProject(project);
    setActiveTab("overview");
    setShowForm(false);
  };

  // ── Notifications ────────────────────────────────────
  const notifications = [
    ...prs.map((pr) => ({
      kind: pr.merged_at ? "merged" : pr.state === "open" ? "open" : "closed",
      text: pr.merged_at ? `PR merged: ${pr.title}` : pr.state === "open" ? `PR opened: ${pr.title}` : `PR closed: ${pr.title}`,
      who: pr.user?.login,
      when: pr.created_at,
    })),
    ...runs.map((r) => ({
      kind: r.conclusion === "success" ? "pass" : r.conclusion === "failure" ? "fail" : "run",
      text: r.conclusion === "success" ? `Build passed: ${r.name}` : r.conclusion === "failure" ? `Build failed: ${r.name}` : `Build running: ${r.name}`,
      who: r.actor?.login,
      when: r.created_at,
    })),
  ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  // ── Stats ────────────────────────────────────────────
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const commitsThisWeek = activity.filter((c) => new Date(c.commit?.author?.date).getTime() > oneWeekAgo).length;
  const prsMerged = prs.filter((pr) => pr.merged_at).length;
  const finishedRuns = runs.filter((r) => r.conclusion === "success" || r.conclusion === "failure");
  const buildSuccessRate = finishedRuns.length === 0 ? 0 : Math.round((finishedRuns.filter((r) => r.conclusion === "success").length / finishedRuns.length) * 100);
  const activeContributors = new Set(activity.map((c) => c.commit?.author?.name).filter(Boolean)).size;

  const dailyCommits = Array.from({ length: 7 }, (_, i) => {
    const dayStart = Date.now() - (6 - i) * 86400000;
    const dayEnd = dayStart + 86400000;
    return activity.filter((c) => {
      const t = new Date(c.commit?.author?.date).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
  });
  const maxDaily = Math.max(...dailyCommits, 1);

  // ── Contributors ─────────────────────────────────────
  const saveContributors = (list: Contributor[]) => {
    if (!activeProject) return;
    setContributors(list);
    localStorage.setItem(`contributors_${activeProject.id}`, JSON.stringify(list));
  };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const addContributor = async () => {
    if (!activeProject) return;
    if (!form.name || !form.email || !form.github || !form.role) return showToast("Please fill in all fields", "error");
    setSending(true);
    const today = new Date().toISOString().split("T")[0];
    try {
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
        { contributor_name: form.name, project_name: activeProject.name, admin_name: adminEmail, role: form.role, access: form.access, date: today, repo_url: `https://github.com/${activeProject.repo}`, to_email: form.email },
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
      );
      saveContributors([...contributors, { ...form, added: today }]);
      setForm({ name: "", email: "", github: "", role: "", access: "Write" });
      setShowForm(false);
      showToast(`${form.name} added and invite sent`, "success");
    } catch (err) {
      showToast("Failed to send invite email", "error");
      console.error(err);
    }
    setSending(false);
  };

  const removeContributor = (index: number) => {
    if (confirm(`Remove ${contributors[index].name}?`)) {
      saveContributors(contributors.filter((_, i) => i !== index));
      showToast(`${contributors[index].name} removed`, "success");
    }
  };

  const changeAccess = (index: number, access: string) => {
    const updated = [...contributors];
    updated[index].access = access;
    saveContributors(updated);
    showToast(`Access updated for ${updated[index].name}`, "success");
  };

  const statusStyles = (kind: string) => {
    const map: Record<string, { dot: string; bg: string; fg: string }> = {
      merged: { dot: T.accent, bg: T.accentGlow, fg: T.accentText },
      pass: { dot: T.green, bg: T.greenSoft, fg: "#86efac" },
      fail: { dot: T.red, bg: T.redSoft, fg: "#fca5a5" },
      closed: { dot: T.red, bg: T.redSoft, fg: "#fca5a5" },
      open: { dot: T.blue, bg: T.blueSoft, fg: "#93c5fd" },
      run: { dot: T.amber, bg: T.amberSoft, fg: "#fcd34d" },
    };
    return map[kind] || map.run;
  };

  const Icon = ({ d, size = 14 }: { d: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );

  const projectColor = activeProject?.color || T.accent;

  if (loadingProjects) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg, color: T.textMute, fontFamily: T.font, flexDirection: "column", gap: "1rem" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `linear-gradient(135deg, ${T.accent}, ${T.blue})` }} />
        <p style={{ fontSize: "0.85rem" }}>Loading projects...</p>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, fontSize: "13px", letterSpacing: "-0.005em",
      backgroundImage: `linear-gradient(${T.bgGrid} 1px, transparent 1px), linear-gradient(90deg, ${T.bgGrid} 1px, transparent 1px)`,
      backgroundSize: "32px 32px",
    }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" />
      <style>{`
        * { box-sizing: border-box; }
        button, input, select { font-family: ${T.font}; }
        select { appearance: none; -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.borderStrong}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.textFaint}; }
        .tabular { font-variant-numeric: tabular-nums; }
        .hover-row:hover { background: ${T.surfaceHover}; }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", top: "1.5rem", right: "1.5rem", zIndex: 9999, background: T.surfaceRaised, border: `1px solid ${T.borderStrong}`, color: T.text, padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 500, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: toast.type === "success" ? T.green : T.red, boxShadow: `0 0 8px ${toast.type === "success" ? T.green : T.red}` }} />
          {toast.msg}
        </div>
      )}

      {/* SIDEBAR */}
      <aside style={{ width: "232px", background: T.surface, padding: "1.5rem 0.75rem 1.25rem", display: "flex", flexDirection: "column", borderRight: `1px solid ${T.border}`, position: "fixed", height: "100vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0 0.6rem", marginBottom: "1.25rem" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: `linear-gradient(135deg, ${T.accent}, ${T.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 700, color: "white" }}>B</div>
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Super Admin</div>
            <div style={{ fontSize: "0.68rem", color: T.textMute, marginTop: "1px" }}>Admin Console</div>
          </div>
        </div>

        {/* PROJECT SWITCHER */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.62rem", color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "0 0.4rem", marginBottom: "0.5rem" }}>Projects</div>
          {projects.map((p) => (
            <div key={p.id} onClick={() => switchProject(p)}
              style={{
                padding: "0.55rem 0.65rem", borderRadius: "6px", cursor: "pointer", marginBottom: "2px",
                fontSize: "0.8rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.55rem",
                background: activeProject?.id === p.id ? `${p.color}18` : "transparent",
                color: activeProject?.id === p.id ? p.color : T.textMute,
                border: activeProject?.id === p.id ? `1px solid ${p.color}40` : "1px solid transparent",
                transition: "all 0.15s",
              }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: p.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{p.name}</div>
                <div style={{ fontSize: "0.65rem", color: T.textFaint, fontFamily: T.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.repo}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: "0.62rem", color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "0 0.6rem", marginBottom: "0.5rem" }}>Navigation</div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1px" }}>
          {[
            { key: "overview", label: "Overview", icon: "M3 12l2-2 4 4 8-8 4 4" },
            { key: "contributors", label: "Contributors", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
            { key: "activity", label: "Activity", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
          ].map((t) => {
            const active = activeTab === t.key;
            return (
              <div key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
                style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.55rem 0.65rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 500, transition: "all 0.15s ease", background: active ? T.accentGlow : "transparent", color: active ? T.accentText : T.textMute }}>
                <Icon d={t.icon} size={15} />
                {t.label}
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: "0.9rem", marginTop: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", padding: "0 0.5rem", marginBottom: "0.75rem" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: avatarBg(adminEmail), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 600, color: "white" }}>
              {initials(adminEmail.split("@")[0])}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adminEmail.split("@")[0]}</div>
              <div style={{ fontSize: "0.62rem", color: T.textFaint }}>Super Admin</div>
            </div>
          </div>
          <button onClick={() => signOut(auth).then(() => window.location.href = "/")}
            style={{ width: "100%", padding: "0.5rem", background: "transparent", border: `1px solid ${T.border}`, color: T.textMute, borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMute; }}>
            <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" size={13} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, padding: "1.75rem 2rem", marginLeft: "232px", maxWidth: "1400px" }}>

        {!activeProject ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: T.textMute, fontSize: "0.85rem" }}>
            Select a project to get started.
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: T.textMute, fontSize: "0.72rem", marginBottom: "0.35rem" }}>
                  <span>Admin</span>
                  <Icon d="M9 18l6-6-6-6" size={11} />
                  <span style={{ color: projectColor }}>{activeProject.name}</span>
                  <Icon d="M9 18l6-6-6-6" size={11} />
                  <span style={{ color: T.text }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
                </div>
                <h1 style={{ fontSize: "1.3rem", fontWeight: 600, letterSpacing: "-0.025em", margin: 0 }}>
                  {activeTab === "overview" ? "Project Overview" : activeTab === "contributors" ? "Contributor Management" : "Activity Stream"}
                </h1>
                <p style={{ fontSize: "0.72rem", color: T.textMute, margin: "0.25rem 0 0", fontFamily: T.mono }}>{activeProject.description}</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", position: "relative" }}>
                <button onClick={() => setShowNotifications(!showNotifications)}
                  style={{ position: "relative", background: T.surface, border: `1px solid ${T.border}`, cursor: "pointer", borderRadius: "7px", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMute, transition: "all 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.borderStrong; e.currentTarget.style.color = T.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMute; }}>
                  <Icon d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0" size={14} />
                  {notifications.length > 0 && (
                    <span style={{ position: "absolute", top: "-4px", right: "-4px", background: projectColor, color: "white", fontSize: "0.58rem", fontWeight: 700, borderRadius: "8px", minWidth: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: `2px solid ${T.bg}` }}>
                      {notifications.length}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div style={{ position: "absolute", top: "2.5rem", right: 0, width: "340px", zIndex: 9998, background: T.surfaceRaised, border: `1px solid ${T.borderStrong}`, borderRadius: "10px", boxShadow: "0 20px 48px rgba(0,0,0,0.6)", maxHeight: "420px", overflowY: "auto" }}>
                    <div style={{ padding: "0.85rem 1rem", borderBottom: `1px solid ${T.border}`, fontWeight: 600, fontSize: "0.82rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      Notifications — {activeProject.name}
                      <span style={{ fontSize: "0.68rem", color: T.textMute, fontWeight: 500 }}>{notifications.length} new</span>
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "1.5rem", color: T.textMute, fontSize: "0.78rem", textAlign: "center" }}>Nothing new.</div>
                    ) : notifications.slice(0, 8).map((n, i) => {
                      const s = statusStyles(n.kind);
                      return (
                        <div key={i} style={{ padding: "0.7rem 1rem", borderBottom: `1px solid ${T.border}`, display: "flex", gap: "0.65rem", alignItems: "flex-start" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.dot, marginTop: "0.4rem", flexShrink: 0, boxShadow: `0 0 6px ${s.dot}` }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: "0.78rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis" }}>{n.text?.slice(0, 48)}</div>
                            <div style={{ fontSize: "0.68rem", color: T.textMute, marginTop: "0.15rem" }}>{n.who} · {timeAgo(n.when)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMute, padding: "0.45rem 0.8rem", borderRadius: "7px", fontSize: "0.74rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.green, boxShadow: `0 0 8px ${T.green}` }} />
                  Secure Session
                </div>
              </div>
            </div>

            {/* TABS */}
            <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.75rem", borderBottom: `1px solid ${T.border}` }}>
              {[
                { key: "overview", label: "Overview" },
                { key: "contributors", label: "Contributors" },
                { key: "activity", label: "Activity" },
              ].map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0.65rem 1rem", fontSize: "0.875rem", fontWeight: 500, fontFamily: T.font, color: activeTab === t.key ? T.text : T.textMute, borderBottom: activeTab === t.key ? `2px solid ${projectColor}` : "2px solid transparent", marginBottom: "-1px", transition: "color 0.15s" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ============ OVERVIEW ============ */}
            {activeTab === "overview" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.85rem", marginBottom: "1.25rem" }}>
                  {[
                    { label: "Commits This Week", value: commitsThisWeek, icon: "M3 12l2-2 4 4 8-8 4 4", spark: true },
                    { label: "PRs Merged", value: prsMerged, icon: "M6 3v12 M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9a9 9 0 0 1-9 9" },
                    { label: "Build Success", value: `${buildSuccessRate}%`, icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3", progress: buildSuccessRate },
                    { label: "Active Contributors", value: activeContributors, icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
                  ].map((s, i) => (
                    <div key={s.label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "1.15rem 1.2rem", position: "relative", overflow: "hidden" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.65rem" }}>
                        <div style={{ fontSize: "0.7rem", color: T.textMute, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                        <div style={{ width: "26px", height: "26px", borderRadius: "6px", background: `${projectColor}18`, color: projectColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon d={s.icon} size={13} />
                        </div>
                      </div>
                      <div className="tabular" style={{ fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.03em", color: T.text }}>
                        {loadingActivity ? "—" : s.value}
                      </div>
                      {i === 0 && !loadingActivity && (
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "24px", marginTop: "0.6rem" }}>
                          {dailyCommits.map((d, idx) => (
                            <div key={idx} style={{ flex: 1, height: `${(d / maxDaily) * 100}%`, minHeight: "2px", background: d > 0 ? projectColor : T.border, borderRadius: "2px", opacity: 0.85 }} />
                          ))}
                        </div>
                      )}
                      {s.progress !== undefined && !loadingActivity && (
                        <div style={{ height: "4px", background: T.border, borderRadius: "2px", marginTop: "0.7rem", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${s.progress}%`, background: s.progress >= 80 ? T.green : s.progress >= 50 ? T.amber : T.red, borderRadius: "2px" }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "0.85rem" }}>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}` }}>
                      <div>
                        <h2 style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>Recent Activity</h2>
                        <p style={{ fontSize: "0.7rem", color: T.textMute, margin: "0.15rem 0 0" }}>{activeProject.name} — live feed</p>
                      </div>
                      <span style={{ fontSize: "0.7rem", color: T.textMute, fontWeight: 500, padding: "0.25rem 0.6rem", background: T.surfaceRaised, borderRadius: "12px", border: `1px solid ${T.border}` }}>
                        {notifications.length} events
                      </span>
                    </div>
                    <div style={{ padding: "0.25rem 0" }}>
                      {loadingActivity ? (
                        <p style={{ color: T.textMute, fontSize: "0.78rem", padding: "1.5rem 1.25rem" }}>Loading...</p>
                      ) : notifications.length === 0 ? (
                        <p style={{ color: T.textMute, fontSize: "0.78rem", padding: "1.5rem 1.25rem" }}>No activity yet for {activeProject.name}.</p>
                      ) : notifications.map((n, i) => {
                        const s = statusStyles(n.kind);
                        return (
                          <div key={i} className="hover-row" style={{ display: "flex", gap: "0.85rem", alignItems: "center", padding: "0.75rem 1.25rem", borderBottom: i === notifications.length - 1 ? "none" : `1px solid ${T.border}`, transition: "background 0.15s" }}>
                            <span style={{ fontSize: "0.6rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.2rem 0.5rem", borderRadius: "4px", background: s.bg, color: s.fg, flexShrink: 0, minWidth: "52px", textAlign: "center" }}>{n.kind}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "0.8rem", fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.text}</div>
                              <div style={{ fontSize: "0.7rem", color: T.textMute, marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span style={{ fontFamily: T.mono }}>@{n.who}</span>
                                <span style={{ color: T.textFaint }}>·</span>
                                <span>{timeAgo(n.when)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "1.1rem 1.25rem" }}>
                      <h3 style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.85rem" }}>Repository</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                        {[
                          { label: "Total PRs", value: loadingActivity ? "—" : prs.length, dot: T.blue },
                          { label: "Total Commits", value: loadingActivity ? "—" : activity.length, dot: T.accent },
                          { label: "Total Builds", value: loadingActivity ? "—" : runs.length, dot: T.green },
                          { label: "Contributors", value: contributors.length, dot: T.amber },
                        ].map((r) => (
                          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", fontSize: "0.78rem", color: T.textMute }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: r.dot }} />
                              {r.label}
                            </div>
                            <div className="tabular" style={{ fontSize: "0.85rem", fontWeight: 600 }}>{r.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "1.1rem 1.25rem" }}>
                      <h3 style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.85rem" }}>Health</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.35rem" }}>
                            <span style={{ color: T.textMute }}>Build success</span>
                            <span className="tabular" style={{ fontWeight: 600 }}>{loadingActivity ? "—" : `${buildSuccessRate}%`}</span>
                          </div>
                          <div style={{ height: "4px", background: T.border, borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${buildSuccessRate}%`, background: buildSuccessRate >= 80 ? T.green : buildSuccessRate >= 50 ? T.amber : T.red }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.35rem" }}>
                            <span style={{ color: T.textMute }}>PR merge rate</span>
                            <span className="tabular" style={{ fontWeight: 600 }}>{loadingActivity ? "—" : `${prs.length === 0 ? 0 : Math.round((prsMerged / prs.length) * 100)}%`}</span>
                          </div>
                          <div style={{ height: "4px", background: T.border, borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${prs.length === 0 ? 0 : (prsMerged / prs.length) * 100}%`, background: projectColor }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ============ CONTRIBUTORS ============ */}
            {activeTab === "contributors" && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}` }}>
                  <div>
                    <h2 style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>Team Members — {activeProject.name}</h2>
                    <p style={{ fontSize: "0.7rem", color: T.textMute, margin: "0.15rem 0 0" }}>{contributors.length} {contributors.length === 1 ? "contributor" : "contributors"}</p>
                  </div>
                  <button onClick={() => setShowForm(!showForm)}
                    style={{ background: projectColor, color: "white", border: "none", padding: "0.5rem 0.9rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Icon d="M12 5v14 M5 12h14" size={13} />
                    Add Contributor
                  </button>
                </div>

                {showForm && (
                  <div style={{ background: T.surfaceRaised, borderBottom: `1px solid ${T.border}`, padding: "1.25rem" }}>
                    <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.85rem" }}>New Contributor — {activeProject.name}</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem", marginBottom: "0.85rem" }}>
                      {[
                        { key: "name", placeholder: "Full Name" },
                        { key: "email", placeholder: "Email Address" },
                        { key: "github", placeholder: "GitHub Username" },
                        { key: "role", placeholder: "Role" },
                      ].map((f) => (
                        <input key={f.key} placeholder={f.placeholder}
                          value={form[f.key as keyof typeof form]}
                          onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                          style={{ padding: "0.55rem 0.75rem", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: "0.8rem", outline: "none" }}
                          onFocus={(e) => e.target.style.borderColor = projectColor}
                          onBlur={(e) => e.target.style.borderColor = T.border}
                        />
                      ))}
                      <select value={form.access} onChange={(e) => setForm({ ...form, access: e.target.value })}
                        style={{ padding: "0.55rem 0.75rem", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: "0.8rem", outline: "none", cursor: "pointer" }}>
                        <option>Write</option>
                        <option>Read</option>
                        <option>Admin</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={addContributor} disabled={sending}
                        style={{ background: projectColor, color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 500, opacity: sending ? 0.6 : 1 }}>
                        {sending ? "Sending..." : "Save & Send Invite"}
                      </button>
                      <button onClick={() => setShowForm(false)}
                        style={{ background: "transparent", color: T.textMute, border: `1px solid ${T.border}`, padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 500 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr>
                        {["Member", "GitHub", "Role", "Access", "Added", ""].map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "0.7rem 1.25rem", color: T.textMute, borderBottom: `1px solid ${T.border}`, fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", background: T.surfaceRaised }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contributors.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: T.textMute }}>No contributors yet for {activeProject.name}. Add your first one.</td></tr>
                      ) : contributors.map((c, i) => (
                        <tr key={i} className="hover-row" style={{ transition: "background 0.15s" }}>
                          <td style={{ padding: "0.85rem 1.25rem", borderBottom: i === contributors.length - 1 ? "none" : `1px solid ${T.border}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: avatarBg(c.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 600, color: "white", flexShrink: 0 }}>
                                {initials(c.name)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 500, color: T.text }}>{c.name}</div>
                                <div style={{ fontSize: "0.72rem", color: T.textMute }}>{c.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "0.85rem 1.25rem", borderBottom: i === contributors.length - 1 ? "none" : `1px solid ${T.border}` }}>
                            <a href={`https://github.com/${c.github}`} target="_blank" style={{ color: T.accentText, textDecoration: "none", fontFamily: T.mono, fontSize: "0.78rem" }}>@{c.github}</a>
                          </td>
                          <td style={{ padding: "0.85rem 1.25rem", borderBottom: i === contributors.length - 1 ? "none" : `1px solid ${T.border}`, color: T.textMute }}>{c.role}</td>
                          <td style={{ padding: "0.85rem 1.25rem", borderBottom: i === contributors.length - 1 ? "none" : `1px solid ${T.border}` }}>
                            <select value={c.access} onChange={(e) => changeAccess(i, e.target.value)}
                              style={{ background: `${projectColor}18`, color: projectColor, border: `1px solid ${T.border}`, padding: "0.3rem 0.6rem", borderRadius: "5px", fontSize: "0.72rem", fontWeight: 500, cursor: "pointer", outline: "none" }}>
                              <option>Write</option>
                              <option>Read</option>
                              <option>Admin</option>
                            </select>
                          </td>
                          <td style={{ padding: "0.85rem 1.25rem", borderBottom: i === contributors.length - 1 ? "none" : `1px solid ${T.border}`, color: T.textMute, fontFamily: T.mono, fontSize: "0.75rem" }}>{c.added}</td>
                          <td style={{ padding: "0.85rem 1.25rem", borderBottom: i === contributors.length - 1 ? "none" : `1px solid ${T.border}`, textAlign: "right" }}>
                            <button onClick={() => removeContributor(i)}
                              style={{ background: "transparent", color: T.textMute, border: `1px solid ${T.border}`, padding: "0.3rem 0.65rem", borderRadius: "5px", cursor: "pointer", fontSize: "0.72rem", transition: "all 0.15s" }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.red; e.currentTarget.style.color = T.red; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMute; }}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============ ACTIVITY ============ */}
            {activeTab === "activity" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}` }}>
                    <div>
                      <h2 style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>Recent Commits</h2>
                      <p style={{ fontSize: "0.7rem", color: T.textMute, margin: "0.15rem 0 0" }}>{activity.length} total</p>
                    </div>
                    <button onClick={() => fetchActivityForProject(activeProject)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textMute, padding: "0.35rem 0.7rem", borderRadius: "5px", cursor: "pointer", fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <Icon d="M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M20.49 15a9 9 0 0 1-14.85 3.36L1 14" size={11} />
                      Refresh
                    </button>
                  </div>
                  <div>
                    {loadingActivity ? (
                      <p style={{ color: T.textMute, fontSize: "0.78rem", padding: "1.5rem 1.25rem" }}>Loading...</p>
                    ) : activity.length === 0 ? (
                      <p style={{ color: T.textMute, fontSize: "0.78rem", padding: "1.5rem 1.25rem" }}>No commits found for {activeProject.name}.</p>
                    ) : activity.map((c, i) => (
                      <div key={i} className="hover-row" style={{ padding: "0.85rem 1.25rem", borderBottom: i === activity.length - 1 ? "none" : `1px solid ${T.border}`, display: "flex", gap: "0.75rem", alignItems: "flex-start", transition: "background 0.15s" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: avatarBg(c.commit?.author?.name || ""), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 600, color: "white", flexShrink: 0 }}>
                          {initials(c.commit?.author?.name || "")}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.8rem", fontWeight: 500, color: T.text, marginBottom: "0.15rem" }}>{c.commit?.message?.split("\n")[0].slice(0, 60)}</div>
                          <div style={{ fontSize: "0.7rem", color: T.textMute, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span>{c.commit?.author?.name}</span>
                            <span style={{ color: T.textFaint }}>·</span>
                            <span>{timeAgo(c.commit?.author?.date)}</span>
                            {c.sha && (<><span style={{ color: T.textFaint }}>·</span><span style={{ fontFamily: T.mono, color: T.accentText }}>{c.sha.slice(0, 7)}</span></>)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}` }}>
                    <div>
                      <h2 style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>Pull Requests</h2>
                      <p style={{ fontSize: "0.7rem", color: T.textMute, margin: "0.15rem 0 0" }}>{prs.length} total · {prsMerged} merged</p>
                    </div>
                  </div>
                  <div>
                    {loadingActivity ? (
                      <p style={{ color: T.textMute, fontSize: "0.78rem", padding: "1.5rem 1.25rem" }}>Loading...</p>
                    ) : prs.length === 0 ? (
                      <p style={{ color: T.textMute, fontSize: "0.78rem", padding: "1.5rem 1.25rem" }}>No pull requests found for {activeProject.name}.</p>
                    ) : prs.map((pr, i) => {
                      const kind = pr.merged_at ? "merged" : pr.state === "open" ? "open" : "closed";
                      const s = statusStyles(kind);
                      return (
                        <div key={i} className="hover-row" style={{ padding: "0.85rem 1.25rem", borderBottom: i === prs.length - 1 ? "none" : `1px solid ${T.border}`, transition: "background 0.15s" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem", gap: "0.5rem" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{pr.title}</div>
                            <span style={{ fontSize: "0.6rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.2rem 0.5rem", borderRadius: "4px", background: s.bg, color: s.fg, flexShrink: 0 }}>{kind}</span>
                          </div>
                          <div style={{ fontSize: "0.7rem", color: T.textMute, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ fontFamily: T.mono }}>#{pr.number}</span>
                            <span style={{ color: T.textFaint }}>·</span>
                            <span>@{pr.user?.login}</span>
                            <span style={{ color: T.textFaint }}>·</span>
                            <span>{timeAgo(pr.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}