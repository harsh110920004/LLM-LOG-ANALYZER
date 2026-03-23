"use client";

import { DEFAULT_MODEL, MODEL_OPTIONS, SAMPLE_PAYLOAD } from "@/components/dashboard/constants";
import type {
  AlertsResponse,
  ExplanationResponse,
  IntegrationFormState,
  SelectedAlert,
  UploadInsightReport,
} from "@/components/dashboard/types";
import type { Alert, AlertStatus, IntegrationConnection, IntegrationProvider } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function useDashboardState() {
  const [tab, setTab] = useState<"alerts" | "upload" | "ingest" | "integrations">("alerts");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertsResponse["stats"]>({
    totalEvents: 0,
    totalAlerts: 0,
    openAlerts: 0,
    criticalAlerts: 0,
  });
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<SelectedAlert>(null);
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
  const [integrationForm, setIntegrationForm] = useState<IntegrationFormState>({
    provider: "aws",
    displayName: "",
    accountId: "",
    region: "",
  });

  async function withLoading<T>(label: string, task: () => Promise<T>): Promise<T> {
    setLoadingLabel(label);
    try {
      return await task();
    } finally {
      setLoadingLabel(null);
    }
  }

  async function refreshAlerts() {
    const response = await fetch("/api/alerts", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not fetch alerts.");
    const data: AlertsResponse = await response.json();
    setAlerts(data.alerts);
    setStats(data.stats);
    if (!selectedAlertId && data.alerts.length > 0) setSelectedAlertId(data.alerts[0].id);
  }

  async function loadIntegrations() {
    const response = await fetch("/api/integrations", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not fetch integrations.");
    const data = (await response.json()) as { integrations: IntegrationConnection[] };
    setIntegrations(data.integrations);
  }

  async function loadAlertDetail(id: string) {
    if (!id) {
      setSelectedAlert(null);
      setExplanation(null);
      return;
    }

    const response = await fetch(`/api/alerts/${id}`, { cache: "no-store" });
    if (!response.ok) {
      setSelectedAlert(null);
      return;
    }

    const data = (await response.json()) as SelectedAlert;
    setSelectedAlert(data);
    if (data) setStatus(data.status);
    setExplanation(null);
  }

  function saveModel(model: string) {
    setAiModel(model);
    window.localStorage.setItem("alabama:ai:model", model);
  }

  function clearUploadSelection() {
    setUploadFile(null);
    setUploadReport(null);
  }

  useEffect(() => {
    const stored = window.localStorage.getItem("alabama:ai:model");
    if (stored) {
      setAiModel(stored);
      if (!MODEL_OPTIONS.some((model) => model.id === stored)) setCustomModel(stored);
    }
  }, []);

  useEffect(() => {
    withLoading("Initialising...", () => Promise.all([refreshAlerts(), loadIntegrations()])).catch((error: unknown) =>
      setMsg(error instanceof Error ? error.message : "Load error."),
    );

    const interval = setInterval(() => {
      Promise.all([refreshAlerts(), loadIntegrations()]).catch(() => {});
    }, 12000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAlertDetail(selectedAlertId).catch(() => setMsg("Could not load alert detail."));
  }, [selectedAlertId]);

  const filteredAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        if (statusFilter !== "all" && alert.status !== statusFilter) return false;
        if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
        if (query.trim() && !`${alert.userId} ${alert.summary}`.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [alerts, query, severityFilter, statusFilter],
  );

  const openRate = useMemo(
    () => (stats.totalAlerts === 0 ? 0 : Math.round((stats.openAlerts / stats.totalAlerts) * 100)),
    [stats.openAlerts, stats.totalAlerts],
  );

  async function seedDemo() {
    await withLoading("Seeding demo data...", async () => {
      const response = await fetch("/api/seed", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Seed failed.");
      await refreshAlerts();
      setMsg(`Seeded ${data.ingestedCount} events · ${data.alertCount} alerts.`);
    }).catch((error: unknown) => setMsg(error instanceof Error ? error.message : "Seed failed."));
  }

  async function resetAll() {
    await withLoading("Resetting workspace...", async () => {
      await fetch("/api/reset", { method: "POST" });
      setSelectedAlertId("");
      setSelectedAlert(null);
      setExplanation(null);
      await Promise.all([refreshAlerts(), loadIntegrations()]);
      setMsg("Workspace reset.");
    }).catch((error: unknown) => setMsg(error instanceof Error ? error.message : "Reset failed."));
  }

  async function ingestCustom() {
    await withLoading("Ingesting payload...", async () => {
      const parsed = JSON.parse(jsonInput);
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ingestion failed.");
      await refreshAlerts();
      setMsg(`Ingested ${data.ingestedCount} events · ${data.alertCount} alerts.`);
    }).catch((error: unknown) => setMsg(error instanceof Error ? error.message : "Ingestion failed."));
  }

  async function uploadLogFile() {
    if (!uploadFile) {
      setMsg("Select a file first.");
      return;
    }

    await withLoading("Analysing log file...", async () => {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("model", aiModel);

      const response = await fetch("/api/ingest/upload", { method: "POST", body: formData });
      const data = (await response.json()) as UploadInsightReport | { error: string };
      if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "Upload failed.");

      setUploadReport(data);
      await refreshAlerts();
      setMsg(`${data.fileName} processed · ${data.eventCount} events.`);
    }).catch((error: unknown) => setMsg(error instanceof Error ? error.message : "Upload failed."));
  }

  async function updateSelectedAlert() {
    if (!selectedAlertId) return;

    await withLoading("Updating alert...", async () => {
      const response = await fetch(`/api/alerts/${selectedAlertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: noteInput.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Update failed.");
      setNoteInput("");
      await Promise.all([refreshAlerts(), loadAlertDetail(selectedAlertId)]);
      setMsg("Alert updated.");
    }).catch((error: unknown) => setMsg(error instanceof Error ? error.message : "Update failed."));
  }

  async function explainSelectedAlert() {
    if (!selectedAlertId) return;

    await withLoading("Generating explanation...", async () => {
      const response = await fetch(`/api/alerts/${selectedAlertId}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: aiModel }),
      });
      const data = (await response.json()) as ExplanationResponse | { error: string };
      if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "Explain failed.");
      setExplanation(data);
      setMsg("Explanation generated.");
    }).catch((error: unknown) => setMsg(error instanceof Error ? error.message : "Explain failed."));
  }

  async function connectIntegration() {
    await withLoading("Connecting integration...", async () => {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: integrationForm.provider,
          status: "connected",
          displayName: integrationForm.displayName.trim() || integrationForm.provider.toUpperCase(),
          metadata: {
            accountId: integrationForm.accountId.trim(),
            region: integrationForm.region.trim(),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Integration connect failed.");
      await loadIntegrations();
      setIsIntegrationModalOpen(false);
      setMsg(`${integrationForm.provider.toUpperCase()} connected.`);
    }).catch((error: unknown) => setMsg(error instanceof Error ? error.message : "Integration connect failed."));
  }

  async function disconnectIntegration(provider: IntegrationProvider) {
    await withLoading("Disconnecting integration...", async () => {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          status: "disconnected",
          displayName: provider.toUpperCase(),
          metadata: {},
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Disconnect failed.");
      await loadIntegrations();
      setMsg(`${provider.toUpperCase()} disconnected.`);
    }).catch((error: unknown) => setMsg(error instanceof Error ? error.message : "Disconnect failed."));
  }

  return {
    tab,
    setTab,
    alerts,
    stats,
    selectedAlertId,
    setSelectedAlertId,
    selectedAlert,
    status,
    setStatus,
    noteInput,
    setNoteInput,
    jsonInput,
    setJsonInput,
    uploadFile,
    setUploadFile,
    uploadReport,
    msg,
    loadingLabel,
    explanation,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    severityFilter,
    setSeverityFilter,
    isAiModalOpen,
    setIsAiModalOpen,
    isIntegrationModalOpen,
    setIsIntegrationModalOpen,
    aiModel,
    customModel,
    setCustomModel,
    integrations,
    integrationForm,
    setIntegrationForm,
    filteredAlerts,
    openRate,
    saveModel,
    clearUploadSelection,
    seedDemo,
    resetAll,
    ingestCustom,
    uploadLogFile,
    updateSelectedAlert,
    explainSelectedAlert,
    connectIntegration,
    disconnectIntegration,
  };
}
