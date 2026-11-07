// Shared only by public catalog readers and administrator invalidation. Keeping
// this module independent avoids a CatalogService/BillingService import cycle.
const entries = new Map<string, {time: number; data: unknown}>();
const TTL_MS = 20000;
let generation = 0;

export function clearCatalogCache() {
  generation++;
  entries.clear();
}

export async function cachedCatalog<T>(key: string, build: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.time < TTL_MS) return hit.data as T;
  if (hit) entries.delete(key);
  const startedGeneration = generation;
  const data = await build();
  if (startedGeneration === generation) {
    entries.set(key, {time: Date.now(), data});
    if (entries.size > 200) entries.delete(entries.keys().next().value!);
  }
  return data;
}
