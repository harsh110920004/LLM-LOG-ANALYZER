import { listIntegrations, upsertIntegrationConnection } from "@/lib/integrations";
import type { IntegrationProvider, IntegrationStatus } from "@/lib/types";
import { NextResponse } from "next/server";

const PROVIDERS: IntegrationProvider[] = ["aws", "gcp", "azure", "github", "slack"];
const STATUSES: IntegrationStatus[] = ["connected", "disconnected", "error"];

export async function GET() {
  const integrations = await listIntegrations();
  return NextResponse.json({ integrations });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as {
    provider?: IntegrationProvider;
    status?: IntegrationStatus;
    displayName?: string;
    metadata?: unknown;
  };

  if (!payload.provider || !PROVIDERS.includes(payload.provider)) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }
  if (!payload.status || !STATUSES.includes(payload.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const integration = await upsertIntegrationConnection({
    provider: payload.provider,
    status: payload.status,
    displayName: payload.displayName,
    metadata: payload.metadata,
  });

  return NextResponse.json({ integration });
}
