import { buildApiArtifacts } from './api-artifacts';

describe('buildApiArtifacts', () => {
  const classes = [{
    className: 'Customer',
    pluralName: 'customers',
    idType: 'Long',
    attributes: [
      { name: 'id', type: 'Long', isId: true, isRelation: false, nullable: false },
      { name: 'email', type: 'String', isId: false, isRelation: false, nullable: false, sampleValue: 'customer@example.com' },
      { name: 'active', type: 'Boolean', isId: false, isRelation: false, nullable: true, sampleValue: true },
    ],
  }];

  it('produces OpenAPI 3 CRUD paths with request and response examples', () => {
    const { openapi } = buildApiArtifacts('Customers API', classes);

    expect(openapi.openapi).toBe('3.0.3');
    expect(openapi.servers).toEqual([{ url: 'http://localhost:8080' }]);
    expect(Object.keys(openapi.paths['/api/customers'])).toEqual(
      expect.arrayContaining(['get', 'post']),
    );
    expect(Object.keys(openapi.paths['/api/customers/{id}'])).toEqual(
      expect.arrayContaining(['get', 'put', 'delete']),
    );
    expect(openapi.paths['/api/customers'].post.requestBody.content['application/json'].example)
      .toEqual(expect.objectContaining({ email: 'customer@example.com', active: true }));
    expect(openapi.components.schemas.Customer.required).toContain('email');
  });

  it('produces a Postman 2.1 collection with five CRUD requests and status assertions', () => {
    const { postman } = buildApiArtifacts('Customers API', classes);
    const requests = postman.item.flatMap((group: any) => group.item);

    expect(postman.info.schema).toBe(
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    );
    expect(postman.variable).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'baseUrl', value: 'http://localhost:8080' }),
      expect.objectContaining({ key: 'customerId', value: '1' }),
    ]));
    expect(requests).toHaveLength(5);
    expect(requests.map((entry: any) => entry.request.method)).toEqual(
      expect.arrayContaining(['GET', 'POST', 'PUT', 'DELETE']),
    );
    expect(requests.every((entry: any) =>
      entry.event.some((event: any) =>
        event.listen === 'test' && event.script.exec.join('\n').includes('pm.response.to.have.status'),
      ),
    )).toBe(true);
  });

  it('uses variables only and never embeds authentication credentials', () => {
    const artifacts = buildApiArtifacts('Customers API', classes);
    const serialized = JSON.stringify(artifacts).toLowerCase();

    expect(serialized).toContain('{{baseurl}}');
    expect(serialized).not.toContain('bearer ');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('api_key');
  });
});
