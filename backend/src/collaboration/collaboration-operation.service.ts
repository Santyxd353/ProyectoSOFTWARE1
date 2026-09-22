import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { mergeDiagram } from './diagram-three-way-merge';
import { isDeepStrictEqual } from 'node:util';

export type DiagramChange =
  | { type: 'full_update'; data: Record<string, unknown> }
  | { type: 'full_update'; nodes: unknown[]; edges: unknown[] }
  | { type: 'nodes'; nodes: unknown[] }
  | { type: 'edges'; edges: unknown[] };

export interface ApplyDiagramOperationInput {
  diagramId: string;
  userId: string;
  deviceId: string;
  clientSequence: number;
  baseVersion: number;
  baseData?: Record<string, unknown>;
  changes: DiagramChange;
}

export interface DiagramOperationAcknowledgement {
  status: 'APPLIED' | 'DUPLICATE' | 'CONFLICT';
  operationId: string;
  sequence: number;
  version: number;
  conflictId?: string;
  autoMerged?: boolean;
  data?: Record<string, unknown>;
}

@Injectable()
export class CollaborationOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async apply(
    input: ApplyDiagramOperationInput,
  ): Promise<DiagramOperationAcknowledgement> {
    this.validateInput(input);
    const accessibleDiagram = await this.prisma.diagram.findUnique({
      where: { id: input.diagramId },
      select: { workspaceId: true, archivedAt: true },
    });
    if (!accessibleDiagram) throw new NotFoundException('Diagram not found');
    if (accessibleDiagram.archivedAt) {
      throw new BadRequestException('Archived diagrams cannot be edited');
    }
    await this.authorization.require(
      accessibleDiagram.workspaceId,
      input.userId,
      'diagram:edit',
    );

    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.diagramOperation.findUnique({
        where: {
          deviceId_clientSequence: {
            deviceId: input.deviceId,
            clientSequence: input.clientSequence,
          },
        },
        include: { conflict: { select: { id: true } } },
      });
      if (existing) {
        if (existing.diagramId !== input.diagramId || existing.authorId !== input.userId) {
          throw new BadRequestException('Device sequence already used for another operation');
        }
        const submittedData = input.changes.type === 'full_update' && 'data' in input.changes
          ? input.changes.data : null;
        const restoredData = this.asObject(existing.afterData);
        const autoMerged = !existing.conflict?.id && submittedData &&
          !isDeepStrictEqual(submittedData, restoredData);
        return {
          status: existing.conflict?.id ? 'CONFLICT' : 'DUPLICATE',
          operationId: existing.id,
          sequence: existing.serverSequence,
          version: existing.resultVersion,
          ...(existing.conflict?.id
            ? { conflictId: existing.conflict.id }
            : {}),
          ...(autoMerged ? { autoMerged: true, data: restoredData } : {}),
        };
      }

      const diagram = await transaction.diagram.findUnique({
        where: { id: input.diagramId },
      });
      if (!diagram) throw new NotFoundException('Diagram not found');
      if (diagram.archivedAt) {
        throw new BadRequestException('Archived diagrams cannot be edited');
      }

      const sequenceState = await transaction.diagramOperation.aggregate({
        where: { diagramId: input.diagramId },
        _max: { serverSequence: true },
      });
      const serverSequence =
        (sequenceState._max.serverSequence ?? 0) + 1;
      const beforeData = this.asObject(diagram.data);
      let proposedData = this.applyChange(beforeData, input.changes);

      if (input.baseVersion !== diagram.version) {
        const baseline = await transaction.diagramOperation.findFirst({
          where: {
            diagramId: input.diagramId,
            baseVersion: input.baseVersion,
            status: 'APPLIED',
          },
          orderBy: { serverSequence: 'asc' },
          select: { beforeData: true },
        });
        const trustedBase = baseline ? this.asObject(baseline.beforeData) : null;
        if (trustedBase && input.baseData && isDeepStrictEqual(input.baseData, trustedBase)) {
          proposedData = this.applyChange(trustedBase, input.changes);
          const merged = mergeDiagram(trustedBase, proposedData, beforeData);
          if (merged) {
            const updated = await transaction.diagram.update({
              where: { id: diagram.id },
              data: { data: merged as any, version: { increment: 1 } },
            });
            const operation = await transaction.diagramOperation.create({
              data: {
                diagramId: input.diagramId,
                authorId: input.userId,
                deviceId: input.deviceId,
                clientSequence: input.clientSequence,
                serverSequence,
                baseVersion: input.baseVersion,
                resultVersion: updated.version,
                operation: input.changes as any,
                beforeData: beforeData as any,
                afterData: merged as any,
                status: 'APPLIED',
              },
            });
            await transaction.auditEvent.create({
              data: {
                workspaceId: diagram.workspaceId,
                actorId: input.userId,
                action: 'DIAGRAM_OPERATION_APPLIED',
                entityType: 'DiagramOperation',
                entityId: operation.id,
                metadata: { diagramId: diagram.id, serverSequence, autoMerged: true,
                  baseVersion: input.baseVersion, resultVersion: updated.version },
              },
            });
            return { status: 'APPLIED', operationId: operation.id,
              sequence: serverSequence, version: updated.version,
              autoMerged: true, data: merged };
          }
        }
        const operation = await transaction.diagramOperation.create({
          data: {
            diagramId: input.diagramId,
            authorId: input.userId,
            deviceId: input.deviceId,
            clientSequence: input.clientSequence,
            serverSequence,
            baseVersion: input.baseVersion,
            resultVersion: diagram.version,
            operation: input.changes as any,
            beforeData: (input.baseData ?? beforeData) as any,
            afterData: proposedData as any,
            status: 'CONFLICT',
          },
        });
        const conflict = await transaction.syncConflict.create({
          data: {
            workspaceId: diagram.workspaceId,
            diagramId: diagram.id,
            operationId: operation.id,
            baseVersion: input.baseVersion,
            baseData: (input.baseData ?? beforeData) as any,
            localData: proposedData as any,
            remoteData: beforeData as any,
            status: 'PENDING',
          },
        });
        await transaction.auditEvent.create({
          data: {
            workspaceId: diagram.workspaceId,
            actorId: input.userId,
            action: 'SYNC_CONFLICT_CREATED',
            entityType: 'SyncConflict',
            entityId: conflict.id,
            metadata: {
              diagramId: diagram.id,
              operationId: operation.id,
              baseVersion: input.baseVersion,
              remoteVersion: diagram.version,
            },
          },
        });
        return {
          status: 'CONFLICT',
          operationId: operation.id,
          conflictId: conflict.id,
          sequence: serverSequence,
          version: diagram.version,
        };
      }

      const updated = await transaction.diagram.update({
        where: { id: diagram.id },
        data: {
          data: proposedData as any,
          version: { increment: 1 },
        },
      });
      const operation = await transaction.diagramOperation.create({
        data: {
          diagramId: input.diagramId,
          authorId: input.userId,
          deviceId: input.deviceId,
          clientSequence: input.clientSequence,
          serverSequence,
          baseVersion: input.baseVersion,
          resultVersion: updated.version,
          operation: input.changes as any,
          beforeData: beforeData as any,
          afterData: proposedData as any,
          status: 'APPLIED',
        },
      });
      await transaction.auditEvent.create({
        data: {
          workspaceId: diagram.workspaceId,
          actorId: input.userId,
          action: 'DIAGRAM_OPERATION_APPLIED',
          entityType: 'DiagramOperation',
          entityId: operation.id,
          metadata: {
            diagramId: diagram.id,
            serverSequence,
            baseVersion: input.baseVersion,
            resultVersion: updated.version,
          },
        },
      });
      return {
        status: 'APPLIED',
        operationId: operation.id,
        sequence: serverSequence,
        version: updated.version,
      };
    }, { isolationLevel: 'Serializable' });
  }

  async eventsAfter(diagramId: string, userId: string, sequence: number) {
    if (!Number.isInteger(sequence) || sequence < 0) {
      throw new BadRequestException('Sequence must be a non-negative integer');
    }
    const diagram = await this.prisma.diagram.findUnique({
      where: { id: diagramId },
      select: { workspaceId: true },
    });
    if (!diagram) throw new NotFoundException('Diagram not found');
    await this.authorization.require(
      diagram.workspaceId,
      userId,
      'diagram:read',
    );
    return this.prisma.diagramOperation.findMany({
      where: {
        diagramId,
        serverSequence: { gt: sequence },
        status: 'APPLIED',
      },
      orderBy: { serverSequence: 'asc' },
      select: {
        id: true,
        serverSequence: true,
        baseVersion: true,
        resultVersion: true,
        operation: true,
        afterData: true,
        authorId: true,
        createdAt: true,
      },
    });
  }

  async listConflicts(diagramId: string, userId: string) {
    const diagram = await this.prisma.diagram.findUnique({
      where: { id: diagramId },
      select: { workspaceId: true },
    });
    if (!diagram) throw new NotFoundException('Diagram not found');
    await this.authorization.require(
      diagram.workspaceId,
      userId,
      'diagram:read',
    );
    return this.prisma.syncConflict.findMany({
      where: { diagramId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        operation: {
          select: {
            authorId: true,
            createdAt: true,
            serverSequence: true,
            deviceId: true,
            clientSequence: true,
          },
        },
      },
    });
  }

  async resolveConflict(
    conflictId: string,
    userId: string,
    resolution: Record<string, unknown>,
  ) {
    const conflict = await this.prisma.syncConflict.findUnique({
      where: { id: conflictId },
    });
    if (!conflict) throw new NotFoundException('Conflict not found');
    if (conflict.status !== 'PENDING') {
      throw new BadRequestException('Conflict is already resolved');
    }
    await this.authorization.require(
      conflict.workspaceId,
      userId,
      'diagram:edit',
    );
    const normalized = this.asObject(resolution);

    return this.prisma.$transaction(async (transaction) => {
      const diagram = await transaction.diagram.findUnique({
        where: { id: conflict.diagramId },
      });
      if (!diagram) throw new NotFoundException('Diagram not found');
      if (diagram.archivedAt) {
        throw new BadRequestException('Archived diagrams cannot be edited');
      }
      const appliedResolution = mergeDiagram(
        this.asObject(conflict.remoteData),
        normalized,
        this.asObject(diagram.data),
      );
      if (!appliedResolution) {
        throw new ConflictException(
          'Diagram changed after conflict creation; refresh before resolving',
        );
      }
      await transaction.diagram.update({
        where: { id: diagram.id },
        data: { data: appliedResolution as any, version: { increment: 1 } },
      });
      const resolved = await transaction.syncConflict.update({
        where: { id: conflict.id },
        data: {
          status: 'RESOLVED',
          resolution: appliedResolution as any,
          resolvedById: userId,
          resolvedAt: new Date(),
        },
      });
      await transaction.auditEvent.create({
        data: {
          workspaceId: conflict.workspaceId,
          actorId: userId,
          action: 'SYNC_CONFLICT_RESOLVED',
          entityType: 'SyncConflict',
          entityId: conflict.id,
          metadata: {
            diagramId: conflict.diagramId,
            previousVersion: diagram.version,
            resultVersion: diagram.version + 1,
          },
        },
      });
      return resolved;
    }, { isolationLevel: 'Serializable' });
  }

  private validateInput(input: ApplyDiagramOperationInput): void {
    if (!input.deviceId?.trim() || input.deviceId.length > 120) {
      throw new BadRequestException('Invalid device identifier');
    }
    if (!Number.isInteger(input.clientSequence) || input.clientSequence < 1) {
      throw new BadRequestException('Client sequence must be a positive integer');
    }
    if (!Number.isInteger(input.baseVersion) || input.baseVersion < 1) {
      throw new BadRequestException('Base version must be a positive integer');
    }
  }

  private applyChange(
    current: Record<string, unknown>,
    changes: DiagramChange,
  ): Record<string, unknown> {
    if (changes.type === 'full_update' && 'data' in changes) {
      return this.asObject(changes.data);
    }
    const next = { ...current };
    if (changes.type === 'nodes' || changes.type === 'full_update') {
      next.classes = changes.nodes.map((node: any) => ({
        ...this.asObject(node.data),
        id: node.id,
        position: node.position,
      }));
    }
    if (changes.type === 'edges' || changes.type === 'full_update') {
      next.relations = changes.edges.map((edge: any) => ({
        id: edge.id,
        sourceClassId: edge.source,
        targetClassId: edge.target,
        type: edge.data?.type ?? 'ASSOCIATION',
        name: edge.data?.label ?? '',
        multiplicity: edge.data?.multiplicity
          ? `${edge.data.multiplicity.source ?? ''}:${edge.data.multiplicity.target ?? ''}`
          : undefined,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        intermediateTable: edge.data?.intermediateTable ?? undefined,
      }));
    }
    return next;
  }

  private asObject(value: unknown): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new BadRequestException('Diagram data must be an object');
    }
    return value as Record<string, unknown>;
  }
}
