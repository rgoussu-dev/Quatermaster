/**
 * Escapes the closing delimiter of an XML-style fence so interpolated
 * untrusted content cannot terminate the fence early.
 *
 * Matches permissively — `</tag>`, `</tag >`, `< / tag>`, `</TAG>` all
 * count as close-tag variants worth neutralising, because a model may
 * treat any of them as the end of the fence when scanning prose.
 *
 * The matched closer has a zero-width space (U+200B) inserted right
 * after the opening `<`, which stops it from re-lexing as the same tag
 * without meaningfully altering what the model reads. We write U+200B
 * as a `​` escape rather than a literal so it's visible in
 * diffs and review tooling.
 *
 * Example: `fence('actual-output', text)` wraps `text` and rewrites
 * any `</actual-output>` inside it to `<​/actual-output>`.
 */
const ZERO_WIDTH_SPACE = '\u200B';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function fence(tag: string, content: string): string {
  const escapedTag = escapeRegExp(tag);
  const closerPattern = new RegExp(`<\\s*/\\s*${escapedTag}\\s*>`, 'gi');
  const escaped = content.replace(
    closerPattern,
    (match) => `<${ZERO_WIDTH_SPACE}${match.slice(1)}`,
  );
  return `<${tag}>\n${escaped}\n</${tag}>`;
}
