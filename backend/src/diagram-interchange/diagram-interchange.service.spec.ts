import { BadRequestException } from '@nestjs/common';
import AdmZip = require('adm-zip');
import { DiagramInterchangeService } from './diagram-interchange.service';

describe('DiagramInterchangeService XMI', () => {
  const diagrams = {
    getDiagramById: jest.fn(),
    createDiagram: jest.fn(),
    updateDiagram: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
  let service: DiagramInterchangeService;

  const source = {
    id: 'diagram-1',
    name: 'Sales',
    data: {
      classes: [
        {
          id: 'customer',
          name: 'Customer',
          position: { x: 120, y: 80 },
          attributes: [{ id: 'email', name: 'email', type: 'String', nullable: false, unique: true }],
          methods: [{ id: 'buy', name: 'buy', returnType: 'Order', visibility: 'public', parameters: [] }],
        },
        { id: 'order', name: 'Order', position: { x: 400, y: 80 }, attributes: [], methods: [] },
      ],
      relations: [
        { id: 'places', name: 'places', type: 'ASSOCIATION', sourceClassId: 'customer', targetClassId: 'order' },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiagramInterchangeService(diagrams as any, audit as any);
  });

  it('exports UML 2.5 XMI with classes, members and relations', async () => {
    diagrams.getDiagramById.mockResolvedValue(source);

    const xmi = await service.exportXmi('diagram-1', 'user-1');

    expect(xmi).toContain('<xmi:XMI');
    expect(xmi).toContain('xmi:version="2.5.1"');
    expect(xmi).toContain('name="Customer"');
    expect(xmi).toContain('name="email"');
    expect(xmi).toContain('xmi:type="uml:Association"');
  });

  it('round-trips the platform XMI without losing the core model', async () => {
    diagrams.getDiagramById.mockResolvedValue(source);
    const xmi = await service.exportXmi('diagram-1', 'user-1');

    const parsed = service.parseXmi(xmi);

    expect(parsed.classes.map((item) => item.name)).toEqual(['Customer', 'Order']);
    expect(parsed.classes[0].attributes[0]).toEqual(expect.objectContaining({ name: 'email', type: 'String' }));
    expect(parsed.relations[0]).toEqual(expect.objectContaining({ sourceClassId: 'customer', targetClassId: 'order' }));
  });

  it('previews XMI without writing and persists it only after confirmation', async () => {
    diagrams.getDiagramById.mockResolvedValue(source);
    diagrams.createDiagram.mockResolvedValue({ id: 'imported-1' });
    diagrams.updateDiagram.mockResolvedValue({ id: 'imported-1', name: 'Imported Sales' });
    const xmi = await service.exportXmi('diagram-1', 'user-1');

    const preview = await service.previewImport({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      name: 'Imported Sales',
      format: 'xmi',
      content: xmi,
    });

    expect(preview.accepted).toEqual({ classes: 2, relations: 1 });
    expect(preview.token).toEqual(expect.any(String));
    expect(diagrams.createDiagram).not.toHaveBeenCalled();

    await service.confirmImport(preview.token, 'user-1');

    expect(diagrams.createDiagram).toHaveBeenCalledWith('workspace-1', 'user-1', 'Imported Sales');
    expect(diagrams.updateDiagram).toHaveBeenCalledWith(
      'imported-1',
      'user-1',
      expect.objectContaining({ classes: expect.any(Array), relations: expect.any(Array) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      action: 'DIAGRAM_IMPORTED',
      entityId: 'imported-1',
    }));
  });

  it('round-trips the canonical JSON package', async () => {
    diagrams.getDiagramById.mockResolvedValue(source);

    const json = await service.exportJson('diagram-1', 'user-1');
    const parsed = service.parseJson(json);

    expect(parsed.data).toEqual(source.data);
    expect(parsed.name).toBe('Sales');
  });

  it('round-trips the product ZIP containing manifest and diagram JSON', async () => {
    diagrams.getDiagramById.mockResolvedValue(source);

    const archive = await service.exportZip('diagram-1', 'user-1');
    const parsed = service.parseZip(archive);

    expect(parsed.data).toEqual(source.data);
    expect(parsed.name).toBe('Sales');
  });

  it('rejects ZIP entries that escape the package root', () => {
    const archive = new AdmZip();
    archive.addFile('../diagram.json', Buffer.from('{}'));
    archive.addFile('manifest.json', Buffer.from('{"schemaVersion":"puds-diagram-1"}'));

    expect(() => service.parseZip(archive.toBuffer())).toThrow(
      BadRequestException,
    );
  });

  it('rejects a tampered confirmation token', async () => {
    diagrams.getDiagramById.mockResolvedValue(source);
    const xmi = await service.exportXmi('diagram-1', 'user-1');
    const preview = await service.previewImport({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      name: 'Imported Sales',
      format: 'xmi',
      content: xmi,
    });

    await expect(
      service.confirmImport(`${preview.token}tampered`, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(diagrams.createDiagram).not.toHaveBeenCalled();
  });

  it('rejects an expired or already consumed confirmation token', async () => {
    let now = Date.parse('2026-09-14T10:00:00.000Z');
    (service as any).now = () => now;
    diagrams.getDiagramById.mockResolvedValue(source);
    diagrams.createDiagram.mockResolvedValue({ id: 'imported-1' });
    diagrams.updateDiagram.mockResolvedValue({ id: 'imported-1' });
    const xmi = await service.exportXmi('diagram-1', 'user-1');
    const preview = await service.previewImport({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      name: 'Imported Sales',
      format: 'xmi',
      content: xmi,
    });
    now += 11 * 60 * 1000;

    await expect(
      service.confirmImport(preview.token, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    now -= 11 * 60 * 1000;
    const fresh = await service.previewImport({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      name: 'Imported Sales',
      format: 'xmi',
      content: xmi,
    });
    await service.confirmImport(fresh.token, 'user-1');
    await expect(
      service.confirmImport(fresh.token, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports unsupported XMI elements instead of silently hiding them', async () => {
    const xmi = `<?xml version="1.0"?><xmi:XMI xmi:version="2.5.1" xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20131001"><uml:Model xmi:id="m1"><packagedElement xmi:type="uml:Class" xmi:id="c1" name="Customer"/><packagedElement xmi:type="uml:StateMachine" xmi:id="s1" name="Flow"/></uml:Model></xmi:XMI>`;

    const preview = await service.previewImport({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      name: 'Imported Sales',
      format: 'xmi',
      content: xmi,
    });

    expect(preview.unsupported).toEqual(['uml:StateMachine']);
    expect(preview.warnings[0]).toContain('uml:StateMachine');
  });

  it('rejects documents with external entities', () => {
    expect(() => service.parseXmi('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><xmi:XMI/>'))
      .toThrow(BadRequestException);
  });
});
