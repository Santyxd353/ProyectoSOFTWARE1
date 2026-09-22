import { ConfigService } from '@nestjs/config';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';

export type AiProvider = 'anthropic' | 'gemini' | 'groq';
export type AiKeySource = 'ANTHROPIC_API_KEY' | 'CLAUDE_API_KEY' | 'GEMINI_API_KEY' | 'GROQ_API_KEY';

export function aiProviderKeyName(provider: AiProvider): Exclude<AiKeySource, 'CLAUDE_API_KEY'> {
  if (provider === 'gemini') return 'GEMINI_API_KEY';
  if (provider === 'groq') return 'GROQ_API_KEY';
  return 'ANTHROPIC_API_KEY';
}

export type AiProviderConfig = {
  provider: AiProvider;
  configured: boolean;
  apiKey: string | null;
  keySource: AiKeySource | null;
  mainModel: string;
  fastModel: string;
};

type ConfigReader = Pick<ConfigService, 'get'>;

function readNonEmpty(config: ConfigReader, key: string): string | null {
  const value = config.get<string>(key);
  const normalized = typeof value === 'string' ? value.trim() : '';

  return normalized.length > 0 ? normalized : null;
}

export function resolveAiProviderConfig(
  config: ConfigReader,
): AiProviderConfig {
  const standardKey = readNonEmpty(config, 'ANTHROPIC_API_KEY');
  const legacyKey = readNonEmpty(config, 'CLAUDE_API_KEY');
  const selectedProvider = readNonEmpty(config, 'AI_PROVIDER')?.toLowerCase();
  if (selectedProvider && !['gemini', 'anthropic', 'groq'].includes(selectedProvider)) {
    throw new Error(`Unsupported AI_PROVIDER: ${selectedProvider}`);
  }
  const provider = (selectedProvider ?? 'anthropic') as AiProvider;
  const apiKey = provider === 'gemini'
    ? readNonEmpty(config, 'GEMINI_API_KEY')
    : provider === 'groq'
      ? readNonEmpty(config, 'GROQ_API_KEY')
      : standardKey ?? legacyKey;
  const defaultModel = provider === 'gemini'
    ? DEFAULT_GEMINI_MODEL
    : provider === 'groq'
      ? DEFAULT_GROQ_MODEL
      : DEFAULT_ANTHROPIC_MODEL;

  return {
    provider,
    configured: apiKey !== null,
    apiKey,
    keySource: provider === 'gemini' && apiKey
      ? 'GEMINI_API_KEY'
      : provider === 'groq' && apiKey
        ? 'GROQ_API_KEY'
      : provider === 'anthropic' && standardKey
      ? 'ANTHROPIC_API_KEY'
      : provider === 'anthropic' && legacyKey
        ? 'CLAUDE_API_KEY'
        : null,
    mainModel:
      readNonEmpty(config, 'AI_MODEL_MAIN') ?? defaultModel,
    fastModel:
      readNonEmpty(config, 'AI_MODEL_FAST') ?? defaultModel,
  };
}
