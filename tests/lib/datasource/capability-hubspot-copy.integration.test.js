/**
 * Golden-path copy against HubSpot companies datasource (optional multi-repo workspace).
 *
 * @fileoverview Integration test when aifabrix-dataplane repo is checked out as a sibling
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { runCapabilityCopy } = require('../../../lib/datasource/capability/run-capability-copy');
const { runCapabilityRemove } = require('../../../lib/datasource/capability/run-capability-remove');
const { validateDatasourceParsed } = require('../../../lib/datasource/validate');

const HUBSPOT_DS = path.join(
  __dirname,
  '../../../../aifabrix-dataplane/integration/test-e2e-hubspot/test-e2e-hubspot-datasource-companies.json'
);

const describeIfHubspot = fs.existsSync(HUBSPOT_DS) ? describe : describe.skip;

describeIfHubspot('capability copy (HubSpot companies fixture)', () => {
  let tmpDir;
  let tmpFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-copy-'));
    tmpFile = path.join(tmpDir, 'test-e2e-hubspot-datasource-companies.json');
    fs.copyFileSync(HUBSPOT_DS, tmpFile);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('dry-run leaves file unchanged and validates patch shape', async() => {
    const before = fs.readFileSync(tmpFile, 'utf8');
    const r = await runCapabilityCopy({
      fileOrKey: tmpFile,
      from: 'create',
      as: 'createCliGolden',
      dryRun: true
    });
    expect(r.dryRun).toBe(true);
    expect(r.patchOperations.length).toBeGreaterThan(0);
    expect(fs.readFileSync(tmpFile, 'utf8')).toBe(before);
  });

  it('copy adds capability and keeps original create operation intact', async() => {
    const beforeParsed = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    const origCreate = JSON.stringify(beforeParsed.openapi.operations.create);

    await runCapabilityCopy({
      fileOrKey: tmpFile,
      from: 'create',
      as: 'createCliGolden',
      overwrite: false,
      noBackup: true
    });

    const afterParsed = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    expect(JSON.stringify(afterParsed.openapi.operations.create)).toBe(origCreate);
    expect(afterParsed.openapi.operations.createcligolden).toBeDefined();
    expect(afterParsed.execution.cip.operations.createcligolden).toBeDefined();
    expect(afterParsed.capabilities).toContain('createCliGolden');

    const vr = validateDatasourceParsed(afterParsed);
    expect(vr.valid).toBe(true);
  });

  it('remove drops copied capability and file stays schema-valid', async() => {
    await runCapabilityCopy({
      fileOrKey: tmpFile,
      from: 'create',
      as: 'createCliGolden',
      overwrite: false,
      noBackup: true
    });

    await runCapabilityRemove({
      fileOrKey: tmpFile,
      capability: 'createCliGolden',
      noBackup: true
    });

    const p = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    expect(p.openapi.operations.createcligolden).toBeUndefined();
    expect(p.execution.cip.operations.createcligolden).toBeUndefined();
    expect(p.capabilities.includes('createCliGolden')).toBe(false);
    expect(validateDatasourceParsed(p).valid).toBe(true);
  });
});
