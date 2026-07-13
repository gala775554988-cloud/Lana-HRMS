type CacheEntry<T> = {
  value?: T;
  promise?: Promise<T>;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ITEMS = 500;

function prune() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size > MAX_ITEMS) {
    const first = store.keys().next().value;
    if (!first) break;
    store.delete(first);
  }
}

export async function memoryCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    if (existing.value !== undefined) return existing.value;
    if (existing.promise) return existing.promise;
  }

  const promise = loader()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((error) => {
      store.delete(key);
      throw error;
    });

  store.set(key, { promise, expiresAt: now + ttlMs });
  prune();
  return promise;
}

export function clearMemoryCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
