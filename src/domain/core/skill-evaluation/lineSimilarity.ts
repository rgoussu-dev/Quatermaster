/**
 * Line-level similarity between two strings, scored 0–100.
 *
 * Uses Levenshtein edit distance on arrays of lines, then normalises:
 *   similarity = (1 − editDistance / max(lineCount)) × 100
 *
 * Trailing newlines and CRLF endings are normalised so `"a\n"` and `"a"`
 * compare as identical. Empty inputs on both sides score 100.
 */
export function lineSimilarity(a: string, b: string): number {
  const linesA = toLines(a);
  const linesB = toLines(b);

  if (linesA.length === 0 && linesB.length === 0) return 100;

  const distance = editDistance(linesA, linesB);
  const maxLen = Math.max(linesA.length, linesB.length);
  return Math.round((1 - distance / maxLen) * 100);
}

function toLines(s: string): readonly string[] {
  const normalised = s.replace(/\r\n/g, '\n').replace(/\n$/, '');
  return normalised === '' ? [] : normalised.split('\n');
}

function editDistance(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]!;
      } else {
        curr[j] = 1 + Math.min(prev[j - 1]!, prev[j]!, curr[j - 1]!);
      }
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}
