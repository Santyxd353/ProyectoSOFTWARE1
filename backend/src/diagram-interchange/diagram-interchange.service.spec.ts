import { BadRequestException } from '@nestjs/common';
import { DiagramInterchangeService } from './diagram-interchange.service';

describe('DiagramInterchangeService XMI', () => {
  const diagrams = {
    getDiagramById: jest.fn(),
    createDiagram: jest.fn(),
    updateDiagram: jest.fn(),
  };
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
    service = new DiagramInterchangeService(diagrams as any);
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

  it('creates a platform diagram from imported XMI', async () => {
    diagrams.getDiagramById.mockResolvedValue(source);
    diagrams.createDiagram.mockResolvedValue({ id: 'imported-1' });
    diagrams.updateDiagram.mockResolvedValue({ id: 'imported-1', name: 'Imported Sales' });
    const xmi = await service.exportXmi('diagram-1', 'user-1');

    await service.importXmi('workspace-1', 'user-1', 'Imported Sales', xmi);

    expect(diagrams.createDiagram).toHaveBeenCalledWith('workspace-1', 'user-1', 'Imported Sales');
    expect(diagrams.updateDiagram).toHaveBeenCalledWith(
      'imported-1',
      'user-1',
      expect.objectContaining({ classes: expect.any(Array), relations: expect.any(Array) }),
    );
  });

  it('rejects documents with external entities', () => {
    expect(() => service.parseXmi('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><xmi:XMI/>'))
      .toThrow(BadRequestException);
  });
});
