import { getAlertWithContext, updateAlert } from "@/lib/store";
import type { AlertStatus } from "@/lib/types";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ id: string }>;
}

const STATUSES: AlertStatus[] = ["open", "investigating", "resolved"];

export async function GET(_: Request, context: Params) {
  const { id } = await context.params;
  const alert = await getAlertWithContext(id);
  if (!alert) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  }
  return NextResponse.json(alert);
}

export async function PATCH(request: Request, context: Params) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as { status?: AlertStatus; note?: string };
  if (payload.status && !STATUSES.includes(payload.status)) {
    return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
  }

  const updated = await updateAlert(id, { status: payload.status, note: payload.note });
  if (!updated) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  }
  return NextResponse.json(updated);
}
