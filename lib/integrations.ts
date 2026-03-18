import { getPrismaClient } from "@/lib/db";
import type { IntegrationConnection, IntegrationProvider, IntegrationStatus } from "@/lib/types";

const DEFAULT_PROVIDERS: IntegrationProvider[] = ["aws", "gcp", "azure", "github", "slack"];

function prisma() {
  return getPrismaClient();
}

function mapConnection(input: {
  id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  displayName: string | null;
  metadata: unknown;
  connectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): IntegrationConnection {
  return {
    id: input.id,
    provider: input.provider,
    status: input.status,
    displayName: input.displayName,
    metadata: input.metadata,
    connectedAt: input.connectedAt ? input.connectedAt.toISOString() : null,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
  };
}

export async function listIntegrations(): Promise<IntegrationConnection[]> {
  const rows = await prisma().integrationConnection.findMany({
    orderBy: { provider: "asc" },
  });
  const existing = new Map(rows.map((row) => [row.provider, row]));
  const merged = DEFAULT_PROVIDERS.map((provider) => {
    const row = existing.get(provider);
    if (!row) {
      return {
        id: `virtual_${provider}`,
        provider,
        status: "disconnected" as const,
        displayName: null,
        metadata: null,
        connectedAt: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
    }
    return row;
  });
  return merged.map(mapConnection);
}

export async function upsertIntegrationConnection(input: {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  displayName?: string;
  metadata?: unknown;
}): Promise<IntegrationConnection> {
  const updated = await prisma().integrationConnection.upsert({
    where: { provider: input.provider },
    create: {
      provider: input.provider,
      status: input.status,
      displayName: input.displayName ?? null,
      metadata: (input.metadata ?? null) as never,
      connectedAt: input.status === "connected" ? new Date() : null,
    },
    update: {
      status: input.status,
      displayName: input.displayName ?? null,
      metadata: (input.metadata ?? null) as never,
      connectedAt: input.status === "connected" ? new Date() : null,
    },
  });
  return mapConnection(updated);
}
