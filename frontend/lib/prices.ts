// Jupiter Price API v3 (lite tier, no auth) — USD prices only.
// https://lite-api.jup.ag/price/v3?ids=<mint1>,<mint2>
//
// Response shape:
//   { "<mint>": { usdPrice, decimals, priceChange24h, ... } }

export const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface TokenPrice {
  usdPrice: number;
  decimals: number;
  priceChange24h?: number;
}

export type PriceMap = Record<string, TokenPrice>;

export async function fetchTokenPrices(mints: string[]): Promise<PriceMap> {
  if (mints.length === 0) return {};
  try {
    const url = `https://lite-api.jup.ag/price/v3?ids=${mints.join(",")}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn("[prices] HTTP", res.status);
      return {};
    }
    return (await res.json()) as PriceMap;
  } catch (e) {
    console.warn("[prices] fetch failed:", e);
    return {};
  }
}

export function formatUsd(value: number): string {
  if (!isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs < 0.01) return `$${value.toFixed(4)}`;
  if (abs < 1) return `$${value.toFixed(3)}`;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPct(value: number): string {
  if (!isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
