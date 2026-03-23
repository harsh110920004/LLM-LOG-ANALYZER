import { Btn } from "@/components/dashboard/ui";
import type { NavTab } from "@/components/dashboard/types";

const TAB_TITLES: Record<NavTab, string> = {
  alerts: "Threat Alerts",
  upload: "Log File Upload",
  ingest: "Raw Payload Ingest",
  integrations: "Connected Apps",
};

export function TopBar({
  tab,
  filteredAlertCount,
  msg,
  seedDemo,
  resetAll,
}: {
  tab: NavTab;
  filteredAlertCount: number;
  msg: string;
  seedDemo: () => void;
  resetAll: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#08091a]/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold tracking-tight text-white">{TAB_TITLES[tab]}</h1>
        {tab === "alerts" && (
          <span className="rounded-full bg-[#4f7eff]/15 px-2 py-0.5 text-[11px] font-medium text-[#7aadff]">
            {filteredAlertCount} shown
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {msg && (
          <span className="max-w-xs truncate rounded-lg border border-[#1e3060] bg-[#0e1c3b] px-3 py-1 text-xs text-[#7aadff]">
            {msg}
          </span>
        )}
        <Btn onClick={seedDemo} ghost>
          Seed Demo
        </Btn>
        <Btn onClick={resetAll} ghost>
          Reset
        </Btn>
      </div>
    </header>
  );
}
