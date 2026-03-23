"use client";

import type {
  Alert,
  AlertStatus,
  AlertWithContext,
  ExplainMeta,
  IntegrationProvider,
} from "@/lib/types";

export interface AlertsStats {
  totalEvents: number;
  totalAlerts: number;
  openAlerts: number;
  criticalAlerts: number;
}

export interface AlertsResponse {
  stats: AlertsStats;
  alerts: Alert[];
}

export interface ExplanationResponse {
  headline: string;
  explanation: string;
  nextSteps: string[];
  meta?: ExplainMeta;
}

export interface UploadInsightReport {
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

export interface ModelOption {
  id: string;
  title: string;
  description: string;
  tag: string;
  tagColor: string;
}

export interface IntegrationFormState {
  provider: IntegrationProvider;
  displayName: string;
  accountId: string;
  region: string;
}

export type NavTab = "alerts" | "upload" | "ingest" | "integrations";

export type AlertFilters = {
  query: string;
  statusFilter: "all" | AlertStatus;
  severityFilter: "all" | "low" | "medium" | "high" | "critical";
};

export type SelectedAlert = AlertWithContext | null;
