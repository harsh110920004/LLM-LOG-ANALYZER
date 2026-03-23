import { TerminalIcon } from "@/components/dashboard/icons";
import { Btn } from "@/components/dashboard/ui";

export function IngestView({
  jsonInput,
  setJsonInput,
  ingestCustom,
  msg,
}: {
  jsonInput: string;
  setJsonInput: (value: string) => void;
  ingestCustom: () => void;
  msg: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4f7eff]/15">
            <TerminalIcon className="h-5 w-5 text-[#7aadff]" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Raw JSON Ingest</h2>
            <p className="text-xs text-[#4f6699]">POST /api/ingest · array or object with events[]</p>
          </div>
        </div>

        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          rows={14}
          spellCheck={false}
          className="mt-4 w-full rounded-xl border border-white/[0.07] bg-[#060812] p-4 font-mono text-xs text-[#8ba4d0] outline-none focus:border-[#4f7eff]/50"
        />
        <Btn onClick={ingestCustom} primary full cls="mt-3">
          Send Payload
        </Btn>
        {msg && <p className="mt-3 text-xs text-[#7aadff]">{msg}</p>}
      </div>
    </div>
  );
}
