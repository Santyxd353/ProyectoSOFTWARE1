import { ConfigService } from '@nestjs/config';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';

export type AiProviderConfig = {
  provider: 'anthropic';
  configured: boolean;
  apiKey: string | null;
  keySource: 'ANTHROPIC_API_KEY' | 'CLAUDE_API_KEY' | null;
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
  const apiKey = standardKey ?? legacyKey;

  return {
    provider: 'anthropic',
    configured: apiKey !== null,
    apiKey,
    keySource: standardKey
      ? 'ANTHROPIC_API_KEY'
      : legacyKey
        ? 'CLAUDE_API_KEY'
        : null,
    mainModel:
      readNonEmpty(config, 'AI_MODEL_MAIN') ?? DEFAULT_ANTHROPIC_MODEL,
    fastModel:
      readNonEmpty(config, 'AI_MODEL_FAST') ?? DEFAULT_ANTHROPIC_MODEL,
  };
}
