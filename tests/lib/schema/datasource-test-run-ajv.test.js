/**
 * @fileoverview AJV: minimal DatasourceTestRun fixture validates against Builder schema.
 */

const Ajv = require('ajv');
const path = require('path');
const fixture = require('../../fixtures/datasource-test-run-minimal.json');
/**
 * Real sync fs (setupFiles capture). Avoids jest.mock('fs') leaks: existsSync true + read ENOENT.
 * @type {typeof import('node:fs')}
 */
const nodeFs = global.__AIFABRIX_NODE_FS_UNMOCKED__ || require('node:fs');

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
    const builderRoot = path.resolve(__dirname, '../../..');
    const builderPath = path.join(builderRoot, 'lib/schema/datasource-test-run.schema.json');
    const dpPath = path.resolve(
      builderRoot,
      '..',
      'aifabrix-dataplane',
      'app/schemas/json/datasource-test-run.schema.json'
    );
    let dataplaneRaw;
    try {
      dataplaneRaw = nodeFs.readFileSync(dpPath, 'utf8');
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
        return;
      }
      throw err;
    }
    const builderRaw = nodeFs.readFileSync(builderPath, 'utf8');
    expect(builderRaw).toBe(dataplaneRaw);
  });
});
