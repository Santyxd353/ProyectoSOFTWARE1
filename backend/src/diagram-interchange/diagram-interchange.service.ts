import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import AdmZip = require('adm-zip');
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { DiagramService } from '../diagram/diagram.service';
import { AuditService } from '../audit/audit.service';

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const xmlEscape = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const xmiId = (prefix: string, value: unknown) =>
  `${prefix}_${String(value ?? '').replace(/[^A-Za-z0-9_.-]/g, '_')}`;

@Injectable()
export class DiagramInterchangeService {
  private readonly consumedTokens = new Set<string>();
  private now = () => Date.now();
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: false,
    trimValues: true,
  });

  constructor(
    private readonly diagrams: DiagramService,
    private readonly audit: AuditService,
  ) {}

  async exportXmi(diagramId: string, userId: string): Promise<string> {
    const diagram = await this.diagrams.getDiagramById(diagramId, userId);
    const data = (diagram.data || {}) as any;
    const classes = asArray<any>(data.classes);
    const relations = asArray<any>(data.relations);

    const classXml = classes.map((item) => {
      const attributes = asArray<any>(item.attributes).map((attribute) => `
        <ownedAttribute xmi:id="${xmiId('attribute', attribute.id || attribute.name)}" name="${xmlEscape(attribute.name)}" visibility="${xmlEscape(attribute.visibility || 'private')}" puds:type="${xmlEscape(attribute.type || 'String')}" puds:nullable="${attribute.nullable !== false}" puds:unique="${attribute.unique === true}"/>`).join('');
      const methods = asArray<any>(item.methods).map((method) => `
        <ownedOperation xmi:id="${xmiId('operation', method.id || method.name)}" name="${xmlEscape(method.name)}" visibility="${xmlEscape(method.visibility || 'public')}" puds:returnType="${xmlEscape(method.returnType || 'void')}">${asArray<any>(method.parameters).map((parameter, index) => `
          <ownedParameter xmi:id="${xmiId('parameter', `${method.id || method.name}_${index}`)}" name="${xmlEscape(parameter.name)}" puds:type="${xmlEscape(parameter.type || 'String')}"/>`).join('')}
        </ownedOperation>`).join('');
      return `
      <packagedElement xmi:type="uml:Class" xmi:id="${xmiId('class', item.id)}" name="${xmlEscape(item.name)}" puds:id="${xmlEscape(item.id)}" puds:x="${Number(item.position?.x || 0)}" puds:y="${Number(item.position?.y || 0)}">${attributes}${methods}
      </packagedElement>`;
    }).join('');

    const relationXml = relations.map((relation) => `
      <packagedElement xmi:type="uml:Association" xmi:id="${xmiId('relation', relation.id)}" name="${xmlEscape(relation.name || '')}" puds:id="${xmlEscape(relation.id)}" puds:relationType="${xmlEscape(relation.type || 'ASSOCIATION')}">
        <ownedEnd xmi:id="${xmiId('end_source', relation.id)}" type="${xmiId('class', relation.sourceClassId)}" puds:classId="${xmlEscape(relation.sourceClassId)}"/>
        <ownedEnd xmi:id="${xmiId('end_target', relation.id)}" type="${xmiId('class', relation.targetClassId)}" puds:classId="${xmlEscape(relation.targetClassId)}"/>
      </packagedElement>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.5.1" xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20131001" xmlns:puds="https://proyectosoftware1.dev/xmi">
  <uml:Model xmi:id="${xmiId('model', diagram.id)}" name="${xmlEscape(diagram.name)}">${classXml}${relationXml}
  </uml:Model>
</xmi:XMI>`;
  }

  async exportJson(diagramId: string, userId: string): Promise<string> {
    const diagram = await this.diagrams.getDiagramById(diagramId, userId);
    return JSON.stringify({
      schemaVersion: 'puds-diagram-1',
      name: diagram.name,
      data: this.normalizeCanonicalData(diagram.data),
    }, null, 2);
  }

  async exportZip(diagramId: string, userId: string): Promise<Buffer> {
    const diagramJson = await this.exportJson(diagramId, userId);
    const archive = new AdmZip();
    archive.addFile(
      'manifest.json',
      Buffer.from(JSON.stringify({
        schemaVersion: 'puds-diagram-package-1',
        diagram: 'diagram.json',
      }, null, 2)),
    );
    archive.addFile('diagram.json', Buffer.from(diagramJson));
    return archive.toBuffer();
  }

  parseJson(content: string) {
    this.assertSize(content, 'JSON');
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadRequestException('Invalid JSON document');
    }
    if (parsed?.schemaVersion !== 'puds-diagram-1') {
      throw new BadRequestException('Unsupported JSON diagram version');
    }
    return {
      name: this.requireName(parsed.name),
      data: this.normalizeCanonicalData(parsed.data),
    };
  }

  parseZip(content: Buffer) {
    if (!Buffer.isBuffer(content) || content.length === 0) {
      throw new BadRequestException('ZIP content is required');
    }
    if (content.length > 5 * 1024 * 1024) {
      throw new BadRequestException('ZIP file exceeds 5 MB');
    }
    let archive: AdmZip;
    try {
      archive = new AdmZip(content);
    } catch {
      throw new BadRequestException('Invalid ZIP package');
    }
    const entries = archive.getEntries();
    let expandedBytes = 0;
    for (const entry of entries) {
      const rawName = (entry as any).rawEntryName
        ? Buffer.from((entry as any).rawEntryName).toString('utf8')
        : entry.entryName;
      if (
        rawName.startsWith('/') ||
        rawName.startsWith('\\') ||
        /^[A-Za-z]:/.test(rawName) ||
        rawName.split(/[\\/]+/).includes('..')
      ) {
        throw new BadRequestException('Unsafe ZIP entry path');
      }
      expandedBytes += entry.header.size;
      if (expandedBytes > 5 * 1024 * 1024) {
        throw new BadRequestException('Expanded ZIP package exceeds 5 MB');
      }
    }
    const manifestEntry = archive.getEntry('manifest.json');
    const diagramEntry = archive.getEntry('diagram.json');
    if (!manifestEntry || !diagramEntry) {
      throw new BadRequestException('ZIP package is missing manifest.json or diagram.json');
    }
    let manifest: any;
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid ZIP manifest');
    }
    if (
      manifest.schemaVersion !== 'puds-diagram-package-1' ||
      manifest.diagram !== 'diagram.json'
    ) {
      throw new BadRequestException('Unsupported ZIP package version');
    }
    return this.parseJson(diagramEntry.getData().toString('utf8'));
  }

  async previewImport(input: {
    workspaceId: string;
    userId: string;
    name: string;
    format: 'xmi' | 'json' | 'zip';
    content: string | Buffer;
  }) {
    const format = String(input.format).toLowerCase() as 'xmi' | 'json' | 'zip';
    const requestedName = this.requireName(input.name);
    let parsed: { name?: string; data: any };
    let unsupported: string[] = [];
    if (format === 'xmi') {
      if (typeof input.content !== 'string') {
        throw new BadRequestException('XMI content must be text');
      }
      const data = this.parseXmi(input.content);
      unsupported = this.unsupportedXmiTypes(input.content);
      parsed = { data };
    } else if (format === 'json') {
      if (typeof input.content !== 'string') {
        throw new BadRequestException('JSON content must be text');
      }
      parsed = this.parseJson(input.content);
    } else if (format === 'zip') {
      const buffer = Buffer.isBuffer(input.content)
        ? input.content
        : Buffer.from(input.content, 'base64');
      parsed = this.parseZip(buffer);
    } else {
      throw new BadRequestException('Unsupported import format');
    }
    const data = this.normalizeCanonicalData(parsed.data);
    const warnings = unsupported.map(
      (type) => `Unsupported XMI element preserved only in the import report: ${type}`,
    );
    const payload = {
      workspaceId: input.workspaceId,
      userId: input.userId,
      name: requestedName || parsed.name,
      format,
      data,
      unsupported,
      warnings,
      exp: this.now() + 10 * 60 * 1000,
      nonce: createHash('sha256')
        .update(`${input.userId}:${this.now()}:${Math.random()}`)
        .digest('hex'),
    };
    return {
      name: payload.name,
      format,
      data,
      accepted: {
        classes: data.classes.length,
        relations: data.relations.length,
      },
      warnings,
      unsupported,
      token: this.signPreview(payload),
    };
  }

  async confirmImport(token: string, userId: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (this.consumedTokens.has(tokenHash)) {
      throw new BadRequestException('Import confirmation token was already used');
    }
    const payload = this.verifyPreview(token);
    if (payload.userId !== userId) {
      throw new BadRequestException('Import confirmation belongs to another user');
    }
    if (payload.exp < this.now()) {
      throw new BadRequestException('Import confirmation token expired');
    }
    this.consumedTokens.add(tokenHash);
    try {
      const diagram = await this.diagrams.createDiagram(
        payload.workspaceId,
        userId,
        payload.name,
      );
      const imported = await this.diagrams.updateDiagram(
        diagram.id,
        userId,
        payload.data,
      );
      await this.audit.record({
        workspaceId: payload.workspaceId,
        actorId: userId,
        action: 'DIAGRAM_IMPORTED',
        entityType: 'Diagram',
        entityId: diagram.id,
        metadata: {
          format: payload.format,
          classCount: payload.data.classes.length,
          relationCount: payload.data.relations.length,
          unsupported: payload.unsupported,
        },
      });
      return imported;
    } catch (error) {
      this.consumedTokens.delete(tokenHash);
      throw error;
    }
  }

  parseXmi(xmi: string) {
    if (!xmi?.trim()) throw new BadRequestException('XMI content is required');
    if (Buffer.byteLength(xmi, 'utf8') > 5 * 1024 * 1024) {
      throw new BadRequestException('XMI file exceeds 5 MB');
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(xmi)) {
      throw new BadRequestException('DTD and entity declarations are not allowed');
    }

    let parsed: any;
    try {
      parsed = this.parser.parse(xmi);
    } catch {
      throw new BadRequestException('Invalid XMI document');
    }
    const root = parsed?.['xmi:XMI'] || parsed?.XMI;
    const version = String(root?.['xmi:version'] ?? root?.version ?? '');
    if (!['2.1', '2.5', '2.5.1'].includes(version)) {
      throw new BadRequestException('Unsupported XMI version');
    }
    const model = root?.['uml:Model'] || root?.Model || root?.['uml:Package'];
    if (!model) throw new BadRequestException('XMI does not contain a UML model');

    const elements = asArray<any>(model.packagedElement || model['uml:packagedElement']);
    const classElements = elements.filter((item) =>
      String(item['xmi:type'] || item.type || '').endsWith('Class'));
    if (classElements.length === 0) {
      throw new BadRequestException('XMI does not contain UML classes');
    }

    const idMap = new Map<string, string>();
    const classes = classElements.map((item, index) => {
      const externalId = item['xmi:id'] || item.id || `class-${index + 1}`;
      const id = item['puds:id'] || externalId;
      idMap.set(externalId, id);
      const attributes = asArray<any>(item.ownedAttribute).map((attribute, attributeIndex) => ({
        id: attribute['puds:id'] || attribute['xmi:id'] || `${id}-attribute-${attributeIndex + 1}`,
        name: attribute.name || `attribute${attributeIndex + 1}`,
        type: attribute['puds:type'] || this.typeFromNode(attribute.type) || 'String',
        nullable: String(attribute['puds:nullable'] ?? 'true') !== 'false',
        unique: String(attribute['puds:unique'] ?? 'false') === 'true',
      }));
      const methods = asArray<any>(item.ownedOperation).map((method, methodIndex) => ({
        id: method['puds:id'] || method['xmi:id'] || `${id}-method-${methodIndex + 1}`,
        name: method.name || `method${methodIndex + 1}`,
        returnType: method['puds:returnType'] || 'void',
        visibility: method.visibility || 'public',
        parameters: asArray<any>(method.ownedParameter)
          .filter((parameter) => parameter.direction !== 'return')
          .map((parameter, parameterIndex) => ({
            name: parameter.name || `parameter${parameterIndex + 1}`,
            type: parameter['puds:type'] || this.typeFromNode(parameter.type) || 'String',
          })),
      }));
      return {
        id,
        name: item.name || `Class${index + 1}`,
        position: {
          x: Number(item['puds:x'] ?? 80 + (index % 3) * 280),
          y: Number(item['puds:y'] ?? 80 + Math.floor(index / 3) * 220),
        },
        attributes,
        methods,
      };
    });

    const relations = elements
      .filter((item) => String(item['xmi:type'] || item.type || '').endsWith('Association'))
      .flatMap((item, index) => {
        const ends = asArray<any>(item.ownedEnd);
        if (ends.length < 2) return [];
        const sourceClassId = ends[0]['puds:classId'] || idMap.get(ends[0].type);
        const targetClassId = ends[1]['puds:classId'] || idMap.get(ends[1].type);
        if (!sourceClassId || !targetClassId) return [];
        return [{
          id: item['puds:id'] || item['xmi:id'] || `relation-${index + 1}`,
          name: item.name || '',
          type: item['puds:relationType'] || 'ASSOCIATION',
          sourceClassId,
          targetClassId,
        }];
      });

    return { classes, relations, metadata: { importedFrom: 'XMI 2.5.1' } };
  }

  async importXmi(workspaceId: string, userId: string, name: string, xmi: string) {
    const preview = await this.previewImport({
      workspaceId,
      userId,
      name,
      format: 'xmi',
      content: xmi,
    });
    return this.confirmImport(preview.token, userId);
  }

  private assertSize(content: string, label: string): void {
    if (!content?.trim()) throw new BadRequestException(`${label} content is required`);
    if (Buffer.byteLength(content, 'utf8') > 5 * 1024 * 1024) {
      throw new BadRequestException(`${label} file exceeds 5 MB`);
    }
  }

  private requireName(value: unknown): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) throw new BadRequestException('Diagram name is required');
    if (normalized.length > 120) throw new BadRequestException('Diagram name is too long');
    return normalized;
  }

  private normalizeCanonicalData(value: unknown): { classes: any[]; relations: any[]; metadata?: any } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Diagram data must be an object');
    }
    const data = value as any;
    if (!Array.isArray(data.classes) || !Array.isArray(data.relations)) {
      throw new BadRequestException('Diagram data requires classes and relations arrays');
    }
    return {
      classes: data.classes,
      relations: data.relations,
      ...(data.metadata && typeof data.metadata === 'object'
        ? { metadata: data.metadata }
        : {}),
    };
  }

  private unsupportedXmiTypes(xmi: string): string[] {
    const supported = new Set(['uml:Class', 'uml:Association']);
    return Array.from(
      new Set(
        Array.from(xmi.matchAll(/xmi:type=["']([^"']+)["']/g))
          .map((match) => match[1])
          .filter((type) => !supported.has(type)),
      ),
    );
  }

  private signPreview(payload: Record<string, unknown>): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.previewSecret())
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${signature}`;
  }

  private verifyPreview(token: string): any {
    const [encoded, signature, extra] = token.split('.');
    if (!encoded || !signature || extra) {
      throw new BadRequestException('Invalid import confirmation token');
    }
    const expected = createHmac('sha256', this.previewSecret())
      .update(encoded)
      .digest();
    let received: Buffer;
    try {
      received = Buffer.from(signature, 'base64url');
    } catch {
      throw new BadRequestException('Invalid import confirmation token');
    }
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new BadRequestException('Invalid import confirmation token');
    }
    try {
      return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid import confirmation token');
    }
  }

  private previewSecret(): string {
    return process.env.IMPORT_PREVIEW_SECRET ||
      process.env.JWT_SECRET ||
      'local-import-preview-secret-change-before-deployment';
  }

  private typeFromNode(type: unknown): string | undefined {
    if (typeof type === 'string') return type;
    if (type && typeof type === 'object') {
      const node = type as any;
      const href = node.href || node['xmi:idref'];
      return typeof href === 'string' ? href.split('#').pop() : undefined;
    }
    return undefined;
  }
}
