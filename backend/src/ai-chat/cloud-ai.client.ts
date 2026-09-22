import Anthropic from '@anthropic-ai/sdk';
import { AiProviderConfig } from './ai-provider.config';

export type CloudAiRequest = {
  model: string;
  prompt: string;
  maxTokens: number;
  json?: boolean;
  image?: { mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string };
};

/** Keeps provider credentials and wire formats inside the backend. */
export class CloudAiClient {
  private readonly anthropic: Anthropic | null;

  constructor(
    private readonly config: AiProviderConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.anthropic = config.provider === 'anthropic' && config.apiKey
      ? new Anthropic({ apiKey: config.apiKey })
      : null;
  }

  async generate(request: CloudAiRequest): Promise<string> {
    if (!this.config.apiKey) throw new Error('Cloud AI is not configured');
    if (this.config.provider === 'gemini') return this.generateWithGemini(request);
    if (this.config.provider === 'groq') return this.generateWithGroq(request);

    const content: Anthropic.MessageParam['content'] = request.image
      ? [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: request.image.mimeType,
              data: request.image.data,
            },
          },
          { type: 'text', text: request.prompt },
        ]
      : request.prompt;
    const message = await this.anthropic!.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content }],
    });
    const text = message.content
      .filter((part): part is Anthropic.TextBlock => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim();
    if (!text) throw new Error('Anthropic returned no text');
    return text;
  }

  private async generateWithGemini(request: CloudAiRequest): Promise<string> {
    const parts: Array<Record<string, unknown>> = [];
    if (request.image) {
      parts.push({ inlineData: { mimeType: request.image.mimeType, data: request.image.data } });
    }
    parts.push({ text: request.prompt });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`;
    const response = await this.fetcher(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey!,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          maxOutputTokens: request.maxTokens,
          ...(request.json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      let status = 'UNKNOWN';
      try {
        const body = await response.json();
        if (typeof body?.error?.status === 'string') status = body.error.status;
      } catch {
        // The provider may return HTML or an empty error body.
      }
      throw new Error(`Gemini HTTP ${response.status}: ${status}`);
    }
    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('')
      .trim();
    if (!text) throw new Error('Gemini returned no text');
    return text;
  }

  private async generateWithGroq(request: CloudAiRequest): Promise<string> {
    const content: string | Array<Record<string, unknown>> = request.image
      ? [
          { type: 'text', text: request.prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${request.image.mimeType};base64,${request.image.data}`,
            },
          },
        ]
      : request.prompt;
    const response = await this.fetcher('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: 'user', content }],
        max_completion_tokens: request.maxTokens,
        ...(request.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      let status = 'UNKNOWN';
      try {
        const body = await response.json();
        if (typeof body?.error?.code === 'string') status = body.error.code;
      } catch {
        // The provider may return HTML or an empty error body.
      }
      throw new Error(`Groq HTTP ${response.status}: ${status}`);
    }
    const body = await response.json();
    const text = body?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Groq returned no text');
    return text;
  }
}
