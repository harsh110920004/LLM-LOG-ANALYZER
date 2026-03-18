import { ingestEvents } from "@/lib/store";
import type { IngestEvent } from "@/lib/types";
import { NextResponse } from "next/server";

function isEvent(value: unknown): value is IngestEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === "string" &&
    typeof candidate.eventType === "string" &&
    typeof candidate.action === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const events = Array.isArray(body) ? body : body.events;
    if (!Array.isArray(events) || !events.every(isEvent)) {
      return NextResponse.json(
        {
          error:
            "Invalid payload. Send an array of events or object with { events: [...] } and include userId, eventType, action.",
        },
        { status: 400 },
      );
    }

    const result = await ingestEvents(events);
    return NextResponse.json({
      ingestedCount: result.ingestedEvents.length,
      alertCount: result.createdAlerts.length,
      createdAlerts: result.createdAlerts,
    });
  } catch {
    return NextResponse.json({ error: "Could not parse JSON body." }, { status: 400 });
  }
}
