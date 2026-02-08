/**
 * Centralized LRU cache for PDF Blob URLs.
 *
 * Instead of each component independently fetching and caching base64 or Blob URLs,
 * this module provides a single shared cache with:
 *   - LRU eviction when the cache exceeds MAX_ENTRIES
 *   - Automatic Blob URL revocation on eviction
 *   - Memory-efficient: stores Blob URLs (~50 bytes each) instead of base64 strings (~133% of file size)
 *
 * Usage:
 *   import { pdfBlobCache } from "../lib/pdfCache";
 *   const url = pdfBlobCache.get(packetId);          // null if not cached
 *   pdfBlobCache.set(packetId, blobUrl, sizeBytes);  // cache a Blob URL
 *   pdfBlobCache.evict(packetId);                    // manually remove
 */

const MAX_ENTRIES = 20;
const MAX_TOTAL_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB of original file data (Blob URLs are cheap, but the underlying Blobs aren't)

/** @type {Map<string, { url: string, size: number, accessedAt: number }>} */
const cache = new Map();
let totalSize = 0;

function evictLRU() {
  // Find the least-recently-accessed entry
  let oldest = null;
  let oldestKey = null;
  for (const [key, entry] of cache) {
    if (!oldest || entry.accessedAt < oldest.accessedAt) {
      oldest = entry;
      oldestKey = key;
    }
  }
  if (oldestKey) {
    const entry = cache.get(oldestKey);
    if (entry) {
      try { URL.revokeObjectURL(entry.url); } catch { /* ignore */ }
      totalSize -= entry.size;
      cache.delete(oldestKey);
    }
  }
}

export const pdfBlobCache = {
  /**
   * Get a cached Blob URL for a packet ID.
   * Returns null if not in cache.
   */
  get(packetId) {
    const entry = cache.get(packetId);
    if (!entry) return null;
    entry.accessedAt = Date.now();
    return entry.url;
  },

  /**
   * Cache a Blob URL. sizeBytes is the approximate file size (for eviction decisions).
   */
  set(packetId, blobUrl, sizeBytes = 0) {
    // If already cached with same URL, just update access time
    const existing = cache.get(packetId);
    if (existing) {
      if (existing.url === blobUrl) {
        existing.accessedAt = Date.now();
        return;
      }
      // Different URL — revoke old one
      try { URL.revokeObjectURL(existing.url); } catch { /* ignore */ }
      totalSize -= existing.size;
      cache.delete(packetId);
    }

    // Evict until we're under limits
    while (cache.size >= MAX_ENTRIES || (totalSize + sizeBytes > MAX_TOTAL_SIZE_BYTES && cache.size > 0)) {
      evictLRU();
    }

    cache.set(packetId, {
      url: blobUrl,
      size: sizeBytes,
      accessedAt: Date.now(),
    });
    totalSize += sizeBytes;
  },

  /**
   * Manually evict a specific packet's cached Blob URL.
   */
  evict(packetId) {
    const entry = cache.get(packetId);
    if (!entry) return;
    try { URL.revokeObjectURL(entry.url); } catch { /* ignore */ }
    totalSize -= entry.size;
    cache.delete(packetId);
  },

  /**
   * Check if a packet's PDF is cached.
   */
  has(packetId) {
    return cache.has(packetId);
  },

  /**
   * Clear entire cache (e.g., on session reset).
   */
  clear() {
    for (const entry of cache.values()) {
      try { URL.revokeObjectURL(entry.url); } catch { /* ignore */ }
    }
    cache.clear();
    totalSize = 0;
  },

  /** Current number of cached items */
  get size() { return cache.size; },

  /** Approximate total cached data size in bytes */
  get totalBytes() { return totalSize; },
};
