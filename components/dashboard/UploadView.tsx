import { MODEL_OPTIONS } from "@/components/dashboard/constants";
import { UploadIcon } from "@/components/dashboard/icons";
import { Btn } from "@/components/dashboard/ui";
import type { UploadInsightReport } from "@/components/dashboard/types";
import { useRef } from "react";

export function UploadView({
  uploadFile,
  setUploadFile,
  uploadReport,
  aiModel,
  saveModel,
  uploadLogFile,
  clearUploadSelection,
  msg,
}: {
  uploadFile: File | null;
  setUploadFile: (file: File | null) => void;
  uploadReport: UploadInsightReport | null;
  aiModel: string;
  saveModel: (model: string) => void;
  uploadLogFile: () => void;
  clearUploadSelection: () => void;
  msg: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4f7eff]/15">
            <UploadIcon className="h-5 w-5 text-[#7aadff]" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Upload Log File</h2>
            <p className="text-xs text-[#4f6699]">JSON · NDJSON · CSV · key=value</p>
          </div>
        </div>

        <div
          className="mt-5 cursor-pointer rounded-xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] p-8 text-center transition hover:border-[#4f7eff]/40 hover:bg-[#4f7eff]/5"
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon className="mx-auto h-8 w-8 text-[#2e4470]" />
          <p className="mt-2 text-sm font-medium text-[#8ba4d0]">{uploadFile ? uploadFile.name : "Click to choose a file"}</p>
          <p className="mt-1 text-xs text-[#3e5080]">
            {uploadFile ? `${Math.ceil(uploadFile.size / 1024)} KB · ready to analyse` : "Max 5 MB · .json .ndjson .csv .log .txt"}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.ndjson,.csv,.log,.txt"
            className="hidden"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="mt-4">
          <label className="block text-[10px] uppercase tracking-[0.12em] text-[#4f6699]">Gemini model</label>
          <select
            value={aiModel}
            onChange={(e) => saveModel(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-[#c5d6f5] outline-none"
          >
            {MODEL_OPTIONS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.title} - {model.id}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex gap-2">
          <Btn onClick={uploadLogFile} primary full>
            Upload & Analyse
          </Btn>
          {uploadFile && (
            <Btn onClick={clearUploadSelection} ghost>
              Clear
            </Btn>
          )}
        </div>

        {uploadReport && (
          <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="font-semibold text-emerald-300">{uploadReport.insight.summary}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Format", uploadReport.format.toUpperCase()],
                ["Events", String(uploadReport.eventCount)],
                ["Alerts", String(uploadReport.alertCount)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                  <p className="text-[10px] uppercase text-[#3e5080]">{label}</p>
                  <p className="mt-0.5 text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
            {uploadReport.insight.risks.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {uploadReport.insight.risks.map((risk) => (
                  <li key={risk} className="flex items-start gap-2 text-xs text-[#8ba4d0]">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {risk}
                  </li>
                ))}
              </ul>
            )}
            {uploadReport.warnings.length > 0 && (
              <ul className="mt-3 space-y-1">
                {uploadReport.warnings.map((warning) => (
                  <li key={warning} className="text-xs text-rose-300">
                    {warning}
                  </li>
                ))}
              </ul>
            )}
            {uploadReport.insight.meta?.usedFallback && (
              <p className="mt-2 text-xs text-[#f2c2c2]">Fallback: {uploadReport.insight.meta.error}</p>
            )}
          </div>
        )}
      </div>
      {msg && <p className="mt-3 text-center text-xs text-[#7aadff]">{msg}</p>}
    </div>
  );
}
