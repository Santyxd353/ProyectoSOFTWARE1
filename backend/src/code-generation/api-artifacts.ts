type ApiAttribute = {
  name: string;
  type: string;
  isId?: boolean;
  isRelation?: boolean;
  nullable?: boolean;
  sampleValue?: unknown;
};

type ApiClass = {
  className: string;
  pluralName: string;
  idType?: string;
  attributes: ApiAttribute[];
};

const schemaForType = (type: string) => {
  switch (type) {
    case 'Integer': return { type: 'integer', format: 'int32' };
    case 'Long': return { type: 'integer', format: 'int64' };
    case 'BigDecimal':
    case 'Double': return { type: 'number', format: 'double' };
    case 'Float': return { type: 'number', format: 'float' };
    case 'Boolean': return { type: 'boolean' };
    case 'LocalDate': return { type: 'string', format: 'date' };
    case 'LocalDateTime': return { type: 'string', format: 'date-time' };
    default: return { type: 'string' };
  }
};

const exampleFor = (attribute: ApiAttribute): unknown => {
  if (typeof attribute.sampleValue === 'boolean' || typeof attribute.sampleValue === 'number') {
    return attribute.sampleValue;
  }
  const sample = String(attribute.sampleValue ?? '')
    .replace(/^"|"$/g, '')
    .replace(/^new BigDecimal\("|"\)$/g, '');
  if (attribute.type === 'Boolean') return sample ? sample === 'true' : true;
  if (['Integer', 'Long', 'BigDecimal', 'Double', 'Float'].includes(attribute.type)) {
    const value = Number(sample.replace(/[Lf]$/, ''));
    return Number.isFinite(value) ? value : 1;
  }
  if (attribute.type === 'LocalDate') return '2026-01-15';
  if (attribute.type === 'LocalDateTime') return '2026-01-15T12:00:00';
  return sample || `Sample ${attribute.name}`;
};

const testEvent = (status: number) => [{
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: [`pm.test("Status code is ${status}", function () {`, `  pm.response.to.have.status(${status});`, '});'],
  },
}];

export const buildApiArtifacts = (projectName: string, classes: ApiClass[]) => {
  const schemas: Record<string, any> = {};
  const paths: Record<string, any> = {};
  const postmanItems: any[] = [];
  const variables: any[] = [{ key: 'baseUrl', value: 'http://localhost:8080', type: 'string' }];

  for (const cls of classes) {
    const resource = String(cls.pluralName || `${cls.className.toLowerCase()}s`)
      .replace(/[^A-Za-z0-9_-]/g, '')
      .toLowerCase();
    const variablePrefix = cls.className.charAt(0).toLowerCase() + cls.className.slice(1);
    const idVariable = `${variablePrefix}Id`;
    variables.push({ key: idVariable, value: '1', type: 'string' });

    const scalarAttributes = cls.attributes.filter((attribute) => !attribute.isRelation);
    const writableAttributes = scalarAttributes.filter((attribute) => !attribute.isId);
    const example = Object.fromEntries(writableAttributes.map((attribute) => [
      attribute.name,
      exampleFor(attribute),
    ]));
    const responseExample = {
      ...Object.fromEntries(scalarAttributes.filter((attribute) => attribute.isId).map((attribute) => [attribute.name, 1])),
      ...example,
    };
    schemas[cls.className] = {
      type: 'object',
      properties: Object.fromEntries(scalarAttributes.map((attribute) => [
        attribute.name,
        { ...schemaForType(attribute.type), example: exampleFor(attribute) },
      ])),
      required: scalarAttributes
        .filter((attribute) => !attribute.isId && attribute.nullable === false)
        .map((attribute) => attribute.name),
    };

    const collectionPath = `/api/${resource}`;
    const itemPath = `${collectionPath}/{id}`;
    const entityContent = {
      'application/json': {
        schema: { $ref: `#/components/schemas/${cls.className}` },
        example: responseExample,
      },
    };
    paths[collectionPath] = {
      get: {
        tags: [cls.className],
        summary: `List ${resource}`,
        responses: { 200: { description: 'Successful response', content: { 'application/json': { schema: { type: 'array', items: { $ref: `#/components/schemas/${cls.className}` } }, example: [responseExample] } } } },
      },
      post: {
        tags: [cls.className],
        summary: `Create ${cls.className}`,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${cls.className}` }, example } } },
        responses: { 201: { description: 'Created', content: entityContent } },
      },
    };
    paths[itemPath] = {
      parameters: [{ name: 'id', in: 'path', required: true, schema: schemaForType(cls.idType || 'Long'), example: 1 }],
      get: { tags: [cls.className], summary: `Get ${cls.className}`, responses: { 200: { description: 'Successful response', content: entityContent }, 404: { description: 'Not found' } } },
      put: {
        tags: [cls.className],
        summary: `Update ${cls.className}`,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${cls.className}` }, example } } },
        responses: { 200: { description: 'Updated', content: entityContent }, 404: { description: 'Not found' } },
      },
      delete: { tags: [cls.className], summary: `Delete ${cls.className}`, responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } } },
    };

    const url = (suffix = '') => `{{baseUrl}}${collectionPath}${suffix}`;
    const requestBody = { mode: 'raw', raw: JSON.stringify(example, null, 2), options: { raw: { language: 'json' } } };
    postmanItems.push({
      name: cls.className,
      item: [
        { name: `List ${resource}`, request: { method: 'GET', header: [], url: url() }, event: testEvent(200) },
        { name: `Create ${cls.className}`, request: { method: 'POST', header: [{ key: 'Content-Type', value: 'application/json' }], body: requestBody, url: url() }, event: testEvent(201) },
        { name: `Get ${cls.className}`, request: { method: 'GET', header: [], url: url(`/{{${idVariable}}}`) }, event: testEvent(200) },
        { name: `Update ${cls.className}`, request: { method: 'PUT', header: [{ key: 'Content-Type', value: 'application/json' }], body: requestBody, url: url(`/{{${idVariable}}}`) }, event: testEvent(200) },
        { name: `Delete ${cls.className}`, request: { method: 'DELETE', header: [], url: url(`/{{${idVariable}}}`) }, event: testEvent(204) },
      ],
    });
  }

  return {
    openapi: {
      openapi: '3.0.3',
      info: { title: projectName, version: '1.0.0', description: 'Generated from the confirmed UML model.' },
      servers: [{ url: 'http://localhost:8080' }],
      paths,
      components: { schemas },
    },
    postman: {
      info: {
        name: `${projectName} CRUD API`,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      variable: variables,
      item: postmanItems,
    },
  };
};
