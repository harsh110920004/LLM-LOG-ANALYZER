import { resetStore, seedDemoEvents } from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST() {
  await resetStore();
  const result = await seedDemoEvents();
  return NextResponse.json({
    message: "Demo data seeded.",
    ingestedCount: result.ingestedEvents.length,
    alertCount: result.createdAlerts.length,
  });
}
