"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";

interface Props {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

export function Tooltip({ content, children, side = "top" }: Props) {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 shadow-xl shadow-black/40 data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0"
          >
            {content}
            <RadixTooltip.Arrow className="fill-slate-700" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

/** Inline help icon next to a label. Hover to read explanation. */
export function HelpHint({ text }: { text: React.ReactNode }) {
  return (
    <Tooltip content={text}>
      <span className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-slate-600 text-[9px] text-slate-500 hover:border-cyan-400 hover:text-cyan-400 transition-colors">
        ?
      </span>
    </Tooltip>
  );
}
