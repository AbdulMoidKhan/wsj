type ServiceHint = {slug: string; name: string};
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const containsPhrase = (text: string, phrase: string) => Boolean(phrase) && (' ' + text + ' ').includes(' ' + phrase + ' ');

/** Match only the live catalog. Exact/longer phrases win over shared words;
 * ambiguous hints leave selection to the customer instead of guessing a service.
 */
export function findCatalogServiceHint<T extends ServiceHint>(items: T[], service?: string): T | undefined {
  const hint = normalize(service || '');
  if (!hint) return undefined;
  const exact = items.find(item => normalize(item.slug) === hint) || items.find(item => normalize(item.name) === hint);
  if (exact) return exact;

  const candidates = items.map(item => {
    const phrases = [normalize(item.name), normalize(item.slug)];
    const phrase = phrases.filter(value => containsPhrase(hint, value)).sort((a, b) => b.length - a.length)[0] || '';
    return {item, score: phrase.length, phrase};
  }).filter(candidate => candidate.score > 0);
  if (candidates.length) {
    const longest = Math.max(...candidates.map(candidate => candidate.score));
    const best = candidates.filter(candidate => candidate.score === longest);
    if (best.length !== 1) return undefined;
    // A shorter nested name such as "Office" is harmless; two distinct service
    // phrases such as "Meeting Room or Conference Room" are ambiguous.
    return candidates.every(candidate => containsPhrase(best[0].phrase, candidate.phrase)) ? best[0].item : undefined;
  }

  const partial = items.filter(item => containsPhrase(normalize(item.name), hint) || containsPhrase(normalize(item.slug), hint));
  return partial.length === 1 ? partial[0] : undefined;
}
