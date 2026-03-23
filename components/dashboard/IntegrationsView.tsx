import { Btn, StatusPill } from "@/components/dashboard/ui";
import type { IntegrationFormState } from "@/components/dashboard/types";
import type { IntegrationConnection, IntegrationProvider } from "@/lib/types";

const COLORS: Record<IntegrationProvider, string> = {
  aws: "from-orange-500/10",
  gcp: "from-blue-500/10",
  azure: "from-sky-500/10",
  github: "from-slate-500/10",
  slack: "from-purple-500/10",
};

export function IntegrationsView({
  integrations,
  openIntegrationModal,
  setIntegrationForm,
  disconnectIntegration,
  msg,
}: {
  integrations: IntegrationConnection[];
  openIntegrationModal: () => void;
  setIntegrationForm: (updater: (current: IntegrationFormState) => IntegrationFormState) => void;
  disconnectIntegration: (provider: IntegrationProvider) => void;
  msg: string;
}) {
  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-[#4f6699]">Manage external data source connections.</p>
        <Btn onClick={openIntegrationModal} primary>
          Connect App
        </Btn>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div
            key={integration.provider}
            className={`rounded-2xl border border-white/[0.06] bg-gradient-to-br ${COLORS[integration.provider]} to-transparent p-5`}
          >
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold uppercase text-white">{integration.provider}</p>
              <StatusPill status={integration.status} />
            </div>
            <p className="mt-1 text-xs text-[#4f6699]">{integration.displayName ?? "—"}</p>
            <div className="mt-4 flex gap-2">
              {integration.status === "connected" ? (
                <Btn onClick={() => disconnectIntegration(integration.provider)} ghost small>
                  Disconnect
                </Btn>
              ) : (
                <Btn
                  onClick={() => {
                    setIntegrationForm((current) => ({ ...current, provider: integration.provider }));
                    openIntegrationModal();
                  }}
                  ghost
                  small
                >
                  Connect
                </Btn>
              )}
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="mt-4 text-xs text-[#7aadff]">{msg}</p>}
    </div>
  );
}
