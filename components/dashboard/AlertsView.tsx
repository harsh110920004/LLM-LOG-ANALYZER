import { BrainIcon, SearchIcon, ShieldIcon } from "@/components/dashboard/icons";
import { Btn, KpiInline, RiskBar, Select, Sep, SeverityDot, StatusPill } from "@/components/dashboard/ui";
import type { ExplanationResponse, SelectedAlert } from "@/components/dashboard/types";
import type { Alert, AlertStatus } from "@/lib/types";

export function AlertsView({
  stats,
  openRate,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  severityFilter,
  setSeverityFilter,
  filteredAlerts,
  selectedAlertId,
  setSelectedAlertId,
  selectedAlert,
  status,
  setStatus,
  noteInput,
  setNoteInput,
  updateSelectedAlert,
  aiModel,
  openAiModal,
  explainSelectedAlert,
  explanation,
}: {
  stats: {
    totalEvents: number;
    totalAlerts: number;
    openAlerts: number;
    criticalAlerts: number;
  };
  openRate: number;
  query: string;
  setQuery: (value: string) => void;
  statusFilter: "all" | AlertStatus;
  setStatusFilter: (value: "all" | AlertStatus) => void;
  severityFilter: "all" | "low" | "medium" | "high" | "critical";
  setSeverityFilter: (value: "all" | "low" | "medium" | "high" | "critical") => void;
  filteredAlerts: Alert[];
  selectedAlertId: string;
  setSelectedAlertId: (id: string) => void;
  selectedAlert: SelectedAlert;
  status: AlertStatus;
  setStatus: (value: AlertStatus) => void;
  noteInput: string;
  setNoteInput: (value: string) => void;
  updateSelectedAlert: () => void;
  aiModel: string;
  openAiModal: () => void;
  explainSelectedAlert: () => void;
  explanation: ExplanationResponse | null;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
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

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <section className="flex flex-col border-r border-white/[0.06] xl:w-[58%]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-5 py-3">
            <div className="relative min-w-52 flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4f6699]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search user, summary..."
                className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-[#4f6699] focus:border-[#4f7eff]/60"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as "all" | AlertStatus)}
              options={[
                ["all", "All Status"],
                ["open", "Open"],
                ["investigating", "Investigating"],
                ["resolved", "Resolved"],
              ]}
            />
            <Select
              value={severityFilter}
              onChange={(value) => setSeverityFilter(value as "all" | "low" | "medium" | "high" | "critical")}
              options={[
                ["all", "All Severity"],
                ["critical", "Critical"],
                ["high", "High"],
                ["medium", "Medium"],
                ["low", "Low"],
              ]}
            />
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
                ) : (
                  filteredAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      onClick={() => setSelectedAlertId(alert.id)}
                      className={`cursor-pointer border-b border-white/[0.04] transition ${
                        selectedAlertId === alert.id ? "bg-[#4f7eff]/10" : "hover:bg-white/[0.025]"
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-white">{alert.userId}</td>
                      <td className="max-w-[240px] truncate px-3 py-3 text-[#8ba4d0]">{alert.summary}</td>
                      <td className="px-3 py-3">
                        <SeverityDot sev={alert.severity} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={alert.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RiskBar score={alert.riskScore} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

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
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-[#3e5080]">{label}</p>
                      <p className="mt-0.5 truncate text-xs text-[#aec2e8]">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#4f6699]">Detection Signals</p>
                <div className="mt-2 space-y-2">
                  {selectedAlert.anomalies.map((anomaly) => (
                    <div key={anomaly.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-[#7aadff]">{anomaly.rule.replaceAll("_", " ")}</p>
                        <span className="rounded bg-[#4f7eff]/10 px-2 py-0.5 text-[10px] font-semibold text-[#7aadff]">
                          {anomaly.score}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#8ba4d0]">{anomaly.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#4f6699]">Triage</p>
                <div className="mt-3 space-y-2">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AlertStatus)}
                    className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-[#c5d6f5] outline-none focus:border-[#4f7eff]/60"
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add analyst note..."
                    className="h-18 w-full rounded-lg border border-white/[0.07] bg-white/[0.04] p-3 text-sm text-[#c5d6f5] outline-none placeholder:text-[#3e5080] focus:border-[#4f7eff]/60"
                    rows={3}
                  />
                  <Btn onClick={updateSelectedAlert} primary full>
                    Save Triage Update
                  </Btn>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BrainIcon className="h-4 w-4 text-[#7aadff]" />
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[#4f6699]">Gemini Insight</p>
                  </div>
                  <button
                    type="button"
                    onClick={openAiModal}
                    className="text-[10px] text-[#4f6699] underline-offset-2 hover:text-[#7aadff] hover:underline"
                  >
                    {aiModel}
                  </button>
                </div>
                <Btn onClick={explainSelectedAlert} primary full cls="mt-3">
                  Generate Explanation
                </Btn>
                {explanation && (
                  <div className="mt-4 space-y-3">
                    <p className="font-semibold text-[#70e8b4]">{explanation.headline}</p>
                    {explanation.meta?.usedFallback && (
                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2">
                        <p className="text-xs font-semibold text-rose-300">AI unavailable - showing rule-based fallback</p>
                        <p className="mt-1 text-[11px] text-rose-400/80">{explanation.meta.error ?? "API unavailable"}</p>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap rounded-lg bg-white/[0.03] p-3 text-xs text-[#aec2e8]">
                      {explanation.explanation}
                    </p>
                    <ul className="space-y-1">
                      {explanation.nextSteps.map((step) => (
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
    </div>
  );
}
