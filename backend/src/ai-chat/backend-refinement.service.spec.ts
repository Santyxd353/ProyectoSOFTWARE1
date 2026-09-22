import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { BackendRefinementService } from './backend-refinement.service';

describe('BackendRefinementService', () => {
  const prisma = {
    diagram: {
      findUnique: jest.fn(),
    },
  };
  const config = { get: jest.fn() };
  const authorization = { require: jest.fn() };
  const generation = { generateSpringBootProject: jest.fn() };
  let service: BackendRefinementService;
  let generate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => ({
      CLAUDE_API_KEY: 'test-key',
      AI_REFINEMENT_SECRET: 'test-refinement-secret',
    })[key]);
    prisma.diagram.findUnique.mockResolvedValue({
      id: 'diagram-1',
      workspaceId: 'workspace-1',
      name: 'Orders',
      version: 8,
      data: { classes: [{ id: 'order', name: 'Order', attributes: [] }], relations: [] },
    });
    authorization.require.mockResolvedValue({ role: 'EDITOR' });
    generation.generateSpringBootProject.mockResolvedValue({
      success: true,
      revisionId: 'revision-2',
    });
    generate = jest.fn().mockResolvedValue(JSON.stringify({
          summary: 'Add operational safeguards',
          changes: [
            { feature: 'HEALTH_ENDPOINT', rationale: 'Expose local health checks' },
            { feature: 'REQUEST_LOGGING', rationale: 'Trace requests during tests' },
          ],
          warnings: [],
        }));
    service = new BackendRefinementService(
      prisma as any,
      config as any,
      authorization as any,
      generation as any,
    );
    (service as any).cloud = { generate };
  });

  it('redacts secrets before sending the instruction to AI and returning its summary', async () => {
    const result = await service.propose(
      'diagram-1',
      'user-1',
      'Add logging; password=hunter2 and Bearer abc.def.ghi',
    );

    const request = generate.mock.calls[0][0];
    expect(JSON.stringify(request)).not.toContain('hunter2');
    expect(JSON.stringify(request)).not.toContain('abc.def.ghi');
    expect(result.promptSummary).not.toContain('hunter2');
    expect(result.promptSummary).toContain('[REDACTED]');
  });

  it('uses the configured current model for a JSON plan', async () => {
    config.get.mockImplementation((key: string) => ({
      ANTHROPIC_API_KEY: 'test-key',
      AI_MODEL_MAIN: 'claude-sonnet-custom',
      AI_REFINEMENT_SECRET: 'test-refinement-secret',
    })[key]);
    service = new BackendRefinementService(
      prisma as any,
      config as any,
      authorization as any,
      generation as any,
    );
    (service as any).cloud = { generate };

    const result = await service.propose('diagram-1', 'user-1', 'Add a health endpoint');

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-sonnet-custom',
      json: true,
    }));
    expect(result.engine).toBe('claude-sonnet-custom');
  });

  it('fails explicitly when cloud AI is not configured', async () => {
    config.get.mockReturnValue(undefined);
    service = new BackendRefinementService(
      prisma as any,
      config as any,
      authorization as any,
      generation as any,
    );

    await expect(service.propose('diagram-1', 'user-1', 'Add a health endpoint'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects an AI response outside the supported refinement schema', async () => {
    generate.mockResolvedValue(JSON.stringify({ summary: 'unsafe', changes: [{ feature: 'WRITE_ANY_FILE', rationale: 'no' }] }));

    await expect(service.propose('diagram-1', 'user-1', 'Change everything'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not generate or publish code while creating a proposal', async () => {
    await service.propose('diagram-1', 'user-1', 'Add a health endpoint');

    expect(generation.generateSpringBootProject).not.toHaveBeenCalled();
  });

  it('binds confirmation to its user and rejects expired or reused tokens', async () => {
    let now = 1_000;
    (service as any).now = () => now;
    const proposal = await service.propose('diagram-1', 'user-1', 'Add a health endpoint');

    await expect(service.confirm(proposal.token, 'user-2'))
      .rejects.toBeInstanceOf(BadRequestException);
    now += 11 * 60 * 1000;
    await expect(service.confirm(proposal.token, 'user-1'))
      .rejects.toBeInstanceOf(BadRequestException);

    now = 2_000;
    const fresh = await service.propose('diagram-1', 'user-1', 'Add a health endpoint');
    await service.confirm(fresh.token, 'user-1');
    await expect(service.confirm(fresh.token, 'user-1'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirms through deterministic generation with manifest traceability', async () => {
    const proposal = await service.propose('diagram-1', 'user-1', 'Add health and logs');
    const result = await service.confirm(proposal.token, 'user-1');

    expect(result.revisionId).toBe('revision-2');
    expect(generation.generateSpringBootProject).toHaveBeenCalledWith(
      'diagram-1',
      'user-1',
      expect.objectContaining({
        features: ['HEALTH_ENDPOINT', 'REQUEST_LOGGING'],
        engine: expect.stringContaining('claude'),
        promptSummary: expect.stringContaining('Add health'),
        modelVersion: 8,
      }),
    );
  });

  it('publishes only a selected nonempty subset signed into the proposal', async () => {
    const proposal = await service.propose('diagram-1', 'user-1', 'Add health and logs');

    await (service as any).confirm(proposal.token, 'user-1', ['REQUEST_LOGGING']);

    expect(generation.generateSpringBootProject).toHaveBeenCalledWith(
      'diagram-1', 'user-1', expect.objectContaining({ features: ['REQUEST_LOGGING'] }),
    );
  });

  it('rejects an empty or injected refinement selection without publishing', async () => {
    const proposal = await service.propose('diagram-1', 'user-1', 'Add health and logs');

    await expect((service as any).confirm(proposal.token, 'user-1', []))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect((service as any).confirm(proposal.token, 'user-1', ['API_DOCUMENTATION']))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(generation.generateSpringBootProject).not.toHaveBeenCalled();
  });

  it('proposes through Gemini without publishing before confirmation', async () => {
    config.get.mockImplementation((key: string) => ({
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'test-key',
      AI_REFINEMENT_SECRET: 'test-refinement-secret',
    })[key]);
    service = new BackendRefinementService(
      prisma as any, config as any, authorization as any, generation as any,
    );
    (service as any).cloud = { generate };

    const result = await service.propose('diagram-1', 'user-1', 'Add a health endpoint');

    expect(result.engine).toBe('gemini-3.8-flash');
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ json: true }));
    expect(generation.generateSpringBootProject).not.toHaveBeenCalled();
  });

  it('returns service unavailable when Gemini denies the project', async () => {
    config.get.mockImplementation((key: string) => ({
      AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key',
    })[key]);
    service = new BackendRefinementService(
      prisma as any, config as any, authorization as any, generation as any,
    );
    (service as any).cloud = {
      generate: jest.fn().mockRejectedValue(new Error('Gemini HTTP 403: PERMISSION_DENIED')),
    };

    await expect(service.propose('diagram-1', 'user-1', 'Add a health endpoint'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(generation.generateSpringBootProject).not.toHaveBeenCalled();
  });
});
