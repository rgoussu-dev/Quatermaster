/**
 * Escapes the closing delimiter of an XML-style fence so interpolated
 * untrusted content cannot terminate the fence early. Uses a zero-width
 * space inside the slash so the escaped form is still readable for humans
 * and models but no longer lexes as the closing tag.
 *
 * Example: `fence('actual-output', text)` wraps `text` so any
 * `</actual-output>` inside it becomes `<​/actual-output>`.
 */
export function fence(tag: string, content: string): string {
  const closer = `</${tag}>`;
  const safeCloser = `<​/${tag}>`;
  const escaped = content.split(closer).join(safeCloser);
  return `<${tag}>\n${escaped}\n</${tag}>`;
}
