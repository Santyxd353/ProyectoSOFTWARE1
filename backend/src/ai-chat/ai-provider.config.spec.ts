import { resolveAiProviderConfig } from './ai-provider.config';

describe('resolveAiProviderConfig', () => {
  const configWith = (values: Record<string, string | undefined>) => ({
    get: jest.fn((key: string) => values[key]),
  });

  it('prefers the standard Anthropic key and keeps the legacy key as fallback', () => {
    const standard = resolveAiProviderConfig(configWith({
      ANTHROPIC_API_KEY: 'standard-key',
      CLAUDE_API_KEY: 'legacy-key',
    }) as any);
    const legacy = resolveAiProviderConfig(configWith({
      CLAUDE_API_KEY: 'legacy-key',
    }) as any);

    expect(standard.apiKey).toBe('standard-key');
    expect(standard.keySource).toBe('ANTHROPIC_API_KEY');
    expect(legacy.apiKey).toBe('legacy-key');
    expect(legacy.keySource).toBe('CLAUDE_API_KEY');
  });

  it('reports an unconfigured provider instead of pretending the cloud AI is active', () => {
    const result = resolveAiProviderConfig(configWith({}) as any);

    expect(result.configured).toBe(false);
    expect(result.apiKey).toBeNull();
    expect(result.provider).toBe('anthropic');
    expect(result.mainModel).toBe('claude-sonnet-5');
    expect(result.fastModel).toBe('claude-sonnet-5');
  });

  it('accepts explicit model overrides for controlled future migrations', () => {
    const result = resolveAiProviderConfig(configWith({
      ANTHROPIC_API_KEY: 'key',
      AI_MODEL_MAIN: 'claude-sonnet-custom',
      AI_MODEL_FAST: 'claude-fast-custom',
    }) as any);

    expect(result.configured).toBe(true);
    expect(result.mainModel).toBe('claude-sonnet-custom');
    expect(result.fastModel).toBe('claude-fast-custom');
  });
});
