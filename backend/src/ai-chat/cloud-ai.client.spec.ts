import { CloudAiClient } from './cloud-ai.client';
import { AiProviderConfig } from './ai-provider.config';

describe('CloudAiClient Gemini contract', () => {
  const config: AiProviderConfig = {
    provider: 'gemini',
    configured: true,
    apiKey: 'private-test-key',
    keySource: 'GEMINI_API_KEY',
    mainModel: 'gemini-3.8-flash',
    fastModel: 'gemini-3.8-flash',
  };

  it('sends text with the server-side key and returns generated text', async () => {
    const request = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Hola' }] } }] }),
    });
    const client = new CloudAiClient(config, request as any);

    const result = await client.generate({
      model: 'gemini-3.8-flash', prompt: 'Saluda', maxTokens: 64,
    });

    expect(result).toBe('Hola');
    const [url, options] = request.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect(options.headers['x-goog-api-key']).toBe('private-test-key');
    expect(JSON.parse(options.body)).toEqual(expect.objectContaining({
      contents: [{ role: 'user', parts: [{ text: 'Saluda' }] }],
      generationConfig: { maxOutputTokens: 64 },
    }));
    expect(url).not.toContain('private-test-key');
  });

  it('sends an image inline and asks for JSON when extracting UML', async () => {
    const request = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"classes":[]}' }] } }] }),
    });
    const client = new CloudAiClient(config, request as any);

    await client.generate({
      model: config.mainModel,
      prompt: 'Extrae UML',
      maxTokens: 200,
      json: true,
      image: { mimeType: 'image/png', data: 'YWJj' },
    });

    const body = JSON.parse(request.mock.calls[0][1].body);
    expect(body.contents[0].parts).toEqual([
      { inlineData: { mimeType: 'image/png', data: 'YWJj' } },
      { text: 'Extrae UML' },
    ]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('rejects denied and empty responses without exposing the key', async () => {
    const denied = new CloudAiClient(config, jest.fn().mockResolvedValue({
      ok: false, status: 403,
      json: async () => ({ error: { status: 'PERMISSION_DENIED', message: 'private-test-key' } }),
    }) as any);
    const empty = new CloudAiClient(config, jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [] } }] }),
    }) as any);

    await expect(denied.generate({ model: config.mainModel, prompt: 'x', maxTokens: 2 }))
      .rejects.toThrow('Gemini HTTP 403: PERMISSION_DENIED');
    await expect(empty.generate({ model: config.mainModel, prompt: 'x', maxTokens: 2 }))
      .rejects.toThrow('Gemini returned no text');
  });
});

describe('CloudAiClient Groq contract', () => {
  const config: AiProviderConfig = {
    provider: 'groq',
    configured: true,
    apiKey: 'private-groq-key',
    keySource: 'GROQ_API_KEY',
    mainModel: 'qwen/qwen3.8-27b',
    fastModel: 'qwen/qwen3.8-27b',
  };

  it('sends text and JSON requests through the OpenAI-compatible endpoint', async () => {
    const request = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"classes":[]}' } }] }),
    });
    const client = new CloudAiClient(config, request as any);

    const result = await client.generate({
      model: config.mainModel,
      prompt: 'Genera UML como JSON',
      maxTokens: 200,
      json: true,
    });

    expect(result).toBe('{"classes":[]}');
    const [url, options] = request.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(options.headers.Authorization).toBe('Bearer private-groq-key');
    expect(url).not.toContain('private-groq-key');
    expect(JSON.parse(options.body)).toEqual({
      model: 'qwen/qwen3.8-27b',
      messages: [{ role: 'user', content: 'Genera UML como JSON' }],
      max_completion_tokens: 200,
      response_format: { type: 'json_object' },
    });
  });

  it('sends base64 images as data URLs and redacts provider error details', async () => {
    const request = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'imagen leída' } }] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: 'rate_limit_exceeded', message: 'private-groq-key' } }),
      });
    const client = new CloudAiClient(config, request as any);

    await client.generate({
      model: config.mainModel,
      prompt: 'Lee UML',
      maxTokens: 64,
      image: { mimeType: 'image/png', data: 'YWJj' },
    });
    const body = JSON.parse(request.mock.calls[0][1].body);
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: 'Lee UML' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,YWJj' } },
    ]);

    await expect(client.generate({ model: config.mainModel, prompt: 'x', maxTokens: 2 }))
      .rejects.toThrow('Groq HTTP 429: rate_limit_exceeded');
  });
});
