import { summarizeUploadWithGemini } from "@/lib/gemini";
import { parseUploadedLogFile } from "@/lib/log-file";
import { ingestEvents } from "@/lib/store";
import { NextResponse } from "next/server";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const model = form.get("model");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file in form-data field `file`." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max size is ${MAX_FILE_BYTES / (1024 * 1024)}MB.` },
        { status: 413 },
      );
    }

    const content = await file.text();
    const parsed = parseUploadedLogFile(content);
    const ingestResult = await ingestEvents(parsed.events);

    const insight = await summarizeUploadWithGemini({
      fileName: file.name,
      format: parsed.format,
      eventCount: parsed.events.length,
      alertCount: ingestResult.createdAlerts.length,
      topAlerts: ingestResult.createdAlerts.slice(0, 5).map((item) => ({
        userId: item.userId,
        riskScore: item.riskScore,
        severity: item.severity,
        summary: item.summary,
      })),
      model: typeof model === "string" ? model : undefined,
    });

    return NextResponse.json({
      fileName: file.name,
      format: parsed.format,
      eventCount: parsed.events.length,
      alertCount: ingestResult.createdAlerts.length,
      warnings: parsed.warnings,
      insight,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not process uploaded log file." },
      { status: 400 },
    );
  }
}
