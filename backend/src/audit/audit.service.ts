import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_METADATA_BYTES = 8192;
const SENSITIVE_KEYS = new Set([
  'audio',
  'content',
  'password',
  'path',
  'secret',
  'storagekey',
  'token',
]);

export interface RecordAuditEventInput {
  workspaceId: string;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput, transactionClient?: Prisma.TransactionClient) {
    const metadata = this.sanitizeObject(input.metadata ?? {});
    const encoded = JSON.stringify(metadata);

    if (Buffer.byteLength(encoded, 'utf8') > MAX_METADATA_BYTES) {
      throw new BadRequestException('Audit metadata exceeds 8192 bytes');
    }

    const database = transactionClient ?? this.prisma;
    return database.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private sanitizeObject(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
        .map(([key, item]) => [key, this.sanitizeValue(item)])
        .filter((entry): entry is [string, unknown] => entry[1] !== undefined),
    );
  }

  private sanitizeValue(value: unknown): unknown {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.sanitizeValue(item))
        .filter((item) => item !== undefined);
    }

    if (typeof value === 'object') {
      return this.sanitizeObject(value as Record<string, unknown>);
    }

    return undefined;
  }
}
