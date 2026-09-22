import { AiChatService } from './ai-chat.service';

describe('AiChatService provider transparency', () => {
  const prisma = {
    diagramActivity: { create: jest.fn() },
  };
  const diagramService = { getDiagramById: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports an offline fallback when no cloud key is configured', async () => {
    const config = { get: jest.fn(() => undefined) };
    const service = new AiChatService(
      prisma as any,
      config as any,
      diagramService as any,
    );
    const generate = jest.fn();
    (service as any).cloud = { generate };

    const result = await service.chatWithAI('¿Qué es una asociación UML?');

    expect(result).toEqual(expect.objectContaining({
      mode: 'offline-fallback',
      provider: 'local',
    }));
    expect(result.response).toContain('IA en la nube no está configurada');
    expect(generate).not.toHaveBeenCalled();
  });

  it('reports an offline fallback when Anthropic is temporarily unavailable', async () => {
    const config = {
      get: jest.fn((key: string) => key === 'ANTHROPIC_API_KEY' ? 'test-key' : undefined),
    };
    const service = new AiChatService(
      prisma as any,
      config as any,
      diagramService as any,
    );
    (service as any).cloud = { generate: jest.fn().mockRejectedValue(new Error('network down')) };

    const result = await service.chatWithAI('Ayúdame con mi diagrama');

    expect(result).toEqual(expect.objectContaining({
      mode: 'offline-fallback',
      provider: 'local',
    }));
    expect(result.response).toContain('temporalmente no disponible');
  });

  it('labels a Gemini conversational answer as cloud', async () => {
    const config = { get: jest.fn((key: string) => ({
      AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key',
    })[key]) };
    const service = new AiChatService(prisma as any, config as any, diagramService as any);
    const generate = jest.fn().mockResolvedValue('Una asociación une dos clases.');
    (service as any).cloud = { generate };

    const result = await service.chatWithAI('Explica UML');

    expect(result).toEqual(expect.objectContaining({
      response: 'Una asociación une dos clases.',
      provider: 'gemini',
      mode: 'cloud',
      modelName: 'gemini-3.8-flash',
    }));
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3.8-flash', json: false,
    }));
  });

  it('reports a denied Gemini project without claiming a cloud answer', async () => {
    const config = { get: jest.fn((key: string) => ({
      AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key',
    })[key]) };
    const service = new AiChatService(prisma as any, config as any, diagramService as any);
    (service as any).cloud = {
      generate: jest.fn().mockRejectedValue(new Error('Gemini HTTP 403: PERMISSION_DENIED')),
    };

    const result = await service.chatWithAI('Explica UML');

    expect(result.mode).toBe('offline-fallback');
    expect(result.response).toContain('proyecto de Google');
    expect(result.response).toContain('acceso');
  });

  it('routes image extraction through Gemini with inline image data', async () => {
    diagramService.getDiagramById.mockResolvedValue({ data: { classes: [], relations: [] } });
    const config = { get: jest.fn((key: string) => ({
      AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key',
    })[key]) };
    const service = new AiChatService(prisma as any, config as any, diagramService as any);
    const generate = jest.fn().mockResolvedValue(JSON.stringify({
      name: 'Tienda', classes: [], relations: [],
    }));
    (service as any).cloud = { generate };

    const result = await service.chatWithAI(
      'Extrae el diagrama', 'diagram-1', 'user-1', 'data:image/png;base64,YWJj',
    );

    expect(result).toEqual(expect.objectContaining({ provider: 'gemini', mode: 'cloud' }));
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      json: true,
      image: { mimeType: 'image/png', data: 'YWJj' },
    }));
  });

  it('reports Gemini image access denial as a provider issue', async () => {
    diagramService.getDiagramById.mockResolvedValue({ data: { classes: [], relations: [] } });
    const config = { get: jest.fn((key: string) => ({
      AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key',
    })[key]) };
    const service = new AiChatService(prisma as any, config as any, diagramService as any);
    (service as any).cloud = {
      generate: jest.fn().mockRejectedValue(new Error('Gemini HTTP 403: PERMISSION_DENIED')),
    };

    const result = await service.chatWithAI(
      'Extrae el diagrama', 'diagram-1', 'user-1', 'data:image/png;base64,YWJj',
    );

    expect(result.mode).toBe('offline-fallback');
    expect(result.response).toContain('proyecto de Google');
  });

  it('labels a malformed Gemini UML response as a local fallback', async () => {
    const config = { get: jest.fn((key: string) => ({
      AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key',
    })[key]) };
    const service = new AiChatService(prisma as any, config as any, diagramService as any);
    (service as any).cloud = { generate: jest.fn().mockResolvedValue('not JSON') };

    const result = await service.generateUMLFromPrompt('Crea una tienda', 'diagram-1', 'user-1');

    expect(result.mode).toBe('offline-fallback');
    expect(result.provider).toBe('local');
    expect(prisma.diagramActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'AI_GENERATION_FALLBACK' }),
    }));
  });

  it('labels malformed Gemini chat proposals as local fallback', async () => {
    diagramService.getDiagramById.mockResolvedValue({ data: { classes: [], relations: [] } });
    const config = { get: jest.fn((key: string) => ({
      AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key',
    })[key]) };
    const service = new AiChatService(prisma as any, config as any, diagramService as any);
    (service as any).cloud = { generate: jest.fn().mockResolvedValue('not JSON') };

    const result = await service.chatWithAI('Crea un sistema de tienda', 'diagram-1', 'user-1');

    expect(result.mode).toBe('offline-fallback');
    expect(result.provider).toBe('local');
  });
});
