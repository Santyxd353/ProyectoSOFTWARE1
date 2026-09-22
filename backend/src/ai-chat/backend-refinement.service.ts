import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { AuthorizationService } from '../authorization/authorization.service';
import { CodeGenerationService } from '../code-generation/code-generation.service';
import { PrismaService } from '../prisma/prisma.service';
import { aiProviderKeyName, AiProviderConfig, resolveAiProviderConfig } from './ai-provider.config';
import { CloudAiClient } from './cloud-ai.client';

export const BACKEND_REFINEMENT_FEATURES = [
  'HEALTH_ENDPOINT',
  'REQUEST_LOGGING',
  'API_DOCUMENTATION',
] as const;

export type BackendRefinementFeature = typeof BACKEND_REFINEMENT_FEATURES[number];

type RefinementPlan = {
  summary: string;
  changes: Array<{ feature: BackendRefinementFeature; rationale: string }>;
  warnings: string[];
};

@Injectable()
export class BackendRefinementService {
  private readonly cloud: CloudAiClient;
  private readonly consumedTokens = new Set<string>();
  private readonly aiConfig: AiProviderConfig;
  private now = () => Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authorization: AuthorizationService,
    private readonly generation: CodeGenerationService,
  ) {
    this.aiConfig = resolveAiProviderConfig(this.config);
    this.cloud = new CloudAiClient(this.aiConfig);
  }

  async propose(diagramId: string, userId: string, instruction: string) {
    if (!this.aiConfig.configured) {
      throw new ServiceUnavailableException(
        `Cloud AI is not configured. Set ${aiProviderKeyName(this.aiConfig.provider)} to enable backend refinement.`,
      );
    }
    const diagram = await this.prisma.diagram.findUnique({ where: { id: diagramId } });
    if (!diagram) throw new BadRequestException('Diagram not found');
    await this.authorization.require(diagram.workspaceId, userId, 'repository:generate');

    const promptSummary = this.sanitizeInstruction(instruction);
    if (!promptSummary) throw new BadRequestException('Refinement instruction is required');
    const prompt = [
      'Act as a backend architect. Select only supported deterministic improvements.',
      'Return JSON only with: summary (string), changes (array of {feature,rationale}), warnings (string array).',
      `Allowed features: ${BACKEND_REFINEMENT_FEATURES.join(', ')}. Do not return source code, paths, commands, or credentials.`,
      `Confirmed UML snapshot: ${JSON.stringify(diagram.data)}`,
      `User instruction: ${promptSummary}`,
    ].join('\n');
    let text: string;
    try {
      text = await this.cloud.generate({
      model: this.aiConfig.mainModel,
      maxTokens: 1200,
      json: true,
      prompt,
      });
    } catch (error) {
      const denied = this.aiConfig.provider === 'gemini' &&
        error instanceof Error && error.message.includes('HTTP 403: PERMISSION_DENIED');
      throw new ServiceUnavailableException(denied
        ? 'El proyecto de Google denegó acceso a Gemini.'
        : 'La IA en la nube no está disponible para el refinamiento.');
    }
    const plan = this.parsePlan(text);
    const features = [...new Set(plan.changes.map((change) => change.feature))];
    const payload = {
      diagramId,
      workspaceId: diagram.workspaceId,
      userId,
      modelVersion: diagram.version,
      promptSummary,
      engine: this.aiConfig.mainModel,
      plan,
      features,
      exp: this.now() + 10 * 60 * 1000,
      nonce: createHash('sha256')
        .update(`${userId}:${diagramId}:${this.now()}:${Math.random()}`)
        .digest('hex'),
    };

    return {
      summary: plan.summary,
      changes: plan.changes,
      warnings: plan.warnings,
      promptSummary,
      engine: this.aiConfig.mainModel,
      expiresAt: new Date(payload.exp).toISOString(),
      token: this.sign(payload),
    };
  }

  async confirm(token: string, userId: string, selectedFeatures?: string[]) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (this.consumedTokens.has(tokenHash)) {
      throw new BadRequestException('Backend refinement token was already used');
    }
    const payload = this.verify(token);
    if (payload.userId !== userId) {
      throw new BadRequestException('Backend refinement belongs to another user');
    }
    if (payload.exp < this.now()) {
      throw new BadRequestException('Backend refinement token expired');
    }
    const proposed = payload.features as string[];
    const features = selectedFeatures === undefined ? proposed : selectedFeatures;
    if (!Array.isArray(features) || features.length === 0 ||
      new Set(features).size !== features.length ||
      features.some((feature) => !proposed.includes(feature))) {
      throw new BadRequestException('Select at least one proposed refinement');
    }
    this.consumedTokens.add(tokenHash);
    try {
      return await this.generation.generateSpringBootProject(payload.diagramId, userId, {
        features,
        engine: payload.engine,
        promptSummary: payload.promptSummary,
        modelVersion: payload.modelVersion,
        planSummary: payload.plan.summary,
      });
    } catch (error) {
      this.consumedTokens.delete(tokenHash);
      throw error;
    }
  }

  private sanitizeInstruction(value: string): string {
    return String(value ?? '')
      .slice(0, 2000)
      .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
      .replace(/\b(password|secret|api[_-]?key|token)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
      .trim();
  }

  private parsePlan(raw: string): RefinementPlan {
    let value: any;
    try {
      const match = String(raw).replace(/```(?:json)?|```/gi, '').match(/\{[\s\S]*\}/);
      value = JSON.parse(match?.[0] ?? '');
    } catch {
      throw new BadRequestException('AI returned an invalid backend refinement plan');
    }
    if (
      typeof value?.summary !== 'string' ||
      !value.summary.trim() ||
      value.summary.length > 500 ||
      !Array.isArray(value.changes) ||
      !Array.isArray(value.warnings) ||
      value.warnings.length > 10 ||
      value.changes.length === 0 ||
      value.changes.length > BACKEND_REFINEMENT_FEATURES.length ||
      Object.keys(value).some((key) => !['summary', 'changes', 'warnings'].includes(key))
    ) {
      throw new BadRequestException('AI returned an invalid backend refinement plan');
    }
    const allowed = new Set<string>(BACKEND_REFINEMENT_FEATURES);
    for (const change of value.changes) {
      if (
        !change ||
        Object.keys(change).some((key) => !['feature', 'rationale'].includes(key)) ||
        !allowed.has(change.feature) ||
        typeof change.rationale !== 'string' ||
        !change.rationale.trim() ||
        change.rationale.length > 300
      ) {
        throw new BadRequestException('AI returned an unsupported backend refinement');
      }
    }
    if (value.warnings.some((warning: unknown) =>
      typeof warning !== 'string' || warning.length > 300,
    )) {
      throw new BadRequestException('AI returned an invalid backend refinement plan');
    }
    return {
      summary: value.summary.trim().slice(0, 500),
      changes: value.changes.map((change: any) => ({
        feature: change.feature,
        rationale: change.rationale.trim(),
      })),
      warnings: value.warnings.map((warning: string) => warning.slice(0, 300)),
    };
  }

  private sign(payload: Record<string, unknown>): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.secret()).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }

  private verify(token: string): any {
    const [encoded, signature, extra] = String(token ?? '').split('.');
    if (!encoded || !signature || extra) {
      throw new BadRequestException('Invalid backend refinement token');
    }
    const expected = createHmac('sha256', this.secret()).update(encoded).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new BadRequestException('Invalid backend refinement token');
    }
    try {
      return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid backend refinement token');
    }
  }

  private secret(): string {
    return this.config.get('AI_REFINEMENT_SECRET') ||
      this.config.get('JWT_SECRET') ||
      'local-ai-refinement-secret-change-before-deployment';
  }
}
