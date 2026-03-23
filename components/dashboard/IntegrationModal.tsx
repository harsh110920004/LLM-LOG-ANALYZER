import { PlugIcon } from "@/components/dashboard/icons";
import { Btn, Sheet } from "@/components/dashboard/ui";
import type { IntegrationFormState } from "@/components/dashboard/types";
import type { IntegrationProvider } from "@/lib/types";

const PROVIDERS: IntegrationProvider[] = ["aws", "gcp", "azure", "github", "slack"];

export function IntegrationModal({
  isOpen,
  onClose,
  integrationForm,
  setIntegrationForm,
  connectIntegration,
}: {
  isOpen: boolean;
  onClose: () => void;
  integrationForm: IntegrationFormState;
  setIntegrationForm: (updater: (current: IntegrationFormState) => IntegrationFormState) => void;
  connectIntegration: () => void;
}) {
  if (!isOpen) return null;

  return (
    <Sheet title="Connect External App" icon={<PlugIcon className="h-4 w-4" />} onClose={onClose}>
      <p className="text-sm text-[#6879a4]">Register credentials for a pipeline connector.</p>
      <div className="mt-4 space-y-2">
        <label className="block text-[10px] uppercase tracking-[0.12em] text-[#3e5080]">Provider</label>
        <div className="grid grid-cols-5 gap-2">
          {PROVIDERS.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => setIntegrationForm((current) => ({ ...current, provider }))}
              className={`rounded-lg border py-2 text-xs font-semibold uppercase transition ${
                integrationForm.provider === provider
                  ? "border-[#4f7eff]/60 bg-[#4f7eff]/15 text-[#7aadff]"
                  : "border-white/[0.07] bg-white/[0.02] text-[#6879a4] hover:bg-white/[0.04]"
              }`}
            >
              {provider}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { label: "Display name", key: "displayName" as const, placeholder: "e.g. Production AWS" },
          { label: "Account / Workspace ID", key: "accountId" as const, placeholder: "123456789" },
          { label: "Region", key: "region" as const, placeholder: "us-east-1" },
        ].map((field) => (
          <div key={field.key}>
            <label className="block text-[10px] uppercase tracking-[0.12em] text-[#3e5080]">{field.label}</label>
            <input
              value={integrationForm[field.key]}
              onChange={(e) => setIntegrationForm((current) => ({ ...current, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="mt-1.5 w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-[#c5d6f5] outline-none focus:border-[#4f7eff]/60"
            />
          </div>
        ))}
      </div>
      <Btn onClick={connectIntegration} primary full cls="mt-4">
        Connect Integration
      </Btn>
    </Sheet>
  );
}
