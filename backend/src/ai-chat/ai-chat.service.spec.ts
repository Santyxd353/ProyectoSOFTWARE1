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
    const messagesCreate = jest.fn();
    (service as any).anthropic = { messages: { create: messagesCreate } };

    const result = await service.chatWithAI('¿Qué es una asociación UML?');

    expect(result).toEqual(expect.objectContaining({
      mode: 'offline-fallback',
      provider: 'local',
    }));
    expect(result.response).toContain('IA en la nube no está configurada');
    expect(messagesCreate).not.toHaveBeenCalled();
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
    (service as any).anthropic = {
      messages: { create: jest.fn().mockRejectedValue(new Error('network down')) },
    };

    const result = await service.chatWithAI('Ayúdame con mi diagrama');

    expect(result).toEqual(expect.objectContaining({
      mode: 'offline-fallback',
      provider: 'local',
    }));
    expect(result.response).toContain('temporalmente no disponible');
  });
});
