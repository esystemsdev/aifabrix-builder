/**
 * @fileoverview AJV: minimal DatasourceTestRun fixture validates against Builder schema.
 */

const Ajv = require('ajv');
const path = require('path');
const fixture = require('../../fixtures/datasource-test-run-minimal.json');

describe('datasource-test-run.schema.json (AJV)', () => {
  it('validates minimal fixture', () => {
    const raw = require('../../../lib/schema/datasource-test-run.schema.json');
    const schema = { ...raw };
    delete schema.$schema;
    const ajv = new Ajv({ allErrors: true, strict: false, strictSchema: false });
    const validate = ajv.compile(schema);
    const ok = validate(fixture);
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });

  it('builder schema matches dataplane sibling when present', () => {
    const builderPath = path.join(__dirname, '../../../lib/schema/datasource-test-run.schema.json');
    const dpPath = path.join(
      __dirname,
      '../../../../aifabrix-dataplane/app/schemas/json/datasource-test-run.schema.json'
    );
    const fs = require('fs');
    if (!fs.existsSync(dpPath)) {
      expect(true).toBe(true);
      return;
    }
    const a = fs.readFileSync(builderPath, 'utf8');
    const b = fs.readFileSync(dpPath, 'utf8');
    expect(a).toBe(b);
  });
});
