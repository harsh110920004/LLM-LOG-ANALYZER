import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prefer local dev secrets first, then fall back to default .env.
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
});
