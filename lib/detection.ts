import type { Anomaly, DetectionRule, NormalizedEvent } from "@/lib/types";

const RULE_WEIGHTS: Record<DetectionRule, number> = {
  OFF_HOURS_PRIVILEGED_ACTION: 35,
  IMPOSSIBLE_TRAVEL: 40,
  DOWNLOAD_SPIKE: 30,
  FAILED_LOGINS_THEN_SUCCESS: 25,
};

const PRIVILEGED_ACTIONS = new Set([
  "delete",
  "download",
  "export",
  "privilege_change",
]);

const DOWNLOAD_ACTIONS = new Set(["download", "export"]);

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function toDate(iso: string): Date {
  return new Date(iso);
}

function minutesBetween(a: string, b: string): number {
  return Math.abs(toDate(a).getTime() - toDate(b).getTime()) / (1000 * 60);
}

function isOffHours(iso: string): boolean {
  const hour = toDate(iso).getUTCHours();
  return hour < 6 || hour > 20;
}

function toRiskScore(rules: DetectionRule[]): number {
  const total = rules.reduce((sum, rule) => sum + RULE_WEIGHTS[rule], 0);
  return Math.min(100, total);
}

function toSeverity(riskScore: number): "low" | "medium" | "high" | "critical" {
  if (riskScore >= 80) return "critical";
  if (riskScore >= 60) return "high";
  if (riskScore >= 35) return "medium";
  return "low";
}

export function buildSummary(userId: string, rules: DetectionRule[]): string {
  const labels = rules.map((rule) => rule.toLowerCase().replaceAll("_", " "));
  return `User ${userId} triggered ${labels.join(", ")}.`;
}

export function runDetections(
  event: NormalizedEvent,
  allEvents: NormalizedEvent[],
): { anomalies: Anomaly[]; riskScore: number; severity: "low" | "medium" | "high" | "critical" } {
  const anomalies: Anomaly[] = [];
  const userEvents = allEvents.filter((item) => item.userId === event.userId);
  const nowIso = new Date().toISOString();

  if (isOffHours(event.timestamp) && PRIVILEGED_ACTIONS.has(event.action)) {
    anomalies.push({
      id: generateId("anomaly"),
      eventId: event.id,
      userId: event.userId,
      rule: "OFF_HOURS_PRIVILEGED_ACTION",
      score: RULE_WEIGHTS.OFF_HOURS_PRIVILEGED_ACTION,
      reason: "Privileged action occurred in off-hours UTC window (20:00-06:00).",
      createdAt: nowIso,
    });
  }

  if (event.eventType === "auth" && event.action === "login_success") {
    const previousLogins = userEvents
      .filter((item) => item.id !== event.id && item.eventType === "auth" && item.action === "login_success")
      .sort((a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime());
    const previous = previousLogins[0];
    if (previous && previous.geo !== event.geo && minutesBetween(previous.timestamp, event.timestamp) <= 120) {
      anomalies.push({
        id: generateId("anomaly"),
        eventId: event.id,
        userId: event.userId,
        rule: "IMPOSSIBLE_TRAVEL",
        score: RULE_WEIGHTS.IMPOSSIBLE_TRAVEL,
        reason: `Login moved from ${previous.geo} to ${event.geo} within 2 hours.`,
        createdAt: nowIso,
      });
    }
  }

  if (DOWNLOAD_ACTIONS.has(event.action)) {
    const windowStart = toDate(event.timestamp).getTime() - 30 * 60 * 1000;
    const recentDownloads = userEvents.filter(
      (item) =>
        DOWNLOAD_ACTIONS.has(item.action) &&
        toDate(item.timestamp).getTime() >= windowStart &&
        toDate(item.timestamp).getTime() <= toDate(event.timestamp).getTime(),
    );
    if (recentDownloads.length >= 10) {
      anomalies.push({
        id: generateId("anomaly"),
        eventId: event.id,
        userId: event.userId,
        rule: "DOWNLOAD_SPIKE",
        score: RULE_WEIGHTS.DOWNLOAD_SPIKE,
        reason: `High-volume download pattern detected (${recentDownloads.length} actions in 30 minutes).`,
        createdAt: nowIso,
      });
    }
  }

  if (event.eventType === "auth" && event.action === "login_success") {
    const windowStart = toDate(event.timestamp).getTime() - 20 * 60 * 1000;
    const recentAuth = userEvents.filter(
      (item) =>
        item.eventType === "auth" &&
        toDate(item.timestamp).getTime() >= windowStart &&
        toDate(item.timestamp).getTime() <= toDate(event.timestamp).getTime(),
    );
    const failedCount = recentAuth.filter((item) => item.action === "login_failed").length;
    if (failedCount >= 3) {
      anomalies.push({
        id: generateId("anomaly"),
        eventId: event.id,
        userId: event.userId,
        rule: "FAILED_LOGINS_THEN_SUCCESS",
        score: RULE_WEIGHTS.FAILED_LOGINS_THEN_SUCCESS,
        reason: `Detected ${failedCount} failed login attempts shortly before successful login.`,
        createdAt: nowIso,
      });
    }
  }

  const rules = anomalies.map((item) => item.rule);
  const riskScore = toRiskScore(rules);
  return { anomalies, riskScore, severity: toSeverity(riskScore) };
}
