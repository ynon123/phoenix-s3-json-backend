'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('OpenAPI contract', () => {
  test('openapi.yaml parses and includes expected routes', () => {
    const filePath = path.join(__dirname, '..', 'openapi', 'openapi.yaml');
    const raw = fs.readFileSync(filePath, 'utf8');
    const spec = yaml.load(raw);

    expect(spec).toBeDefined();
    expect(spec.openapi).toMatch(/^3\./);

    const route = spec.paths['/json/{key}'];
    expect(route).toBeDefined();
    expect(route.post).toBeDefined();
    expect(route.get).toBeDefined();
    expect(route.post['x-amazon-apigateway-integration']).toBeDefined();
    expect(route.get['x-amazon-apigateway-integration']).toBeDefined();
  });
});

