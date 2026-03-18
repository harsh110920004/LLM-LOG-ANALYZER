import { getPrismaClient } from "@/lib/db";
import { buildSummary, runDetections } from "@/lib/detection";
import type {
  Alert,
  AlertStatus,
  AlertWithContext,
  DetectionRule,
  IngestEvent,
  NormalizedEvent,
} from "@/lib/types";

interface DbEvent {
  id: string;
  timestamp: Date;
  userId: string;
  deviceId: string;
  ip: string;
  geo: string;
  eventType: NormalizedEvent["eventType"];
  action: NormalizedEvent["action"];
  resource: string;
  role: string;
  metadata: unknown;
  raw: unknown;
}

interface DbAlertWithAnomalyIds {
  id: string;
  userId: string;
  eventId: string;
  severity: Alert["severity"];
  riskScore: number;
  summary: string;
  status: Alert["status"];
  createdAt: Date;
  updatedAt: Date;
  notes: string[];
  anomalyLinks: { anomalyId: string }[];
}

function normalizeEvent(input: IngestEvent): Omit<NormalizedEvent, "id"> {
  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    userId: input.userId,
    deviceId: input.deviceId ?? "unknown-device",
    ip: input.ip ?? "0.0.0.0",
    geo: input.geo ?? "unknown",
    eventType: input.eventType,
    action: input.action,
    resource: input.resource ?? "n/a",
    role: input.role ?? "user",
    metadata: input.metadata ?? {},
    raw: input.raw ?? input,
  };
}

function eventToType(event: DbEvent): NormalizedEvent {
  return {
    id: event.id,
    timestamp: event.timestamp.toISOString(),
    userId: event.userId,
    deviceId: event.deviceId,
    ip: event.ip,
    geo: event.geo,
    eventType: event.eventType,
    action: event.action,
    resource: event.resource,
    role: event.role,
    metadata: event.metadata as Record<string, string | number | boolean>,
    raw: event.raw,
  };
}

function alertToType(alert: DbAlertWithAnomalyIds): Alert {
  return {
    id: alert.id,
    userId: alert.userId,
    eventId: alert.eventId,
    anomalyIds: alert.anomalyLinks.map((item: { anomalyId: string }) => item.anomalyId),
    severity: alert.severity,
    riskScore: alert.riskScore,
    summary: alert.summary,
    status: alert.status,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
    notes: alert.notes,
  };
}

function toPrismaJson(value: unknown) {
  return value as never;
}

function prisma() {
  return getPrismaClient();
}

export async function ingestEvents(payload: IngestEvent[]): Promise<{
  ingestedEvents: NormalizedEvent[];
  createdAlerts: Alert[];
}> {
  const ingestedEvents: NormalizedEvent[] = [];
  const createdAlerts: Alert[] = [];

  for (const rawEvent of payload) {
    const normalized = normalizeEvent(rawEvent);
    const createdEvent = await prisma().event.create({
      data: {
        timestamp: new Date(normalized.timestamp),
        userId: normalized.userId,
        deviceId: normalized.deviceId,
        ip: normalized.ip,
        geo: normalized.geo,
        eventType: normalized.eventType,
        action: normalized.action,
        resource: normalized.resource,
        role: normalized.role,
        metadata: toPrismaJson(normalized.metadata),
        raw: toPrismaJson(normalized.raw),
      },
    });
    const persistedEvent = eventToType(createdEvent);
    ingestedEvents.push(persistedEvent);

    const userEvents = await prisma().event.findMany({
      where: { userId: persistedEvent.userId },
      orderBy: { timestamp: "asc" },
    });
    const detection = runDetections(
      persistedEvent,
      userEvents.map(eventToType),
    );
    if (detection.anomalies.length === 0) {
      continue;
    }

    const anomalyCreates = await Promise.all(
      detection.anomalies.map((item) =>
        prisma().anomaly.create({
          data: {
            eventId: persistedEvent.id,
            userId: persistedEvent.userId,
            rule: item.rule,
            score: item.score,
            reason: item.reason,
          },
        }),
      ),
    );

    const createdAlert = await prisma().alert.create({
      data: {
        userId: persistedEvent.userId,
        eventId: persistedEvent.id,
        severity: detection.severity,
        riskScore: detection.riskScore,
        summary: buildSummary(
          persistedEvent.userId,
          detection.anomalies.map((item) => item.rule as DetectionRule),
        ),
        status: "open",
        notes: [],
        anomalyLinks: {
          create: anomalyCreates.map((anomaly: { id: string }) => ({
            anomalyId: anomaly.id,
          })),
        },
      },
      include: { anomalyLinks: true },
    });

    createdAlerts.push(alertToType(createdAlert));
  }

  return { ingestedEvents, createdAlerts };
}

export async function listAlerts(): Promise<Alert[]> {
  const alerts = await prisma().alert.findMany({
    include: { anomalyLinks: true },
    orderBy: { createdAt: "desc" },
  });
  return alerts.map(alertToType);
}

