import { CloseIcon } from "@/components/dashboard/icons";
import type { ReactNode } from "react";

export function Btn({
  onClick,
  primary,
  ghost,
  full,
  small,
  children,
  cls,
}: {
  onClick: () => void;
  primary?: boolean;
  ghost?: boolean;
  full?: boolean;
  small?: boolean;
  children: ReactNode;
  cls?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg font-medium transition",
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        full ? "w-full" : "",
        primary
          ? "bg-[#3559df] text-white hover:bg-[#2e4fc7] active:bg-[#2540b0]"
          : ghost
            ? "border border-white/[0.08] bg-white/[0.04] text-[#8ba4d0] hover:bg-white/[0.07]"
            : "border border-white/[0.08] bg-white/[0.04] text-[#8ba4d0] hover:bg-white/[0.07]",
        cls ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-sm text-[#a0bada] outline-none focus:border-[#4f7eff]/60"
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function KpiInline({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#3e5080]">{label}</p>
      <p className={`text-lg font-semibold leading-none ${danger ? "text-rose-400" : accent ? "text-amber-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

export function Sep() {
  return <span className="h-4 w-px bg-white/[0.08]" />;
}

export function RiskBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-rose-500" : score >= 60 ? "bg-orange-400" : score >= 35 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-semibold text-[#8ba4d0]">{score}</span>
    </div>
  );
}

export function SeverityDot({ sev, large }: { sev: string; large?: boolean }) {
  const map: Record<string, string> = {
    critical: "bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
    high: "bg-orange-400",
    medium: "bg-amber-400",
    low: "bg-emerald-500",
  };
  const size = large ? "h-3 w-3" : "h-2 w-2";

  return <span className={`inline-block rounded-full ${size} ${map[sev] ?? "bg-slate-500"}`} title={sev} />;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-rose-500/15 text-rose-300",
    investigating: "bg-amber-400/15 text-amber-300",
    resolved: "bg-emerald-500/15 text-emerald-300",
    connected: "bg-emerald-500/15 text-emerald-300",
    disconnected: "bg-slate-500/15 text-slate-400",
    error: "bg-rose-500/15 text-rose-300",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status] ?? "bg-slate-500/15 text-slate-400"}`}>
      {status}
    </span>
  );
}

export function Sheet({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.09] bg-[#0c0f1f] shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            {icon && <span className="text-[#7aadff]">{icon}</span>}
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#4f6699] transition hover:bg-white/[0.06] hover:text-white"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.09] bg-[#0c0f1f] px-5 py-3 shadow-2xl">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#4f7eff] border-t-transparent" />
        <span className="text-sm text-[#8ba4d0]">{label}</span>
      </div>
    </div>
  );
}
