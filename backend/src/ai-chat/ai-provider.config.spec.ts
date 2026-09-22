import { aiProviderKeyName, resolveAiProviderConfig } from './ai-provider.config';

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

  it('uses Gemini only when selected and never substitutes an Anthropic key', () => {
    const selected = resolveAiProviderConfig(configWith({
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'gemini-test-key',
      ANTHROPIC_API_KEY: 'anthropic-test-key',
    }) as any);
    const missing = resolveAiProviderConfig(configWith({
      AI_PROVIDER: 'gemini',
      ANTHROPIC_API_KEY: 'anthropic-test-key',
    }) as any);

    expect(selected).toEqual(expect.objectContaining({
      provider: 'gemini',
      configured: true,
      apiKey: 'gemini-test-key',
      keySource: 'GEMINI_API_KEY',
      mainModel: 'gemini-3.8-flash',
      fastModel: 'gemini-3.8-flash',
    }));
    expect(missing.configured).toBe(false);
    expect(missing.apiKey).toBeNull();
  });

  it('uses Groq only when selected with Qwen defaults', () => {
    const selected = resolveAiProviderConfig(configWith({
      AI_PROVIDER: 'groq',
      GROQ_API_KEY: 'groq-test-key',
      GEMINI_API_KEY: 'gemini-test-key',
    }) as any);
    const missing = resolveAiProviderConfig(configWith({
      AI_PROVIDER: 'groq',
      GEMINI_API_KEY: 'gemini-test-key',
    }) as any);

    expect(selected).toEqual(expect.objectContaining({
      provider: 'groq',
      configured: true,
      apiKey: 'groq-test-key',
      keySource: 'GROQ_API_KEY',
      mainModel: 'qwen/qwen3.8-27b',
      fastModel: 'qwen/qwen3.8-27b',
    }));
    expect(missing.configured).toBe(false);
    expect(missing.apiKey).toBeNull();
  });

  it('rejects an unknown explicit provider instead of silently using Anthropic', () => {
    expect(() => resolveAiProviderConfig(configWith({
      AI_PROVIDER: 'gemni',
      ANTHROPIC_API_KEY: 'anthropic-test-key',
    }) as any)).toThrow('Unsupported AI_PROVIDER');
  });

  it('reports the correct environment variable for every provider', () => {
    expect(aiProviderKeyName('anthropic')).toBe('ANTHROPIC_API_KEY');
    expect(aiProviderKeyName('gemini')).toBe('GEMINI_API_KEY');
    expect(aiProviderKeyName('groq')).toBe('GROQ_API_KEY');
  });
});
