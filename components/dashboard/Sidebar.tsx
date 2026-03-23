import {
  BellIcon,
  BrainIcon,
  PlugIcon,
  ShieldIcon,
  TerminalIcon,
  UploadIcon,
} from "@/components/dashboard/icons";
import type { NavTab } from "@/components/dashboard/types";
import type { ReactNode } from "react";

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: ReactNode }> = [
  { id: "alerts", label: "Alerts", icon: <BellIcon className="h-4 w-4" /> },
  { id: "upload", label: "Log Upload", icon: <UploadIcon className="h-4 w-4" /> },
  { id: "ingest", label: "Raw Ingest", icon: <TerminalIcon className="h-4 w-4" /> },
  { id: "integrations", label: "Integrations", icon: <PlugIcon className="h-4 w-4" /> },
];

export function Sidebar({
  tab,
  setTab,
  aiModel,
  openAiModal,
  openIntegrationModal,
}: {
  tab: NavTab;
  setTab: (tab: NavTab) => void;
  aiModel: string;
  openAiModal: () => void;
  openIntegrationModal: () => void;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#0b0d17]">
      <div className="px-5 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <ShieldIcon className="h-5 w-5 text-[#4f7eff]" />
          <span className="text-sm font-semibold tracking-tight">Alabama</span>
        </div>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-[#5a6a8a]">Security Ops Console</p>
      </div>

      <nav className="mt-1 flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              tab === item.id
                ? "bg-[#4f7eff]/15 font-medium text-[#7aadff]"
                : "text-[#6879a4] hover:bg-white/[0.04] hover:text-[#b5c6e8]"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-1 border-t border-white/[0.06] px-2 py-3">
        <button
          type="button"
          onClick={openAiModal}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#6879a4] hover:bg-white/[0.04] hover:text-[#b5c6e8]"
        >
          <BrainIcon className="h-4 w-4" />
          AI Session
        </button>
        <button
          type="button"
          onClick={openIntegrationModal}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#6879a4] hover:bg-white/[0.04] hover:text-[#b5c6e8]"
        >
          <PlugIcon className="h-4 w-4" />
          Connect Apps
        </button>
      </div>

      <div className="border-t border-white/[0.06] px-4 py-3">
        <p className="text-[10px] text-[#3e4d6a]">Model</p>
        <p className="mt-0.5 truncate text-xs text-[#5a7ac7]">{aiModel}</p>
      </div>
    </aside>
  );
}
