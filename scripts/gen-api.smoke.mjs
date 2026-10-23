// Smoke test (no backend needed): openapi-typescript (peer typescript ^5) must generate types
// under the project's TypeScript 6 (see package.json "overrides"). Usage: npm run gen:api:smoke
import assert from 'node:assert/strict';
import ts from 'typescript';
import openapiTS, { astToString } from 'openapi-typescript';

const spec = {
  openapi: '3.0.3',
  info: { title: 't', version: '1' },
  paths: {},
  components: {
    schemas: { Foo: { type: 'object', required: ['a'], properties: { a: { type: 'string' } } } },
  },
};

const ast = await openapiTS(JSON.stringify(spec));
const output = astToString(ast);
assert.match(output, /\bFoo\b/, 'output must contain Foo');
assert.match(output, /\ba: string;/, 'output must contain "a: string;"');
assert.doesNotMatch(output, /\ba\?:/, 'required property a must not be optional');
console.log(`OK: openapi-typescript generated types with typescript ${ts.version}`);
