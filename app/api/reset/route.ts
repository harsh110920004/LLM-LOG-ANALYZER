import { resetStore } from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST() {
  await resetStore();
  return NextResponse.json({ message: "Database state reset." });
}
