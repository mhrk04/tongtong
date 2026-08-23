import type { BillParticipant } from "./bill-store";

export const PRIMARY_BUTTON_CLASS =
  "w-full cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50";

export const TEXT_INPUT_CLASS =
  "w-full rounded-lg border border-border-low bg-background px-3 py-2 text-sm outline-none focus:border-ring";

export const ADDRESS_INPUT_CLASS =
  "w-full rounded-lg border border-border-low bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring";

export const ACTION_CARD_CLASS =
  "rounded-2xl border border-border-low bg-card p-6";

export const FLOW_SECTION_CLASS =
  "rounded-3xl border border-border-low bg-card p-6 shadow-sm sm:p-8";

export const FLOW_INPUT_CLASS =
  "rounded-xl border border-border-low bg-background px-4 py-3 outline-none focus:border-ring";

export function statusPillClass(status: BillParticipant["status"]) {
  return status === "paid"
    ? "bg-green-500/10 text-green-700 dark:text-green-300"
    : "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}
