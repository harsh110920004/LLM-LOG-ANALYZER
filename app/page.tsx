"use client";

import type { Alert, AlertStatus, IntegrationConnection, IntegrationProvider } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

/* ─── types ────────────────────────────────────────────────────────────────── */

interface AlertsResponse {
  stats: {
    totalEvents: number;
    totalAlerts: number;
    openAlerts: number;
    criticalAlerts: number;
  };
  alerts: Alert[];
}

interface AlertContext extends Alert {
  anomalies: { id: string; rule: string; reason: string; score: number }[];
  event: {
    action: string;
    resource: string;
    timestamp: string;
    ip: string;
    geo: string;
    deviceId: string;
  } | null;
  relatedEvents: {
    id: string;
    timestamp: string;
    eventType: string;
    action: string;
    resource: string;
    geo: string;
  }[];
}

interface ExplanationResponse {
  headline: string;
  explanation: string;
  nextSteps: string[];
  meta?: {
    provider: "gemini";
    model: string;
    usedFallback: boolean;
    error?: string;
  };
}

interface UploadInsightReport {
  fileName: string;
  format: string;
  eventCount: number;
  alertCount: number;
  warnings: string[];
  insight: {
    summary: string;
    risks: string[];
    meta?: { model: string; usedFallback: boolean; error?: string };
  };
}

/* ─── constants ─────────────────────────────────────────────────────────────── */

const SAMPLE_PAYLOAD = JSON.stringify(
  [
    { userId: "charlie", eventType: "auth", action: "login_failed", geo: "Berlin, DE", resource: "vpn" },
    { userId: "charlie", eventType: "auth", action: "login_failed", geo: "Berlin, DE", resource: "vpn" },
    { userId: "charlie", eventType: "auth", action: "login_failed", geo: "Berlin, DE", resource: "vpn" },
    { userId: "charlie", eventType: "auth", action: "login_success", geo: "Singapore, SG", resource: "vpn" },
  ],
  null,
  2,
);

const DEFAULT_MODEL = "gemini-3-flash-preview";

const MODEL_OPTIONS = [
  {
    id: "gemini-3-flash-preview",
    title: "Gemini 3 Flash",
    description: "Balanced speed & reasoning for everyday SOC work.",
    tag: "Recommended",
    tagColor: "bg-blue-500/15 text-blue-300",
  },
  {
    id: "gemini-3.1-pro-preview",
    title: "Gemini 3.1 Pro",
    description: "Deepest analysis quality for high-risk incidents.",
    tag: "Most Capable",
    tagColor: "bg-violet-500/15 text-violet-300",
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    title: "Gemini 3.1 Flash-Lite",
    description: "High-volume workloads at minimal cost.",
    tag: "Cost Efficient",
    tagColor: "bg-emerald-500/15 text-emerald-300",
  },
];

type NavTab = "alerts" | "upload" | "ingest" | "integrations";

/* ─── page ──────────────────────────────────────────────────────────────────── */

