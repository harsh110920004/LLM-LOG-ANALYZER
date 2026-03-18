import { explainAlertWithGemini } from "@/lib/gemini";
import { getAlertWithContext } from "@/lib/store";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  let model: string | undefined;
  try {
    const body = await request.json();
    model = typeof body?.model === "string" ? body.model : undefined;
  } catch {
    // body is optional, so ignore parse failures
  }

  const alert = await getAlertWithContext(id);
  if (!alert) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  }

  const explanation = await explainAlertWithGemini(alert, model);
  return NextResponse.json(explanation);
}
