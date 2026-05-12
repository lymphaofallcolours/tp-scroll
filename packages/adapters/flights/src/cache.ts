import type { CheapestDirectArgs, FlightProvider, FlightQuote } from "./provider.js";

type CacheEntry = {
  readonly insertedAt: number;
  readonly value: FlightQuote | null;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_MAX_ENTRIES = 500;

export type CachingFlightProviderOptions = {
  readonly ttlMs?: number;
  readonly maxEntries?: number;
  readonly now?: () => number;
};

/**
 * In-memory LRU + TTL cache around a delegate FlightProvider. Caches both
 * successful quotes and `null` (no flight) responses — avoids re-hammering the
 * upstream for known-empty routes within the TTL.
 */
export class CachingFlightProvider implements FlightProvider {
  readonly name: string;
  private readonly delegate: FlightProvider;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(delegate: FlightProvider, opts: CachingFlightProviderOptions = {}) {
    this.delegate = delegate;
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = opts.now ?? Date.now;
    this.name = `cached(${delegate.name})`;
  }

  async cheapestDirect(args: CheapestDirectArgs): Promise<FlightQuote | null> {
    const key = this.keyFor(args);
    const hit = this.cache.get(key);
    if (hit !== undefined && this.now() - hit.insertedAt < this.ttlMs) {
      // Refresh LRU position.
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit.value;
    }
    const fresh = await this.delegate.cheapestDirect(args);
    this.set(key, { insertedAt: this.now(), value: fresh });
    return fresh;
  }

  invalidate(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private keyFor(args: CheapestDirectArgs): string {
    return `${args.origin.toUpperCase()}|${args.destination.toUpperCase()}|${args.date}`;
  }

  private set(key: string, entry: CacheEntry): void {
    this.cache.set(key, entry);
    while (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}