export default function Home() {
  /* state */
  const [tab, setTab] = useState<NavTab>("alerts");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertsResponse["stats"]>({
    totalEvents: 0,
    totalAlerts: 0,
    openAlerts: 0,
    criticalAlerts: 0,
  });
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<AlertContext | null>(null);
  const [status, setStatus] = useState<AlertStatus>("open");
  const [noteInput, setNoteInput] = useState("");
  const [jsonInput, setJsonInput] = useState(SAMPLE_PAYLOAD);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadReport, setUploadReport] = useState<UploadInsightReport | null>(null);
  const [msg, setMsg] = useState("");
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AlertStatus>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "low" | "medium" | "high" | "critical">("all");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [aiModel, setAiModel] = useState(DEFAULT_MODEL);
  const [customModel, setCustomModel] = useState("");
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [integrationForm, setIntegrationForm] = useState({
    provider: "aws" as IntegrationProvider,
    displayName: "",
    accountId: "",
    region: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  /* helpers */
  async function withLoading<T>(label: string, task: () => Promise<T>): Promise<T> {
    setLoadingLabel(label);
    try { return await task(); }
    finally { setLoadingLabel(null); }
  }

  async function refreshAlerts() {
    const r = await fetch("/api/alerts", { cache: "no-store" });
    if (!r.ok) throw new Error("Could not fetch alerts.");
    const d: AlertsResponse = await r.json();
    setAlerts(d.alerts);
    setStats(d.stats);
    if (!selectedAlertId && d.alerts.length > 0) setSelectedAlertId(d.alerts[0].id);
  }

  async function loadIntegrations() {
    const r = await fetch("/api/integrations", { cache: "no-store" });
    if (!r.ok) throw new Error("Could not fetch integrations.");
    const d = (await r.json()) as { integrations: IntegrationConnection[] };
    setIntegrations(d.integrations);
  }

  async function loadAlertDetail(id: string) {
    if (!id) { setSelectedAlert(null); setExplanation(null); return; }
    const r = await fetch(`/api/alerts/${id}`, { cache: "no-store" });
    if (!r.ok) { setSelectedAlert(null); return; }
    const d: AlertContext = await r.json();
    setSelectedAlert(d);
    setStatus(d.status);
    setExplanation(null);
  }

  function saveModel(m: string) {
    setAiModel(m);
    window.localStorage.setItem("alabama:ai:model", m);
  }

  /* effects */
  useEffect(() => {
    const stored = window.localStorage.getItem("alabama:ai:model");
    if (stored) { setAiModel(stored); if (!MODEL_OPTIONS.some(m => m.id === stored)) setCustomModel(stored); }
  }, []);

  useEffect(() => {
    withLoading("Initialising…", () => Promise.all([refreshAlerts(), loadIntegrations()])).catch(
      (e: unknown) => setMsg(e instanceof Error ? e.message : "Load error."),
    );
    const t = setInterval(() => Promise.all([refreshAlerts(), loadIntegrations()]).catch(() => {}), 12000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAlertDetail(selectedAlertId).catch(() => setMsg("Could not load alert detail."));
  }, [selectedAlertId]);

  /* derived */
  const filteredAlerts = useMemo(() => alerts.filter(a => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (query.trim() && !`${a.userId} ${a.summary}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [alerts, query, statusFilter, severityFilter]);

  const openRate = useMemo(() =>
    stats.totalAlerts === 0 ? 0 : Math.round((stats.openAlerts / stats.totalAlerts) * 100),
    [stats.openAlerts, stats.totalAlerts]);

  /* actions */
  async function seedDemo() {
    await withLoading("Seeding demo data…", async () => {
      const r = await fetch("/api/seed", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Seed failed.");
      await refreshAlerts();
      setMsg(`Seeded ${d.ingestedCount} events · ${d.alertCount} alerts.`);
    }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Seed failed."));
  }

  async function resetAll() {
    await withLoading("Resetting workspace…", async () => {
      await fetch("/api/reset", { method: "POST" });
      setSelectedAlertId(""); setSelectedAlert(null); setExplanation(null);
      await Promise.all([refreshAlerts(), loadIntegrations()]);
      setMsg("Workspace reset.");
    }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Reset failed."));
  }

  async function ingestCustom() {
    await withLoading("Ingesting payload…", async () => {
      const parsed = JSON.parse(jsonInput);
      const r = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Ingestion failed.");
      await refreshAlerts();
      setMsg(`Ingested ${d.ingestedCount} events · ${d.alertCount} alerts.`);
    }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Ingestion failed."));
  }

  async function uploadLogFile() {
    if (!uploadFile) { setMsg("Select a file first."); return; }
    await withLoading("Analysing log file…", async () => {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("model", aiModel);
      const r = await fetch("/api/ingest/upload", { method: "POST", body: form });
      const d = (await r.json()) as UploadInsightReport | { error: string };
      if (!r.ok || "error" in d) throw new Error("error" in d ? d.error : "Upload failed.");
      setUploadReport(d);
      await refreshAlerts();
      setMsg(`${(d as UploadInsightReport).fileName} processed · ${(d as UploadInsightReport).eventCount} events.`);
    }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Upload failed."));
  }

  async function updateSelectedAlert() {
    if (!selectedAlertId) return;
    await withLoading("Saving…", async () => {
      const r = await fetch(`/api/alerts/${selectedAlertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: noteInput.trim() || undefined }),
      });
      if (!r.ok) throw new Error("Update failed.");
      setNoteInput("");
      await refreshAlerts();
      await loadAlertDetail(selectedAlertId);
      setMsg("Alert updated.");
    }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Update failed."));
  }

  async function explainSelectedAlert() {
    if (!selectedAlertId) return;
    await withLoading("Asking Gemini…", async () => {
      const r = await fetch(`/api/alerts/${selectedAlertId}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: aiModel }),
      });
      const d = (await r.json()) as ExplanationResponse | { error: string };
      if (!r.ok || "error" in d) throw new Error("error" in d ? d.error : "Explanation failed.");
      setExplanation(d);
      // Clear any stale error from a prior attempt
      if (!(d as ExplanationResponse).meta?.usedFallback) setMsg("");
    }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Explanation failed."));
  }

  async function connectIntegration() {
    await withLoading(`Connecting ${integrationForm.provider.toUpperCase()}…`, async () => {
      const r = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: integrationForm.provider,
          status: "connected",
          displayName: integrationForm.displayName || integrationForm.provider.toUpperCase(),
          metadata: { accountId: integrationForm.accountId || "n/a", region: integrationForm.region || "global" },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Connection failed.");
      await loadIntegrations();
      setIsIntegrationModalOpen(false);
      setMsg(`${integrationForm.provider.toUpperCase()} connected.`);
    }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Connection failed."));
  }

  async function disconnectIntegration(provider: IntegrationProvider) {
    await withLoading(`Disconnecting ${provider.toUpperCase()}…`, async () => {
      const r = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, status: "disconnected" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Disconnect failed.");
      await loadIntegrations();
      setMsg(`${provider.toUpperCase()} disconnected.`);
    }).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Disconnect failed."));
  }

  /* ── render ───────────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen overflow-hidden bg-[#07080f] text-[#e8eeff] antialiased">
      {loadingLabel && <Spinner label={loadingLabel} />}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#0b0d17]">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-5 w-5 text-[#4f7eff]" />
            <span className="text-sm font-semibold tracking-tight">Alabama</span>
          </div>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-[#5a6a8a]">Security Ops Console</p>
        </div>

        <nav className="mt-1 flex flex-col gap-0.5 px-2">
          {(
            [
              { id: "alerts", label: "Alerts", icon: <BellIcon className="h-4 w-4" /> },
              { id: "upload", label: "Log Upload", icon: <UploadIcon className="h-4 w-4" /> },
              { id: "ingest", label: "Raw Ingest", icon: <TerminalIcon className="h-4 w-4" /> },
              { id: "integrations", label: "Integrations", icon: <PlugIcon className="h-4 w-4" /> },
            ] as { id: NavTab; label: string; icon: React.ReactNode }[]
          ).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                tab === item.id
                  ? "bg-[#4f7eff]/15 text-[#7aadff] font-medium"
                  : "text-[#6879a4] hover:bg-white/[0.04] hover:text-[#b5c6e8]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-1 border-t border-white/[0.06] px-2 py-3">
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#6879a4] hover:bg-white/[0.04] hover:text-[#b5c6e8]"
          >
            <BrainIcon className="h-4 w-4" />
            AI Session
          </button>
          <button
            type="button"
            onClick={() => setIsIntegrationModalOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#6879a4] hover:bg-white/[0.04] hover:text-[#b5c6e8]"
          >
            <PlugIcon className="h-4 w-4" />
            Connect Apps
          </button>
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3">
          <p className="text-[10px] text-[#3e4d6a]">Model</p>
          <p className="mt-0.5 truncate text-xs text-[#5a7ac7]">{aiModel}</p>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#08091a]/80 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold tracking-tight text-white">
              {tab === "alerts" && "Threat Alerts"}
              {tab === "upload" && "Log File Upload"}
              {tab === "ingest" && "Raw Payload Ingest"}
              {tab === "integrations" && "Connected Apps"}
            </h1>
            {tab === "alerts" && (
              <span className="rounded-full bg-[#4f7eff]/15 px-2 py-0.5 text-[11px] font-medium text-[#7aadff]">
                {filteredAlerts.length} shown
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {msg && (
              <span className="max-w-xs truncate rounded-lg border border-[#1e3060] bg-[#0e1c3b] px-3 py-1 text-xs text-[#7aadff]">
                {msg}
              </span>
            )}
            <Btn onClick={seedDemo} ghost>Seed Demo</Btn>
            <Btn onClick={resetAll} ghost>Reset</Btn>
          </div>
        </header>

        {/* kpi strip */}
        {tab === "alerts" && (
          <div className="shrink-0 border-b border-white/[0.06] bg-[#08091a]/60 px-6 py-3">
            <div className="flex items-center gap-6">
              <KpiInline label="Events" value={stats.totalEvents} />
              <Sep />
              <KpiInline label="Alerts" value={stats.totalAlerts} />
              <Sep />
              <KpiInline label="Open" value={stats.openAlerts} accent />
              <Sep />
              <KpiInline label="Critical" value={stats.criticalAlerts} danger />
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-[#4f6699]">Open pressure</span>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[#131c30]">
                  <div className="h-full rounded-full bg-[#4f7eff] transition-all" style={{ width: `${openRate}%` }} />
                </div>
                <span className="text-xs font-medium text-[#7aadff]">{openRate}%</span>
              </div>
            </div>
          </div>
        )}

        {/* body */}
        <main className="flex-1 overflow-y-auto">

          {/* ── ALERTS tab ──────────────────────────────────────────── */}
          {tab === "alerts" && (
            <div className="flex h-full min-h-0 flex-col xl:flex-row">

              {/* left: table */}
              <section className="flex flex-col border-r border-white/[0.06] xl:w-[58%]">
                <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-5 py-3">
                  <div className="relative flex-1 min-w-52">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4f6699]" />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search user, summary…"
                      className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-[#4f6699] focus:border-[#4f7eff]/60"
                    />
                  </div>
                  <Select value={statusFilter} onChange={v => setStatusFilter(v as "all" | AlertStatus)} options={[["all","All Status"],["open","Open"],["investigating","Investigating"],["resolved","Resolved"]]} />
                  <Select value={severityFilter} onChange={v => setSeverityFilter(v as typeof severityFilter)} options={[["all","All Severity"],["critical","Critical"],["high","High"],["medium","Medium"],["low","Low"]]} />
                </div>

                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0b0d1c]">
                      <tr className="text-[10px] uppercase tracking-[0.1em] text-[#3e5080]">
                        <th className="px-5 py-3 text-left font-medium">User</th>
                        <th className="px-3 py-3 text-left font-medium">Summary</th>
                        <th className="px-3 py-3 text-left font-medium">Sev</th>
                        <th className="px-3 py-3 text-left font-medium">Status</th>
                        <th className="px-5 py-3 text-right font-medium">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlerts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-16 text-center text-sm text-[#3e5080]">
                            No alerts match current filters.
                          </td>
                        </tr>
                      ) : filteredAlerts.map(alert => (
                        <tr
                          key={alert.id}
                          onClick={() => setSelectedAlertId(alert.id)}
                          className={`cursor-pointer border-b border-white/[0.04] transition ${
                            selectedAlertId === alert.id
                              ? "bg-[#4f7eff]/10"
                              : "hover:bg-white/[0.025]"
                          }`}
                        >
                          <td className="px-5 py-3 font-medium text-white">{alert.userId}</td>
                          <td className="max-w-[240px] truncate px-3 py-3 text-[#8ba4d0]">{alert.summary}</td>
                          <td className="px-3 py-3"><SeverityDot sev={alert.severity} /></td>
                          <td className="px-3 py-3"><StatusPill status={alert.status} /></td>
                          <td className="px-5 py-3 text-right">
                            <RiskBar score={alert.riskScore} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* right: detail */}
              <section className="flex flex-col overflow-y-auto xl:flex-1">
                {!selectedAlert ? (
                  <div className="flex flex-1 items-center justify-center p-10 text-center">
                    <div>
                      <ShieldIcon className="mx-auto h-10 w-10 text-[#1e2d4a]" />
                      <p className="mt-3 text-sm text-[#3e5080]">Select an alert to begin investigation</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#4f6699]">Subject</p>
                        <p className="mt-1 text-xl font-semibold text-white">{selectedAlert.userId}</p>
                        <p className="mt-0.5 text-xs text-[#5a7ac7]">
                          {selectedAlert.event
                            ? `${selectedAlert.event.action} · ${selectedAlert.event.resource} · ${selectedAlert.event.geo}`
                            : "No trigger event"}
                        </p>
                      </div>
                      <SeverityDot sev={selectedAlert.severity} large />
                    </div>

                    {selectedAlert.event && (
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {[
                          ["Time", new Date(selectedAlert.event.timestamp).toLocaleString()],
                          ["IP", selectedAlert.event.ip],
                          ["Device", selectedAlert.event.deviceId],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-lg bg-white/[0.03] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-[#3e5080]">{k}</p>
                            <p className="mt-0.5 truncate text-xs text-[#aec2e8]">{v}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* signals */}
                    <div className="mt-5">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-[#4f6699]">Detection Signals</p>
                      <div className="mt-2 space-y-2">
                        {selectedAlert.anomalies.map(anomaly => (
                          <div key={anomaly.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-[#7aadff]">{anomaly.rule.replaceAll("_", " ")}</p>
                              <span className="rounded bg-[#4f7eff]/10 px-2 py-0.5 text-[10px] font-semibold text-[#7aadff]">{anomaly.score}</span>
                            </div>
                            <p className="mt-1 text-xs text-[#8ba4d0]">{anomaly.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* triage */}
                    <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-[#4f6699]">Triage</p>
                      <div className="mt-3 space-y-2">
                        <select
                          value={status}
                          onChange={e => setStatus(e.target.value as AlertStatus)}
                          className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-[#c5d6f5] outline-none focus:border-[#4f7eff]/60"
                        >
                          <option value="open">Open</option>
                          <option value="investigating">Investigating</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <textarea
                          value={noteInput}
                          onChange={e => setNoteInput(e.target.value)}
                          placeholder="Add analyst note…"
                          className="h-18 w-full rounded-lg border border-white/[0.07] bg-white/[0.04] p-3 text-sm text-[#c5d6f5] outline-none placeholder:text-[#3e5080] focus:border-[#4f7eff]/60"
                          rows={3}
                        />
                        <Btn onClick={updateSelectedAlert} primary full>Save Triage Update</Btn>
                      </div>
                    </div>

                    {/* gemini */}
                    <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BrainIcon className="h-4 w-4 text-[#7aadff]" />
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#4f6699]">Gemini Insight</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAiModalOpen(true)}
                          className="text-[10px] text-[#4f6699] underline-offset-2 hover:text-[#7aadff] hover:underline"
                        >
                          {aiModel}
                        </button>
                      </div>
                      <Btn onClick={explainSelectedAlert} primary full cls="mt-3">Generate Explanation</Btn>
                      {explanation && (
                        <div className="mt-4 space-y-3">
                          <p className="font-semibold text-[#70e8b4]">{explanation.headline}</p>
                          {explanation.meta?.usedFallback && (
                            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2">
                              <p className="text-xs font-semibold text-rose-300">AI unavailable — showing rule-based fallback</p>
                              <p className="mt-1 text-[11px] text-rose-400/80">{explanation.meta.error ?? "API unavailable"}</p>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap rounded-lg bg-white/[0.03] p-3 text-xs text-[#aec2e8]">
                            {explanation.explanation}
                          </p>
                          <ul className="space-y-1">
                            {explanation.nextSteps.map(step => (
                              <li key={step} className="flex items-start gap-2 text-xs text-[#8ba4d0]">
                                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4f7eff]" />
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ── UPLOAD tab ─────────────────────────────────────────── */}
          {tab === "upload" && (
            <div className="mx-auto max-w-2xl px-6 py-8">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4f7eff]/15">
                    <UploadIcon className="h-5 w-5 text-[#7aadff]" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">Upload Log File</h2>
                    <p className="text-xs text-[#4f6699]">JSON · NDJSON · CSV · key=value</p>
                  </div>
                </div>

                {/* drop zone */}
                <div
                  className="mt-5 cursor-pointer rounded-xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] p-8 text-center transition hover:border-[#4f7eff]/40 hover:bg-[#4f7eff]/5"
                  onClick={() => fileRef.current?.click()}
                >
                  <UploadIcon className="mx-auto h-8 w-8 text-[#2e4470]" />
                  <p className="mt-2 text-sm font-medium text-[#8ba4d0]">
                    {uploadFile ? uploadFile.name : "Click to choose a file"}
                  </p>
                  <p className="mt-1 text-xs text-[#3e5080]">
                    {uploadFile
                      ? `${Math.ceil(uploadFile.size / 1024)} KB · ready to analyse`
                      : "Max 5 MB · .json .ndjson .csv .log .txt"}
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,.ndjson,.csv,.log,.txt"
                    className="hidden"
                    onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                {/* model selector */}
                <div className="mt-4">
                  <label className="block text-[10px] uppercase tracking-[0.12em] text-[#4f6699]">Gemini model</label>
                  <select
                    value={aiModel}
                    onChange={e => saveModel(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-[#c5d6f5] outline-none"
                  >
                    {MODEL_OPTIONS.map(m => (
                      <option key={m.id} value={m.id}>{m.title} — {m.id}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex gap-2">
                  <Btn onClick={uploadLogFile} primary full>Upload & Analyse</Btn>
                  {uploadFile && <Btn onClick={() => { setUploadFile(null); setUploadReport(null); }} ghost>Clear</Btn>}
                </div>

                {/* report */}
                {uploadReport && (
                  <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="font-semibold text-emerald-300">{uploadReport.insight.summary}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        ["Format", uploadReport.format.toUpperCase()],
                        ["Events", String(uploadReport.eventCount)],
                        ["Alerts", String(uploadReport.alertCount)],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                          <p className="text-[10px] uppercase text-[#3e5080]">{k}</p>
                          <p className="mt-0.5 text-lg font-semibold text-white">{v}</p>
                        </div>
                      ))}
                    </div>
                    {uploadReport.insight.risks.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {uploadReport.insight.risks.map(r => (
                          <li key={r} className="flex items-start gap-2 text-xs text-[#8ba4d0]">
                            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                    {uploadReport.warnings.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {uploadReport.warnings.map(w => (
                          <li key={w} className="text-xs text-rose-300">{w}</li>
                        ))}
                      </ul>
                    )}
                    {uploadReport.insight.meta?.usedFallback && (
                      <p className="mt-2 text-xs text-[#f2c2c2]">Fallback: {uploadReport.insight.meta.error}</p>
                    )}
                  </div>
                )}
              </div>
              {msg && <p className="mt-3 text-center text-xs text-[#7aadff]">{msg}</p>}
            </div>
          )}

          {/* ── INGEST tab ──────────────────────────────────────────── */}
          {tab === "ingest" && (
            <div className="mx-auto max-w-2xl px-6 py-8">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4f7eff]/15">
                    <TerminalIcon className="h-5 w-5 text-[#7aadff]" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">Raw JSON Ingest</h2>
                    <p className="text-xs text-[#4f6699]">POST /api/ingest · array or object with events[]</p>
                  </div>
                </div>

                <textarea
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  className="mt-4 w-full rounded-xl border border-white/[0.07] bg-[#060812] p-4 font-mono text-xs text-[#8ba4d0] outline-none focus:border-[#4f7eff]/50"
                />
                <Btn onClick={ingestCustom} primary full cls="mt-3">Send Payload</Btn>
                {msg && <p className="mt-3 text-xs text-[#7aadff]">{msg}</p>}
              </div>
            </div>
          )}

          {/* ── INTEGRATIONS tab ────────────────────────────────────── */}
          {tab === "integrations" && (
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm text-[#4f6699]">Manage external data source connections.</p>
                <Btn onClick={() => setIsIntegrationModalOpen(true)} primary>Connect App</Btn>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {integrations.map(intg => {
                  const colors: Record<IntegrationProvider, string> = {
                    aws: "from-orange-500/10",
                    gcp: "from-blue-500/10",
                    azure: "from-sky-500/10",
                    github: "from-slate-500/10",
                    slack: "from-purple-500/10",
                  };
                  return (
                    <div
                      key={intg.provider}
                      className={`rounded-2xl border border-white/[0.06] bg-gradient-to-br ${colors[intg.provider]} to-transparent p-5`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-base font-semibold uppercase text-white">{intg.provider}</p>
                        <StatusPill status={intg.status as "open"} />
                      </div>
                      <p className="mt-1 text-xs text-[#4f6699]">{intg.displayName ?? "—"}</p>
                      <div className="mt-4 flex gap-2">
                        {intg.status === "connected" ? (
                          <Btn onClick={() => disconnectIntegration(intg.provider)} ghost small>Disconnect</Btn>
                        ) : (
                          <Btn onClick={() => { setIntegrationForm(f => ({ ...f, provider: intg.provider })); setIsIntegrationModalOpen(true); }} ghost small>Connect</Btn>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {msg && <p className="mt-4 text-xs text-[#7aadff]">{msg}</p>}
            </div>
          )}
        </main>
      </div>

      {/* ── AI Model Modal ───────────────────────────────────────────── */}
      {isAiModalOpen && (
        <Sheet title="AI Session" icon={<BrainIcon className="h-4 w-4" />} onClose={() => setIsAiModalOpen(false)}>
          <p className="text-sm text-[#6879a4]">Choose the Gemini model. Stored locally per browser session.</p>
          <div className="mt-4 space-y-2">
            {MODEL_OPTIONS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => saveModel(m.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  aiModel === m.id
                    ? "border-[#4f7eff]/60 bg-[#4f7eff]/10"
                    : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{m.title}</p>
                    <p className="mt-0.5 text-xs text-[#6879a4]">{m.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${m.tagColor}`}>
                    {m.tag}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[10px] text-[#3e5080]">{m.id}</p>
                {aiModel === m.id && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4f7eff]" />
                    <span className="text-[10px] text-[#4f7eff]">Active</span>
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-[10px] uppercase tracking-[0.12em] text-[#3e5080]">Custom model ID</label>
            <div className="mt-2 flex gap-2">
              <input
                value={customModel}
                onChange={e => setCustomModel(e.target.value)}
                placeholder="e.g. gemini-3-flash-preview"
                className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-[#c5d6f5] outline-none focus:border-[#4f7eff]/60"
              />
              <Btn onClick={() => { if (customModel.trim()) saveModel(customModel.trim()); }} primary>Apply</Btn>
            </div>
          </div>
        </Sheet>
      )}

      {/* ── Integrations Modal ──────────────────────────────────────── */}
      {isIntegrationModalOpen && (
        <Sheet title="Connect External App" icon={<PlugIcon className="h-4 w-4" />} onClose={() => setIsIntegrationModalOpen(false)}>
          <p className="text-sm text-[#6879a4]">Register credentials for a pipeline connector.</p>
          <div className="mt-4 space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.12em] text-[#3e5080]">Provider</label>
            <div className="grid grid-cols-5 gap-2">
              {(["aws","gcp","azure","github","slack"] as IntegrationProvider[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setIntegrationForm(f => ({ ...f, provider: p }))}
                  className={`rounded-lg border py-2 text-xs font-semibold uppercase transition ${
                    integrationForm.provider === p
                      ? "border-[#4f7eff]/60 bg-[#4f7eff]/15 text-[#7aadff]"
                      : "border-white/[0.07] bg-white/[0.02] text-[#6879a4] hover:bg-white/[0.04]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {[
              { label: "Display name", key: "displayName" as const, placeholder: "e.g. Production AWS" },
              { label: "Account / Workspace ID", key: "accountId" as const, placeholder: "123456789" },
              { label: "Region", key: "region" as const, placeholder: "us-east-1" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-[#3e5080]">{f.label}</label>
                <input
                  value={integrationForm[f.key]}
                  onChange={e => setIntegrationForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="mt-1.5 w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-[#c5d6f5] outline-none focus:border-[#4f7eff]/60"
                />
              </div>
            ))}
          </div>
          <Btn onClick={connectIntegration} primary full cls="mt-4">Connect Integration</Btn>
        </Sheet>
      )}
    </div>
  );
}

/* ─── utility components ────────────────────────────────────────────────────── */

function Btn({
  onClick, primary, ghost, full, small, children, cls,
}: {
  onClick: () => void;
  primary?: boolean;
  ghost?: boolean;
  full?: boolean;
  small?: boolean;
  children: React.ReactNode;
  cls?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg font-medium transition",
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        full ? "w-full" : "",
        primary ? "bg-[#3559df] text-white hover:bg-[#2e4fc7] active:bg-[#2540b0]"
          : ghost ? "border border-white/[0.08] bg-white/[0.04] text-[#8ba4d0] hover:bg-white/[0.07]"
          : "border border-white/[0.08] bg-white/[0.04] text-[#8ba4d0] hover:bg-white/[0.07]",
        cls ?? "",
      ].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}

function Select({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-sm text-[#a0bada] outline-none focus:border-[#4f7eff]/60"
    >
      {options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
    </select>
  );
}

function KpiInline({ label, value, accent, danger }: { label: string; value: number; accent?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#3e5080]">{label}</p>
      <p className={`text-lg font-semibold leading-none ${danger ? "text-rose-400" : accent ? "text-amber-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Sep() {
  return <span className="h-4 w-px bg-white/[0.08]" />;
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-rose-500" : score >= 60 ? "bg-orange-400" : score >= 35 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-semibold text-[#8ba4d0]">{score}</span>
    </div>
  );
}

function SeverityDot({ sev, large }: { sev: string; large?: boolean }) {
  const map: Record<string, string> = {
    critical: "bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
    high: "bg-orange-400",
    medium: "bg-amber-400",
    low: "bg-emerald-500",
  };
  const size = large ? "h-3 w-3" : "h-2 w-2";
  return (
    <span className={`inline-block rounded-full ${size} ${map[sev] ?? "bg-slate-500"}`} title={sev} />
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-rose-500/15 text-rose-300",
    investigating: "bg-amber-400/15 text-amber-300",
    resolved: "bg-emerald-500/15 text-emerald-300",
    connected: "bg-emerald-500/15 text-emerald-300",
    disconnected: "bg-slate-500/15 text-slate-400",
    error: "bg-rose-500/15 text-rose-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status] ?? "bg-slate-500/15 text-slate-400"}`}>
      {status}
    </span>
  );
}

function Sheet({ title, icon, onClose, children }: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.09] bg-[#0c0f1f] shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            {icon && <span className="text-[#7aadff]">{icon}</span>}
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#4f6699] transition hover:bg-white/[0.06] hover:text-white"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.09] bg-[#0c0f1f] px-5 py-3 shadow-2xl">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#4f7eff] border-t-transparent" />
        <span className="text-sm text-[#8ba4d0]">{label}</span>
      </div>
    </div>
  );
}

/* ─── icons (inline SVG) ────────────────────────────────────────────────────── */

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 2L4 5v7c0 5 3.6 9.3 8 10.8C16.4 21.3 20 17 20 12V5l-8-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 10a6 6 0 0 1 12 0v4l1.5 2.5H4.5L6 14v-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 15V5m0 0-4 4m4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 17v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m7 9 4 3-4 3M13 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlugIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M8 9V5m8 4V5M7 9h10v3a5 5 0 0 1-5 5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 4c0-1.1.9-2 2-2a3 3 0 0 1 3 3c1.1 0 2 .9 2 2s-.9 2-2 2v4a4 4 0 0 1-4 4m0-13c0-1.1-.9-2-2-2a3 3 0 0 0-3 3c-1.1 0-2 .9-2 2s.9 2 2 2v4a4 4 0 0 0 4 4m0 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="m6 6 12 12M6 18 18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
