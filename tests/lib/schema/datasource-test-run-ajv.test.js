/**
 * @fileoverview AJV: minimal DatasourceTestRun fixture validates against Builder schema.
 */

const Ajv = require('ajv');
const path = require('path');
const fixture = require('../../fixtures/datasource-test-run-minimal.json');
const fixtureRich = require('../../fixtures/datasource-test-run-rich.json');
/**
 * Real sync fs (setupFiles capture). Avoids jest.mock('fs') leaks: existsSync true + read ENOENT.
 * @type {typeof import('node:fs')}
 */
const nodeFs = global.__AIFABRIX_NODE_FS_UNMOCKED__ || require('node:fs');

describe('datasource-test-run.schema.json (AJV)', () => {
  function compileValidator() {
    const raw = require('../../../lib/schema/datasource-test-run.schema.json');
    const schema = { ...raw };
    delete schema.$schema;
    const ajv = new Ajv({ allErrors: true, strict: false, strictSchema: false });
    return ajv.compile(schema);
  }

  it('validates minimal fixture', () => {
    const validate = compileValidator();
    const ok = validate(fixture);
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });

  it('validates rich fixture (validation, integration, certificate, capabilities)', () => {
    const validate = compileValidator();
    const ok = validate(fixtureRich);
    expect(validate.errors).toBeNull();
    expect(ok).toBe(true);
  });

  it('rejects envelope missing required datasourceKey', () => {
    const validate = compileValidator();
    const bad = { ...fixture };
    delete bad.datasourceKey;
    expect(validate(bad)).toBe(false);
    expect(validate.errors && validate.errors.length).toBeGreaterThan(0);
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
