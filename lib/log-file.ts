import type { EventAction, EventType, IngestEvent } from "@/lib/types";

export interface ParsedLogFile {
  format: "json" | "ndjson" | "csv" | "kv-log";
  events: IngestEvent[];
  warnings: string[];
}

const EVENT_TYPES: EventType[] = ["auth", "file", "admin", "network", "app"];
const EVENT_ACTIONS: EventAction[] = [
  "login_success",
  "login_failed",
  "read",
  "download",
  "delete",
  "export",
  "privilege_change",
  "other",
];

function normalizeEventType(value: unknown): EventType {
  if (typeof value !== "string") return "app";
  return EVENT_TYPES.includes(value as EventType) ? (value as EventType) : "app";
}

function normalizeEventAction(value: unknown): EventAction {
  if (typeof value !== "string") return "other";
  return EVENT_ACTIONS.includes(value as EventAction) ? (value as EventAction) : "other";
}

function parseMetadata(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, item]) =>
      typeof item === "string" || typeof item === "number" || typeof item === "boolean",
  ) as [string, string | number | boolean][];
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function coerceEvent(raw: unknown): IngestEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const userId =
    (obj.userId as string | undefined) ??
    (obj.user as string | undefined) ??
    (obj.user_id as string | undefined);
  if (!userId || typeof userId !== "string") return null;

  const eventType = normalizeEventType(obj.eventType ?? obj.type ?? obj.category);
  const action = normalizeEventAction(obj.action ?? obj.eventAction ?? obj.event ?? obj.operation);
  const timestampValue = obj.timestamp ?? obj.time ?? obj.ts;
  const timestamp =
    typeof timestampValue === "string" && !Number.isNaN(Date.parse(timestampValue))
      ? timestampValue
      : undefined;

  return {
    userId,
    eventType,
    action,
    timestamp,
    deviceId: (obj.deviceId as string | undefined) ?? (obj.device as string | undefined),
    ip: (obj.ip as string | undefined) ?? (obj.sourceIp as string | undefined),
    geo: (obj.geo as string | undefined) ?? (obj.location as string | undefined),
    resource: (obj.resource as string | undefined) ?? (obj.target as string | undefined),
    role: (obj.role as string | undefined) ?? (obj.userRole as string | undefined),
    metadata: parseMetadata(obj.metadata),
    raw,
  };
}

function parseJson(text: string): ParsedLogFile | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown[] }).events)
        ? (parsed as { events: unknown[] }).events
        : null;
    if (!rows) return null;

    const events = rows.map(coerceEvent).filter((item): item is IngestEvent => item !== null);
    return { format: "json", events, warnings: events.length === rows.length ? [] : ["Some JSON records were skipped because required fields were missing."] };
  } catch {
    return null;
  }
}

function parseNdjson(text: string): ParsedLogFile | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const parsedLines: unknown[] = [];
  let parseFailures = 0;
  for (const line of lines) {
    try {
      parsedLines.push(JSON.parse(line));
    } catch {
      parseFailures += 1;
    }
  }
  if (parsedLines.length === 0) return null;

  const events = parsedLines.map(coerceEvent).filter((item): item is IngestEvent => item !== null);
  const warnings: string[] = [];
  if (parseFailures > 0) warnings.push(`${parseFailures} line(s) could not be parsed as JSON.`);
  if (events.length < parsedLines.length) warnings.push("Some NDJSON rows were missing required fields.");
  return { format: "ndjson", events, warnings };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): ParsedLogFile | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2 || !lines[0].includes(",")) return null;

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  if (!headers.includes("userid") && !headers.includes("user") && !headers.includes("user_id")) {
    return null;
  }
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  const objects = rows.map((row) => {
    const entry: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      entry[header] = row[index];
    });
    return {
      userId: entry.userid ?? entry.user ?? entry.user_id,
      eventType: entry.eventtype ?? entry.type,
      action: entry.action ?? entry.eventaction ?? entry.event,
      timestamp: entry.timestamp ?? entry.time,
      deviceId: entry.deviceid ?? entry.device,
      ip: entry.ip ?? entry.sourceip,
      geo: entry.geo ?? entry.location,
      resource: entry.resource ?? entry.target,
      role: entry.role,
      metadata: {},
    };
  });
  const events = objects.map(coerceEvent).filter((item): item is IngestEvent => item !== null);
  const warnings =
    events.length < rows.length ? ["Some CSV rows were skipped due to missing required fields."] : [];
  return { format: "csv", events, warnings };
}

function parseKeyValueLogs(text: string): ParsedLogFile | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const objects = lines.map((line) => {
    const record: Record<string, unknown> = {};
    const matches = line.matchAll(/([a-zA-Z0-9_]+)=("([^"]*)"|[^\s]+)/g);
    for (const match of matches) {
      const key = match[1];
      const value = match[3] ?? match[2];
      record[key] = value;
    }
    return record;
  });

  const events = objects.map(coerceEvent).filter((item): item is IngestEvent => item !== null);
  if (events.length === 0) return null;
  const warnings = events.length < objects.length ? ["Some log lines did not include user/action fields."] : [];
  return { format: "kv-log", events, warnings };
}

export function parseUploadedLogFile(content: string): ParsedLogFile {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Uploaded file is empty.");
  }

  const parsers = [parseJson, parseNdjson, parseCsv, parseKeyValueLogs];
  for (const parser of parsers) {
    const parsed = parser(trimmed);
    if (parsed && parsed.events.length > 0) {
      return parsed;
    }
  }
  throw new Error(
    "Could not parse log file. Supported formats: JSON array/object, NDJSON, CSV, or key=value log lines.",
  );
}
