/**
 * Database Resilience & High-Availability Utilities
 *
 * Prevents transient connection drops, timeouts, or severed idle sockets from
 * poisoning Next.js cache with 0/empty data.
 */

const globalForResilience = globalThis as unknown as {
  lastKnownGoodData: Map<string, any> | undefined;
};

const lastKnownGoodMap =
  globalForResilience.lastKnownGoodData ?? new Map<string, any>();

if (!globalForResilience.lastKnownGoodData) {
  globalForResilience.lastKnownGoodData = lastKnownGoodMap;
}

/**
 * Execute an async database query with automatic retry for transient connection failures.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 250
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || String(err);
      const isTransient =
        msg.includes("Connection terminated") ||
        msg.includes("connection terminated") ||
        msg.includes("closed") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("timeout") ||
        msg.includes("socket") ||
        msg.includes("Client has encountered a connection error") ||
        msg.includes("prepared statement") ||
        msg.includes("broken pipe");

      if (attempt < retries && isTransient) {
        const delay = baseDelayMs * (attempt + 1);
        console.warn(
          `[withDbRetry] Attempt ${attempt + 1} failed (${msg}). Retrying in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Executes a data fetcher with retries and a last-known-good in-memory fallback.
 * Ensures an admin or student dashboard NEVER shows 0 data due to a transient DB glitch.
 */
export async function getResilientData<T>(
  cacheKey: string,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const data = await withDbRetry(fetcher, 2, 200);
    // If the data is valid, store it as last known good
    if (data !== null && data !== undefined) {
      lastKnownGoodMap.set(cacheKey, data);
    }
    return data;
  } catch (err: any) {
    if (lastKnownGoodMap.has(cacheKey)) {
      console.warn(
        `[getResilientData] Database query failed for "${cacheKey}". Serving last known good data:`,
        err?.message || err
      );
      return lastKnownGoodMap.get(cacheKey) as T;
    }
    // If no previous good data exists, rethrow so unstable_cache doesn't store a failure
    throw err;
  }
}

/**
 * Retrieve the last known good in-memory data for a given cache key (if available).
 */
export function getLastKnownGood<T>(cacheKey: string): T | undefined {
  return lastKnownGoodMap.get(cacheKey) as T | undefined;
}

