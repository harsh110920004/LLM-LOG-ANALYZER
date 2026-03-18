import { getSystemStats, listAlerts } from "@/lib/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const [stats, alerts] = await Promise.all([getSystemStats(), listAlerts()]);
  return NextResponse.json({
    stats,
    alerts,
  });
}
