import { createServerFn } from "@tanstack/react-start";

// In-worker cache. Cleared on cold start; fine for a 60s TTL.
type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  try {
    const value = await fetcher();
    cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  } catch (e) {
    // Serve stale on failure if we have it
    if (hit) return hit.value as T;
    throw e;
  }
}

const CG = "https://api.coingecko.com/api/v3";

export type MarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
  sparkline: number[];
  marketCap: number;
};

export type MarketSnapshot = {
  top: MarketCoin[];
  trending: { id: string; symbol: string; name: string; thumb: string; rank: number }[];
  fearGreed: { value: number; classification: string; updatedAt: string } | null;
  updatedAt: string;
};

export const getMarketSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  return cached<MarketSnapshot>("market", 60_000, async () => {
    const [topRes, trendingRes, fgRes] = await Promise.allSettled([
      fetch(
        `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=24h`,
        { headers: { accept: "application/json" } },
      ),
      fetch(`${CG}/search/trending`, { headers: { accept: "application/json" } }),
      fetch("https://api.alternative.me/fng/?limit=1"),
    ]);

    let top: MarketCoin[] = [];
    if (topRes.status === "fulfilled" && topRes.value.ok) {
      const arr = (await topRes.value.json()) as any[];
      top = arr.map((c) => ({
        id: c.id,
        symbol: (c.symbol ?? "").toUpperCase(),
        name: c.name,
        image: c.image,
        price: Number(c.current_price ?? 0),
        change24h: Number(c.price_change_percentage_24h ?? 0),
        sparkline: (c.sparkline_in_7d?.price ?? []).slice(-40).map((n: number) => Number(n)),
        marketCap: Number(c.market_cap ?? 0),
      }));
    }

    let trending: MarketSnapshot["trending"] = [];
    if (trendingRes.status === "fulfilled" && trendingRes.value.ok) {
      const j = (await trendingRes.value.json()) as any;
      trending = (j.coins ?? []).slice(0, 7).map((entry: any) => ({
        id: entry.item.id,
        symbol: (entry.item.symbol ?? "").toUpperCase(),
        name: entry.item.name,
        thumb: entry.item.small ?? entry.item.thumb,
        rank: entry.item.market_cap_rank ?? 0,
      }));
    }

    let fearGreed: MarketSnapshot["fearGreed"] = null;
    if (fgRes.status === "fulfilled" && fgRes.value.ok) {
      const j = (await fgRes.value.json()) as any;
      const first = j.data?.[0];
      if (first) {
        fearGreed = {
          value: Number(first.value),
          classification: String(first.value_classification),
          updatedAt: new Date(Number(first.timestamp) * 1000).toISOString(),
        };
      }
    }

    return { top, trending, fearGreed, updatedAt: new Date().toISOString() };
  });
});
