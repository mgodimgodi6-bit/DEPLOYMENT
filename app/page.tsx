"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDropzone } from "react-dropzone";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode =
  | "general"
  | "financial"
  | "legal"
  | "entrepreneur"
  | "coach"
  | "sars"
  | "blueprint";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: Date;
  mode?: Mode;
};

type UploadedDoc = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  status: "processing" | "ready" | "error";
};

// ─── Mode config ──────────────────────────────────────────────────────────────
const MODES: Record<
  Mode,
  { label: string; icon: string; color: string; desc: string }
> = {
  general: {
    label: "General",
    icon: "◈",
    color: "#f0a500",
    desc: "General AI assistance",
  },
  financial: {
    label: "Financial",
    icon: "◎",
    color: "#00d4aa",
    desc: "P&L, cash flow, budgets",
  },
  legal: {
    label: "Labour Law",
    icon: "⬡",
    color: "#a78bfa",
    desc: "SA labour regulations",
  },
  entrepreneur: {
    label: "Entrepreneur",
    icon: "◆",
    color: "#ff6b35",
    desc: "Musk/Gates strategies",
  },
  coach: {
    label: "Coach",
    icon: "◉",
    color: "#38bdf8",
    desc: "Business coaching mode",
  },
  sars: {
    label: "SARS Tax",
    icon: "⬟",
    color: "#fb923c",
    desc: "SA tax analysis",
  },
  blueprint: {
    label: "Blueprint",
    icon: "◫",
    color: "#4ade80",
    desc: "Business plan generator",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2);

const formatBytes = (b: number) => {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uid(),
      role: "system",
      text: 'Welcome to **Briiz AI** — your elite business intelligence advisor.\n\nUpload financial documents, contracts, or tax statements and ask me anything. Switch modes to access specialised analysis.\n\n_Created by Bongumusa Madulini_',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("general");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [panel, setPanel] = useState<"chat" | "docs" | "modes">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // ─── Send message ────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: uid(),
      role: "user",
      text,
      timestamp: new Date(),
      mode,
    };

    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    const placeholderId = uid();
    setMessages((p) => [
      ...p,
      {
        id: placeholderId,
        role: "assistant",
        text: "",
        timestamp: new Date(),
        mode,
      },
    ]);

    try {
      const res = await axios.post("/api/chat", { text, mode });
      setMessages((p) =>
        p.map((m) =>
          m.id === placeholderId
            ? { ...m, text: res.data.reply }
            : m
        )
      );
    } catch (err) {
      setMessages((p) =>
        p.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                text: "⚠️ Connection error. Check your API keys in `.env.local`.",
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── File upload ─────────────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const docId = uid();
      const newDoc: UploadedDoc = {
        id: docId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date(),
        status: "processing",
      };
      setDocs((p) => [...p, newDoc]);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await axios.post("/api/upload", formData, {
          onUploadProgress: (e) => {
            setUploadProgress(Math.round((e.loaded / (e.total ?? 1)) * 100));
          },
        });

        setDocs((p) =>
          p.map((d) => (d.id === docId ? { ...d, status: "ready" } : d))
        );
        setUploadProgress(null);

        setMessages((p) => [
          ...p,
          {
            id: uid(),
            role: "assistant",
            text: res.data.reply,
            timestamp: new Date(),
            mode,
          },
        ]);
        setPanel("chat");
      } catch {
        setDocs((p) =>
          p.map((d) => (d.id === docId ? { ...d, status: "error" } : d))
        );
        setUploadProgress(null);
      }
    }
  }, [mode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "image/*": [".png", ".jpg", ".jpeg"],
      "text/plain": [".txt"],
    },
    maxSize: 20 * 1024 * 1024,
  });

  // ─── Analyze doc ─────────────────────────────────────────────────────────
  const analyzeLastDoc = async () => {
    const readyDocs = docs.filter((d) => d.status === "ready");
    if (!readyDocs.length) return;

    setAnalyzing(true);
    const prompt = `Perform a deep ${mode} analysis on my uploaded documents. Identify risks, opportunities, compliance issues, and provide actionable recommendations.`;

    const userMsg: Message = {
      id: uid(),
      role: "user",
      text: prompt,
      timestamp: new Date(),
      mode,
    };
    setMessages((p) => [...p, userMsg]);
    setPanel("chat");

    const placeholderId = uid();
    setMessages((p) => [
      ...p,
      { id: placeholderId, role: "assistant", text: "", timestamp: new Date(), mode },
    ]);

    try {
      const res = await axios.post("/api/analyze", { mode });
      setMessages((p) =>
        p.map((m) => (m.id === placeholderId ? { ...m, text: res.data.reply } : m))
      );
    } catch {
      setMessages((p) =>
        p.map((m) =>
          m.id === placeholderId
            ? { ...m, text: "Analysis failed. Ensure your document was processed." }
            : m
        )
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: sidebarOpen ? 260 : 0,
          minWidth: sidebarOpen ? 260 : 0,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          transition: "all 0.3s ease",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "1.5rem 1.25rem 1rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            className="font-display"
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: "var(--accent)" }}>BRIIZ</span>
            <span style={{ color: "var(--text)", opacity: 0.5 }}> AI</span>
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: "0.65rem",
              color: "var(--text3)",
              marginTop: "0.2rem",
              letterSpacing: "0.1em",
            }}
          >
            BUSINESS INTELLIGENCE v2.0
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "0.75rem 0", flex: 1 }}>
          {(
            [
              { key: "chat", icon: "◈", label: "Chat" },
              { key: "docs", icon: "◉", label: `Documents (${docs.length})` },
              { key: "modes", icon: "◆", label: "Analysis Modes" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setPanel(item.key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.65rem 1.25rem",
                background: panel === item.key ? "var(--surface2)" : "transparent",
                border: "none",
                borderLeft:
                  panel === item.key
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                color: panel === item.key ? "var(--text)" : "var(--text2)",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                fontSize: "0.8rem",
                transition: "all 0.15s",
              }}
            >
              <span style={{ color: "var(--accent)", opacity: panel === item.key ? 1 : 0.5 }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Current mode badge */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderTop: "1px solid var(--border)",
            background: "var(--surface2)",
          }}
        >
          <div style={{ fontSize: "0.65rem", color: "var(--text3)", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
            ACTIVE MODE
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.85rem",
              color: MODES[mode].color,
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
            }}
          >
            <span>{MODES[mode].icon}</span>
            {MODES[mode].label}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: "0.2rem" }}>
            {MODES[mode].desc}
          </div>
        </div>

        {/* Creator tag */}
        <div
          style={{
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid var(--border)",
            fontSize: "0.65rem",
            color: "var(--text3)",
            letterSpacing: "0.05em",
          }}
        >
          BY BONGUMUSA MADULINI
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <header
          style={{
            height: 56,
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            padding: "0 1.5rem",
            gap: "1rem",
            background: "var(--surface)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text2)",
              cursor: "pointer",
              fontSize: "1.1rem",
              padding: "0.25rem",
              display: "flex",
            }}
          >
            ☰
          </button>

          {/* Mode switcher */}
          <div style={{ display: "flex", gap: "0.35rem", overflowX: "auto", flex: 1 }}>
            {(Object.entries(MODES) as [Mode, (typeof MODES)[Mode]][]).map(
              ([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className="btn"
                  style={{
                    padding: "0.3rem 0.8rem",
                    fontSize: "0.72rem",
                    background: mode === key ? cfg.color + "22" : "transparent",
                    border: `1px solid ${mode === key ? cfg.color : "var(--border)"}`,
                    color: mode === key ? cfg.color : "var(--text3)",
                    whiteSpace: "nowrap",
                    fontFamily: "Syne, sans-serif",
                    fontWeight: mode === key ? 700 : 500,
                    cursor: "pointer",
                    borderRadius: 4,
                    transition: "all 0.15s",
                    letterSpacing: "0.05em",
                  }}
                >
                  {cfg.icon} {cfg.label}
                </button>
              )
            )}
          </div>

          {docs.some((d) => d.status === "ready") && (
            <button
              onClick={analyzeLastDoc}
              disabled={analyzing}
              style={{
                background: analyzing ? "var(--surface2)" : "var(--accent)",
                color: analyzing ? "var(--text2)" : "#000",
                border: "none",
                padding: "0.4rem 1rem",
                borderRadius: 4,
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                fontSize: "0.75rem",
                cursor: analyzing ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              {analyzing ? "◌ Analyzing..." : "◎ Deep Analyze"}
            </button>
          )}
        </header>

        {/* Panel: Chat */}
        {panel === "chat" && (
          <>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="animate-fade-up"
                  style={{
                    display: "flex",
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                    maxWidth: "100%",
                  }}
                >
                  {/* Avatar */}
                  {msg.role !== "user" && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "var(--surface2)",
                        border: "1px solid var(--border2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.8rem",
                        color: "var(--accent)",
                        flexShrink: 0,
                      }}
                    >
                      ◈
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    style={{
                      maxWidth: "72%",
                      background:
                        msg.role === "user"
                          ? "var(--user-bubble)"
                          : msg.role === "system"
                          ? "var(--surface)"
                          : "var(--ai-bubble)",
                      border: `1px solid ${
                        msg.role === "user"
                          ? "var(--border2)"
                          : msg.role === "system"
                          ? "var(--border)"
                          : "#1a2e1f"
                      }`,
                      borderRadius:
                        msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                      padding: "0.85rem 1rem",
                    }}
                  >
                    {msg.text === "" ? (
                      <span
                        className="typing-cursor font-mono"
                        style={{ color: "var(--text3)", fontSize: "0.85rem" }}
                      >
                        &nbsp;
                      </span>
                    ) : (
                      <div className="prose-briiz font-mono" style={{ fontSize: "0.88rem" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    )}

                    {msg.mode && msg.role !== "system" && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          fontSize: "0.65rem",
                          color: MODES[msg.mode]?.color || "var(--text3)",
                          letterSpacing: "0.1em",
                        }}
                      >
                        {MODES[msg.mode]?.icon} {MODES[msg.mode]?.label.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                padding: "1rem 1.5rem",
                background: "var(--surface)",
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-end",
              }}
            >
              {/* Upload button */}
              <label
                style={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--border2)",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "var(--text2)",
                  background: "var(--surface2)",
                  flexShrink: 0,
                  transition: "all 0.15s",
                  fontSize: "1.1rem",
                }}
                title="Upload document"
                onClick={() => setPanel("docs")}
              >
                ⊕
              </label>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask Briiz AI in ${MODES[mode].label} mode... (Enter to send, Shift+Enter for newline)`}
                rows={1}
                style={{
                  flex: 1,
                  background: "var(--surface2)",
                  border: "1px solid var(--border2)",
                  borderRadius: 8,
                  padding: "0.75rem 1rem",
                  color: "var(--text)",
                  fontFamily: "DM Mono, monospace",
                  fontSize: "0.85rem",
                  resize: "none",
                  outline: "none",
                  lineHeight: 1.6,
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border2)")}
              />

              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                style={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: loading || !input.trim() ? "var(--surface2)" : "var(--accent)",
                  border: "none",
                  borderRadius: 6,
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  color: loading || !input.trim() ? "var(--text3)" : "#000",
                  fontSize: "1rem",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                {loading ? "◌" : "▶"}
              </button>
            </div>
          </>
        )}

        {/* Panel: Docs */}
        {panel === "docs" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
            <div className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", color: "var(--text)" }}>
              Document Intelligence
            </div>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? "var(--accent)" : "var(--border2)"}`,
                borderRadius: 12,
                padding: "3rem 2rem",
                textAlign: "center",
                background: isDragActive ? "rgba(240,165,0,0.05)" : "var(--surface)",
                cursor: "pointer",
                transition: "all 0.2s",
                marginBottom: "2rem",
              }}
            >
              <input {...getInputProps()} />
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⊕</div>
              <div className="font-display" style={{ color: "var(--text)", fontWeight: 600, marginBottom: "0.4rem" }}>
                {isDragActive ? "Drop files here" : "Upload Documents"}
              </div>
              <div style={{ color: "var(--text2)", fontSize: "0.8rem" }}>
                PDF, Excel, CSV, Images, TXT — up to 20MB
              </div>
            </div>

            {/* Upload progress */}
            {uploadProgress !== null && (
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", fontSize: "0.75rem", color: "var(--text2)" }}>
                  <span>Processing document...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ height: 4, background: "var(--surface2)", borderRadius: 2 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${uploadProgress}%`,
                      background: "var(--accent)",
                      borderRadius: 2,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Doc list */}
            {docs.length > 0 && (
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text3)", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
                  KNOWLEDGE BASE ({docs.length} documents)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        padding: "0.75rem 1rem",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    >
                      <span style={{ fontSize: "1.2rem" }}>
                        {doc.type.includes("pdf")
                          ? "📄"
                          : doc.type.includes("sheet") || doc.name.endsWith(".xlsx")
                          ? "📊"
                          : doc.type.includes("image")
                          ? "🖼"
                          : "📁"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.82rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.name}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>
                          {formatBytes(doc.size)} · {doc.uploadedAt.toLocaleTimeString()}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.2rem 0.6rem",
                          borderRadius: 4,
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          background:
                            doc.status === "ready"
                              ? "rgba(63,185,80,0.15)"
                              : doc.status === "processing"
                              ? "rgba(240,165,0,0.15)"
                              : "rgba(248,81,73,0.15)",
                          color:
                            doc.status === "ready"
                              ? "var(--success)"
                              : doc.status === "processing"
                              ? "var(--accent)"
                              : "var(--danger)",
                        }}
                      >
                        {doc.status === "ready"
                          ? "READY"
                          : doc.status === "processing"
                          ? "PROCESSING"
                          : "ERROR"}
                      </span>
                    </div>
                  ))}
                </div>

                {docs.some((d) => d.status === "ready") && (
                  <button
                    onClick={() => {
                      setPanel("chat");
                      analyzeLastDoc();
                    }}
                    style={{
                      marginTop: "1.25rem",
                      width: "100%",
                      padding: "0.85rem",
                      background: "var(--accent)",
                      color: "#000",
                      border: "none",
                      borderRadius: 8,
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                    }}
                  >
                    ◎ RUN DEEP ANALYSIS
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Panel: Modes */}
        {panel === "modes" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
            <div className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Analysis Modes
            </div>
            <div style={{ color: "var(--text2)", fontSize: "0.8rem", marginBottom: "2rem" }}>
              Each mode configures Briiz AI with specialised expertise and analysis frameworks.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" }}>
              {(Object.entries(MODES) as [Mode, (typeof MODES)[Mode]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => {
                    setMode(key);
                    setPanel("chat");
                  }}
                  style={{
                    background: mode === key ? cfg.color + "18" : "var(--surface)",
                    border: `1px solid ${mode === key ? cfg.color : "var(--border)"}`,
                    borderRadius: 10,
                    padding: "1.25rem",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: "1.8rem", color: cfg.color, marginBottom: "0.75rem" }}>
                    {cfg.icon}
                  </div>
                  <div className="font-display" style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.3rem" }}>
                    {cfg.label}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>{cfg.desc}</div>
                  {mode === key && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        fontSize: "0.65rem",
                        color: cfg.color,
                        fontFamily: "Syne, sans-serif",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                      }}
                    >
                      ✓ ACTIVE
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Suggested prompts per mode */}
            <div style={{ marginTop: "2.5rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text3)", letterSpacing: "0.1em", marginBottom: "1rem" }}>
                SUGGESTED PROMPTS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[
                  "Analyse my cash flow and predict next quarter",
                  "Am I compliant with SA labour law for overtime pay?",
                  "What would Elon Musk do in my business situation?",
                  "What SARS deductions can I claim as a sole trader?",
                  "Create a 12-month business blueprint for my startup",
                  "Do a SWOT analysis on my business idea",
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(prompt);
                      setPanel("chat");
                    }}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "0.65rem 1rem",
                      color: "var(--text2)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "DM Mono, monospace",
                      fontSize: "0.8rem",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.borderColor = "var(--accent)";
                      (e.target as HTMLButtonElement).style.color = "var(--text)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.borderColor = "var(--border)";
                      (e.target as HTMLButtonElement).style.color = "var(--text2)";
                    }}
                  >
                    → {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
