import { describe, it, expect } from 'vitest';
import {
  buildClaudeArgs,
  extractJSON,
} from '../../src/infrastructure/claude-cli/runClaudeCLI.js';

describe('buildClaudeArgs', () => {
  it('emits -p <prompt> by default', () => {
    expect(buildClaudeArgs('hello')).toEqual(['-p', 'hello']);
  });

  it('prepends --tools "" when noTools is true', () => {
    expect(buildClaudeArgs('hello', { noTools: true })).toEqual(['--tools', '', '-p', 'hello']);
  });

  it('does not add --tools when noTools is false or omitted', () => {
    expect(buildClaudeArgs('hello', { noTools: false })).toEqual(['-p', 'hello']);
  });
});

describe('extractJSON', () => {
  it('parses a fenced ```json block', () => {
    const output = 'intro\n```json\n{"score": 80}\n```\ntrailer';
    expect(extractJSON(output)).toEqual({ score: 80 });
  });

  it('parses a bare JSON object when no fence is present', () => {
    const output = 'explanation\n{"score": 50, "observations": ["ok"]}\nmore';
    expect(extractJSON(output)).toEqual({ score: 50, observations: ['ok'] });
  });

  it('throws a descriptive error when no JSON is found', () => {
    expect(() => extractJSON('no json here, just a refusal')).toThrow(/No JSON found/);
  });
});
