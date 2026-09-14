import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { DiagramService } from '../diagram/diagram.service';

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
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: false,
    trimValues: true,
  });

  constructor(private readonly diagrams: DiagramService) {}

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
    const normalizedName = name.trim();
    if (!normalizedName) throw new BadRequestException('Diagram name is required');
    const data = this.parseXmi(xmi);
    const diagram = await this.diagrams.createDiagram(workspaceId, userId, normalizedName);
    return this.diagrams.updateDiagram(diagram.id, userId, data);
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
