/**
 * Best-effort redaction of credential-shaped strings before snapshot content
 * is sent to an LLM. This is not a security boundary — it catches the most
 * common shapes and reduces accidental exposure. Treat any input that leaves
 * the machine as potentially seen by the model provider.
 */

const SECRET_KEY_PATTERN =
  /("(?:[A-Za-z0-9_-]*(?:token|secret|password|apiKey|api_key|authorization|bearer)[A-Za-z0-9_-]*)"\s*:\s*)"[^"]*"/gi;

const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;

const ANTHROPIC_KEY_PATTERN = /sk-ant-[A-Za-z0-9_-]{20,}/g;

/**
 * Returns `text` with any value that lives under a credential-shaped key
 * replaced with `"<redacted>"`. Falls through untouched when no match is
 * found.
 */
export function redactSecrets(text: string | null): string | null {
  if (text === null) return null;
  return text
    .replace(SECRET_KEY_PATTERN, '$1"<redacted>"')
    .replace(BEARER_PATTERN, 'Bearer <redacted>')
    .replace(ANTHROPIC_KEY_PATTERN, '<redacted-anthropic-key>');
}
