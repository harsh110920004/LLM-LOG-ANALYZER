"use client";

import type { ModelOption } from "@/components/dashboard/types";

export const SAMPLE_PAYLOAD = JSON.stringify(
  [
    { userId: "charlie", eventType: "auth", action: "login_failed", geo: "Berlin, DE", resource: "vpn" },
    { userId: "charlie", eventType: "auth", action: "login_failed", geo: "Berlin, DE", resource: "vpn" },
    { userId: "charlie", eventType: "auth", action: "login_failed", geo: "Berlin, DE", resource: "vpn" },
    { userId: "charlie", eventType: "auth", action: "login_success", geo: "Singapore, SG", resource: "vpn" },
  ],
  null,
  2,
);

export const DEFAULT_MODEL = "gemini-3-flash-preview";

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "gemini-3-flash-preview",
    title: "Gemini 3 Flash",
    description: "Balanced speed & reasoning for everyday SOC work.",
    tag: "Recommended",
    tagColor: "bg-blue-500/15 text-blue-300",
  },
  {
    id: "gemini-3.1-pro-preview",
    title: "Gemini 3.1 Pro",
    description: "Deepest analysis quality for high-risk incidents.",
    tag: "Most Capable",
    tagColor: "bg-violet-500/15 text-violet-300",
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    title: "Gemini 3.1 Flash-Lite",
    description: "High-volume workloads at minimal cost.",
    tag: "Cost Efficient",
    tagColor: "bg-emerald-500/15 text-emerald-300",
  },
];
