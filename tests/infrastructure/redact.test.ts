import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../../src/infrastructure/llm-judge/redact.js';

describe('redactSecrets', () => {
  it('returns null when input is null', () => {
    expect(redactSecrets(null)).toBeNull();
  });

  it('redacts credential-shaped keys in a JSON blob', () => {
    const input = JSON.stringify({
      apiKey: 'sk-abc-123',
      nested: { token: 'xyz', secret_key: 'ssh' },
      password: 'hunter2',
    });
    const out = redactSecrets(input);
    expect(out).not.toContain('sk-abc-123');
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('xyz');
    expect(out).toContain('<redacted>');
  });

  it('redacts Bearer tokens', () => {
    expect(redactSecrets('Authorization: Bearer abcdefghij1234')).toBe(
      'Authorization: Bearer <redacted>',
    );
  });

  it('redacts Anthropic API keys', () => {
    const out = redactSecrets('key=sk-ant-abcdefghijklmnopqrstuv');
    expect(out).toContain('<redacted-anthropic-key>');
  });

  it('is a no-op for content without secrets', () => {
    expect(redactSecrets('just a regular string')).toBe('just a regular string');
  });
});
