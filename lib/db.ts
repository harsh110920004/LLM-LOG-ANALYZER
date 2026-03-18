import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClientFromEnv(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Configure Neon/Postgres connection in .env.");
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  if (globalThis.__prisma) {
    return globalThis.__prisma;
  }
  const client = createClientFromEnv();
  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = client;
  }
  return client;
}
