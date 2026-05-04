import { toast } from "sonner";

/**
 * Standard tx success toast: title + amount/details + "View tx" action that
 * opens the explorer in a new tab. Used after sendTx() resolves.
 */
export function toastSuccess(title: string, description?: string, explorer?: string) {
  toast.success(title, {
    description,
    action: explorer
      ? { label: "View tx", onClick: () => window.open(explorer, "_blank", "noopener,noreferrer") }
      : undefined,
    duration: 6000,
  });
}

export function toastError(title: string, e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  // Trim long Anchor error blobs — keep the first non-empty line for the tip
  const short = msg.split("\n").find((l) => l.trim().length > 0)?.slice(0, 200) ?? msg;
  toast.error(title, {
    description: short,
    duration: 8000,
  });
}

export function toastInfo(title: string, description?: string) {
  toast(title, { description, duration: 4000 });
}

export { toast };
