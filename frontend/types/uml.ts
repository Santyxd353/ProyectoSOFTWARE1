export interface UMLClass {
  id: string;
  name: string;
  position: { x: number; y: number };
  attributes: UMLAttribute[];
  methods: UMLMethod[];
  stereotypes?: string[];
}

export interface UMLAttribute {
  id: string;
  name: string;
  type: string;
  multiplicity?: string;
  stereotype?: string;
  nullable: boolean;
  unique: boolean;
}

export interface UMLMethod {
  id: string;
  name: string;
  returnType: string;
  parameters: Parameter[];
  visibility: 'public' | 'private' | 'protected';
}

export interface Parameter {
  name: string;
  type: string;
}

export enum RelationType {
  ASSOCIATION = 'ASSOCIATION',
  INHERITANCE = 'INHERITANCE',
  COMPOSITION = 'COMPOSITION',
  AGGREGATION = 'AGGREGATION',
  DEPENDENCY = 'DEPENDENCY',
  REALIZATION = 'REALIZATION',
  ONETOONE = 'OneToOne',
  ONETOMANY = 'OneToMany',
  MANYTOONE = 'ManyToOne',
  MANYTOMANY = 'ManyToMany',
}

export interface UMLRelation {
  id: string;
  type: RelationType;
  multiplicity?: string | {
    source?: string;
    target?: string;
  };
  name?: string;
  sourceClassId: string;
  targetClassId: string;
  sourceHandle?: string; // top, right, bottom, left
  targetHandle?: string; // top, right, bottom, left
  // Tabla intermedia para relaciones muchos a muchos
  intermediateTable?: {
    id: string;
    name: string;
    position: { x: number; y: number };
    attributes?: string[]; // Format: "name: Type [STEREOTYPE]"
  };
}

export interface Diagram {
  id: string;
  name: string;
  data: {
    classes: UMLClass[];
    relations: UMLRelation[];
    metadata?: any;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
}