export async function getAlertWithContext(alertId: string): Promise<AlertWithContext | null> {
  const alert = await prisma().alert.findUnique({
    where: { id: alertId },
    include: {
      event: true,
      anomalyLinks: {
        include: { anomaly: true },
      },
    },
  });
  if (!alert) {
    return null;
  }

  const relatedEvents = await prisma().event.findMany({
    where: { userId: alert.userId },
    orderBy: { timestamp: "desc" },
    take: 25,
  });

  return {
    ...alertToType(alert),
    anomalies: alert.anomalyLinks.map((item: {
      anomaly: {
        id: string;
        eventId: string;
        userId: string;
        rule: DetectionRule;
        score: number;
        reason: string;
        createdAt: Date;
      };
    }) => ({
      id: item.anomaly.id,
      eventId: item.anomaly.eventId,
      userId: item.anomaly.userId,
      rule: item.anomaly.rule,
      score: item.anomaly.score,
      reason: item.anomaly.reason,
      createdAt: item.anomaly.createdAt.toISOString(),
    })),
    event: eventToType(alert.event),
    relatedEvents: relatedEvents.map(eventToType),
  };
}

export async function updateAlert(
  alertId: string,
  updates: { status?: AlertStatus; note?: string },
): Promise<Alert | null> {
  const current = await prisma().alert.findUnique({
    where: { id: alertId },
    include: { anomalyLinks: true },
  });
  if (!current) {
    return null;
  }

  const updated = await prisma().alert.update({
    where: { id: alertId },
    data: {
      status: updates.status ?? current.status,
      notes: updates.note ? [...current.notes, updates.note] : current.notes,
    },
    include: { anomalyLinks: true },
  });

  return alertToType(updated);
}

export async function getSystemStats(): Promise<{
  totalEvents: number;
  totalAlerts: number;
  openAlerts: number;
  criticalAlerts: number;
}> {
  const [totalEvents, totalAlerts, openAlerts, criticalAlerts] =
    await prisma().$transaction([
      prisma().event.count(),
      prisma().alert.count(),
      prisma().alert.count({ where: { status: { not: "resolved" } } }),
      prisma().alert.count({ where: { severity: "critical" } }),
    ]);

  return { totalEvents, totalAlerts, openAlerts, criticalAlerts };
}

export async function resetStore(): Promise<void> {
  await prisma().$transaction([
    prisma().alertAnomaly.deleteMany(),
    prisma().alert.deleteMany(),
    prisma().anomaly.deleteMany(),
    prisma().event.deleteMany(),
  ]);
}

export async function seedDemoEvents(): Promise<{
  ingestedEvents: NormalizedEvent[];
  createdAlerts: Alert[];
}> {
  const now = Date.now();
  const demo: IngestEvent[] = [
    {
      timestamp: new Date(now - 50 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "auth",
      action: "login_success",
      role: "admin",
      resource: "vpn",
    },
    {
      timestamp: new Date(now - 40 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "file",
      action: "download",
      resource: "finance/payroll.csv",
      role: "admin",
    },
    {
      timestamp: new Date(now - 39 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "file",
      action: "download",
      resource: "finance/budgets.xlsx",
      role: "admin",
    },
    {
      timestamp: new Date(now - 38 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "file",
      action: "download",
      resource: "finance/planning.docx",
      role: "admin",
    },
    {
      timestamp: new Date(now - 37 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "file",
      action: "download",
      resource: "finance/audit-1.pdf",
      role: "admin",
    },
    {
      timestamp: new Date(now - 36 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "file",
      action: "download",
      resource: "finance/audit-2.pdf",
      role: "admin",
    },
    {
      timestamp: new Date(now - 35 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "file",
      action: "download",
      resource: "finance/audit-3.pdf",
      role: "admin",
    },
    {
      timestamp: new Date(now - 34 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "file",
      action: "download",
      resource: "finance/audit-4.pdf",
      role: "admin",
    },
    {
      timestamp: new Date(now - 33 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "file",
      action: "download",
      resource: "finance/audit-5.pdf",
      role: "admin",
    },
    {
      timestamp: new Date(now - 32 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "file",
      action: "download",
      resource: "finance/audit-6.pdf",
      role: "admin",
    },
    {
      timestamp: new Date(now - 31 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "file",
      action: "download",
      resource: "finance/audit-7.pdf",
      role: "admin",
    },
    {
      timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
      userId: "bob",
      deviceId: "bob-win",
      ip: "172.30.9.14",
      geo: "London, UK",
      eventType: "auth",
      action: "login_failed",
      role: "user",
      resource: "vpn",
    },
    {
      timestamp: new Date(now - 14 * 60 * 1000).toISOString(),
      userId: "bob",
      deviceId: "bob-win",
      ip: "172.30.9.14",
      geo: "London, UK",
      eventType: "auth",
      action: "login_failed",
      role: "user",
      resource: "vpn",
    },
    {
      timestamp: new Date(now - 13 * 60 * 1000).toISOString(),
      userId: "bob",
      deviceId: "bob-win",
      ip: "172.30.9.14",
      geo: "London, UK",
      eventType: "auth",
      action: "login_failed",
      role: "user",
      resource: "vpn",
    },
    {
      timestamp: new Date(now - 12 * 60 * 1000).toISOString(),
      userId: "bob",
      deviceId: "bob-win",
      ip: "172.30.9.14",
      geo: "Tokyo, JP",
      eventType: "auth",
      action: "login_success",
      role: "user",
      resource: "vpn",
    },
    {
      timestamp: new Date(now - 11 * 60 * 1000).toISOString(),
      userId: "alice",
      deviceId: "alice-mac",
      ip: "10.1.1.8",
      geo: "New York, US",
      eventType: "admin",
      action: "privilege_change",
      role: "admin",
      resource: "iam/roles",
    },
  ];
  return ingestEvents(demo);
}
