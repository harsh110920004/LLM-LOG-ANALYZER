import { MODEL_OPTIONS } from "@/components/dashboard/constants";
import { BrainIcon } from "@/components/dashboard/icons";
import { Btn, Sheet } from "@/components/dashboard/ui";

export function AiSessionModal({
  isOpen,
  onClose,
  aiModel,
  saveModel,
  customModel,
  setCustomModel,
}: {
  isOpen: boolean;
  onClose: () => void;
  aiModel: string;
  saveModel: (model: string) => void;
  customModel: string;
  setCustomModel: (value: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <Sheet title="AI Session" icon={<BrainIcon className="h-4 w-4" />} onClose={onClose}>
      <p className="text-sm text-[#6879a4]">Choose the Gemini model. Stored locally per browser session.</p>
      <div className="mt-4 space-y-2">
        {MODEL_OPTIONS.map((model) => (
          <button
            key={model.id}
            type="button"
            onClick={() => saveModel(model.id)}
            className={`w-full rounded-xl border p-4 text-left transition ${
              aiModel === model.id
                ? "border-[#4f7eff]/60 bg-[#4f7eff]/10"
                : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-white">{model.title}</p>
                <p className="mt-0.5 text-xs text-[#6879a4]">{model.description}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${model.tagColor}`}>
                {model.tag}
              </span>
            </div>
            <p className="mt-2 font-mono text-[10px] text-[#3e5080]">{model.id}</p>
            {aiModel === model.id && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4f7eff]" />
                <span className="text-[10px] text-[#4f7eff]">Active</span>
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <label className="block text-[10px] uppercase tracking-[0.12em] text-[#3e5080]">Custom model ID</label>
        <div className="mt-2 flex gap-2">
          <input
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="e.g. gemini-3-flash-preview"
            className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-[#c5d6f5] outline-none focus:border-[#4f7eff]/60"
          />
          <Btn
            onClick={() => {
              if (customModel.trim()) saveModel(customModel.trim());
            }}
            primary
          >
            Apply
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}
