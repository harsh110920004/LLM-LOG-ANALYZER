import type { AlertWithContext, ExplainMeta } from "@/lib/types";
import { GoogleGenAI } from "@google/genai";

export interface ExplanationResult {
  headline: string;
  explanation: string;
  nextSteps: string[];
  meta: ExplainMeta;
}

export interface UploadInsightResult {
  summary: string;
  risks: string[];
  meta: ExplainMeta;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] ?? trimmed;
}

function safeParseExplanation(text: string): Omit<ExplanationResult, "meta"> | null {
  try {
    const parsed = JSON.parse(extractJsonObject(text)) as Partial<ExplanationResult>;
    if (
      typeof parsed.headline === "string" &&
      typeof parsed.explanation === "string" &&
      Array.isArray(parsed.nextSteps) &&
      parsed.nextSteps.every((item) => typeof item === "string")
    ) {
      return {
        headline: parsed.headline,
        explanation: parsed.explanation,
        nextSteps: parsed.nextSteps,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function fallbackExplanation(alert: AlertWithContext, meta: ExplainMeta): ExplanationResult {
  const reasons = alert.anomalies.map((item) => item.reason);
  return {
    headline: `Risk score ${alert.riskScore} (${alert.severity}) for user ${alert.userId}`,
    explanation: [
      `This alert was generated from ${alert.anomalies.length} anomaly signal(s).`,
      ...reasons.map((reason) => `- ${reason}`),
      `Trigger event: ${alert.event?.action ?? "unknown"} on ${alert.event?.resource ?? "n/a"}.`,
    ].join("\n"),
    nextSteps: [
      "Validate whether the account owner initiated the activity.",
      "Check endpoint health and identity logs for compromised credentials.",
      "Review timeline for lateral movement and data exfiltration patterns.",
    ],
    meta,
  };
}

function isAllowedModel(model: string): boolean {
  return /^[a-zA-Z0-9._-]{3,120}$/.test(model);
}

/**
 * Converts a raw SDK or network error into a short, human-readable string.
 * Gemini SDK errors often carry the entire JSON response body as error.message.
 */
function parseGeminiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  // Try to extract a structured Gemini/gRPC error payload from the message
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const body = JSON.parse(jsonMatch[0]) as {
        error?: { code?: number; message?: string; status?: string };
      };
      const inner = body?.error;
      if (inner) {
        const code = inner.code ?? "";
        const status = inner.status ?? "";
        const msg = inner.message ?? "";

        if (code === 429 || status === "RESOURCE_EXHAUSTED") {
          return `Rate limit exceeded (429). The API key's per-minute quota is full — wait ~60 s and try again, or request a quota increase at console.cloud.google.com.`;
        }
        if (code === 401 || code === 403) {
          return `Authentication error (${code}): check that GEMINI_API_KEY is valid and has the Generative Language API enabled.`;
        }
        if (code === 400) {
          return `Bad request (400): ${msg}`;
        }
        if (msg) {
          return `Gemini API error ${code ? `(${code}) ` : ""}— ${msg}`;
        }
      }
    }
  } catch {
    // fallthrough to raw
  }

  // Strip raw JSON noise for non-structured errors
  const clean = raw.replace(/\{[\s\S]{0,2000}\}/, "").trim();
  return clean || "Unknown Gemini API error.";
}

export async function explainAlertWithGemini(
  alert: AlertWithContext,
  modelOverride?: string,
): Promise<ExplanationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = modelOverride?.trim() || process.env.GEMINI_MODEL || "gemini-3-flash-preview";

  if (!apiKey) {
    return fallbackExplanation(alert, {
      provider: "gemini",
      model,
      usedFallback: true,
      error: "GEMINI_API_KEY is missing on server.",
    });
  }

  if (!isAllowedModel(model)) {
    return fallbackExplanation(alert, {
      provider: "gemini",
      model,
      usedFallback: true,
      error: "Invalid model name format.",
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = [
    "You are a senior SOC analyst for insider-threat detection.",
    "Given the alert context, return strict JSON with keys: headline, explanation, nextSteps.",
    "Rules:",
    "- explanation should be concise and actionable.",
    "- nextSteps must contain exactly 3 short bullet-like strings.",
    "- no markdown, no code fences, only JSON object.",
    "",
    "Alert Context:",
    JSON.stringify(alert),
  ].join("\n");

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    const text = response.text?.trim() ?? "";
    const parsed = safeParseExplanation(text);
    if (parsed) {
      return {
        ...parsed,
        meta: {
          provider: "gemini",
          model,
          usedFallback: false,
        },
      };
    }
    return fallbackExplanation(alert, {
      provider: "gemini",
      model,
      usedFallback: true,
      error: "Model response was not valid JSON.",
    });
  } catch (error) {
    return fallbackExplanation(alert, {
      provider: "gemini",
      model,
      usedFallback: true,
      error: parseGeminiError(error),
    });
  }
}

export async function summarizeUploadWithGemini(input: {
  model?: string;
  fileName: string;
  format: string;
  eventCount: number;
  alertCount: number;
  topAlerts: Array<{ userId: string; riskScore: number; severity: string; summary: string }>;
}): Promise<UploadInsightResult> {
  const model = input.model?.trim() || process.env.GEMINI_MODEL || "gemini-3-flash-preview";
  const apiKey = process.env.GEMINI_API_KEY;

  const fallback = (error?: string): UploadInsightResult => ({
    summary: `Ingested ${input.eventCount} events from ${input.fileName} (${input.format}) and produced ${input.alertCount} alerts.`,
    risks: input.topAlerts.slice(0, 3).map((item) => `${item.userId}: ${item.summary} (risk ${item.riskScore})`),
    meta: {
      provider: "gemini",
      model,
      usedFallback: true,
      error,
    },
  });

  if (!apiKey) {
    return fallback("GEMINI_API_KEY is missing on server.");
  }
  if (!isAllowedModel(model)) {
    return fallback("Invalid model name format.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = [
    "You are a SOC analyst assistant.",
    "Return strict JSON with keys: summary (string) and risks (string array, 3 items).",
    "No markdown or code fences.",
    "Context:",
    JSON.stringify(input),
  ].join("\n");

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    const text = response.text?.trim() ?? "";
    const parsed = JSON.parse(extractJsonObject(text)) as Partial<UploadInsightResult>;
    if (
      typeof parsed.summary === "string" &&
      Array.isArray(parsed.risks) &&
      parsed.risks.every((item) => typeof item === "string")
    ) {
      return {
        summary: parsed.summary,
        risks: parsed.risks.slice(0, 3),
        meta: {
          provider: "gemini",
          model,
          usedFallback: false,
        },
      };
    }
    return fallback("Model response was not valid JSON.");
  } catch (error) {
    return fallback(parseGeminiError(error));
  }
}
