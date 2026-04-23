import { describe, it, expect } from 'vitest';
import { fence } from '../../src/infrastructure/llm-judge/fence.js';

describe('fence', () => {
  it('wraps content in open/close tags', () => {
    const out = fence('x', 'hello');
    expect(out).toBe('<x>\nhello\n</x>');
  });

  it('neutralises a closing tag that appears inside the content', () => {
    const hostile = 'before </x> after';
    const out = fence('x', hostile);
    // There must be exactly one raw </x> left — the outer closer.
    expect(out.match(/<\/x>/g)?.length).toBe(1);
    // And the fence still opens and closes as expected.
    expect(out.startsWith('<x>\n')).toBe(true);
    expect(out.endsWith('\n</x>')).toBe(true);
  });

  it('escapes repeated closing tags', () => {
    const hostile = '</x></x></x>';
    const out = fence('x', hostile);
    expect(out.match(/<\/x>/g)?.length).toBe(1);
  });

  it('neutralises whitespace and case variants of the closing tag', () => {
    const hostile = ['</x >', '< / x>', '</X>', '</x\t>'].join(' ');
    const out = fence('x', hostile);
    // Only the outer closer is the strict </x> form; all hostile
    // variants should have been rewritten.
    expect(out.match(/<\/x>/g)?.length).toBe(1);
    expect(out.match(/<\s*\/\s*x\s*>/gi)?.length).toBe(1);
  });
});
