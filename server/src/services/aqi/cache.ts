/**
 * @module aqiCache
 * Bounded O(1) in-memory LRU cache with per-entry TTL expiration and SHA-256 coordinate key hashing.
 */

import { createHash } from 'node:crypto';
import type { CacheStats } from './types';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Generates a deterministic SHA-256 cache key for a coordinate pair and query kind.
 * Coordinates are rounded to 3 decimal places (~111m resolution) to maximize cache hits
 * for co-located urban requests without losing neighborhood fidelity.
 */
export function createAQICacheKey(kind: 'current' | 'forecast', lat: number, lng: number): string {
  const normalized = `${kind}:${lat.toFixed(3)},${lng.toFixed(3)}`;
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * In-memory LRU cache with fixed maximum capacity and per-entry TTL expiration.
 * Uses JavaScript Map insertion order to maintain O(1) get/set/eviction semantics.
 */
export class LRUCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxEntries: number, ttlMs: number, now: () => number = Date.now) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError(`maxEntries must be a positive integer; received ${maxEntries}.`);
    }
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError(`ttlMs must be a positive number; received ${ttlMs}.`);
    }
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  /** Retrieves a fresh entry and marks it as most recently used, or returns `undefined`. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }

    if (this.now() >= entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }

    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  /** Inserts or updates an entry, evicting the least recently used entry if full. */
  set(key: string, value: T): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      this.purgeExpired();
      if (this.store.size >= this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey !== undefined) {
          this.store.delete(oldestKey);
          this.evictions += 1;
        }
      }
    }

    this.store.set(key, {
      value,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  /** Removes all cached entries. */
  clear(): void {
    this.store.clear();
  }

  /** Returns cache capacity and hit/miss metrics. */
  stats(): CacheStats {
    this.purgeExpired();
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }

  private purgeExpired(): void {
    const current = this.now();
    for (const [key, entry] of this.store.entries()) {
      if (current >= entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
