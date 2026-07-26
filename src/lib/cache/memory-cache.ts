// Optional in-memory TTL cache. The app must work if this is bypassed entirely.
interface Entry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.timestamp > hit.ttl) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttl: number): void {
  store.set(key, { value, timestamp: Date.now(), ttl });
}

// Convenience wrapper: return cached value or compute + store it.
export async function withCache<T>(
  key: string,
  ttl: number,
  compute: () => Promise<T>
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;
  const value = await compute();
  cacheSet(key, value, ttl);
  return value;
}
