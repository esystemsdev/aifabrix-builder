'use strict';

jest.mock('../../../lib/protection/auth-context', () => ({
  resolveProtectionDataplaneContext: jest.fn()
}));

jest.mock('../../../lib/api/protection.api', () => ({
  validateProtection: jest.fn(),
  simulateProtection: jest.fn()
}));

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../lib/protection/paths', () => ({
  getProtectionRoot: jest.fn(),
  describeProtectionRoot: jest.fn(() => ({
    root: '',
    label: 'integration/.protection',
    usingLegacy: false,
    migrationHint: null
  }))
}));

const { getProtectionRoot } = require('../../../lib/protection/paths');
const { validateProtection, simulateProtection } = require('../../../lib/api/protection.api');
const { resolveProtectionDataplaneContext } = require('../../../lib/protection/auth-context');
const {
  processProtectionValidateFile,
  runValidateProtectionBatch
} = require('../../../lib/protection/validate-batch');
const { writeHubspotCompaniesManifest } = require('./protection-test-fixtures');

describe('protection validate-batch', () => {
  let tmpRoot;
  let manifestPath;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prot-val-batch-'));
    getProtectionRoot.mockReset();
    const dir = path.join(tmpRoot, 'prot');
    getProtectionRoot.mockReturnValue(dir);
    manifestPath = writeHubspotCompaniesManifest(dir);
    resolveProtectionDataplaneContext.mockResolvedValue({
      environment: 'dev',
      dataplaneUrl: 'http://dp',
      authConfig: { type: 'bearer', token: 't' }
    });
    validateProtection.mockResolvedValue({
      summary: { fail: 0, warn: 0, pass: 1 },
      results: [{ status: 'PASS', taskId: 't1' }]
    });
  });

  afterEach(() => {
    validateProtection.mockClear();
    simulateProtection.mockClear();
    resolveProtectionDataplaneContext.mockClear();
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
      } catch {
        /* best-effort */
      }
    }
  });

  it('skipDataplane validates local schema only', async() => {
    const outcome = await processProtectionValidateFile(manifestPath, null, {
      skipDataplane: true
    });
    expect(outcome.row.ok).toBe(true);
    expect(validateProtection).not.toHaveBeenCalled();
  });

  it('fails on invalid local schema', async() => {
    fs.writeFileSync(manifestPath, 'kind: Protection\n');
    const outcome = await processProtectionValidateFile(manifestPath, null, {});
    expect(outcome.row.ok).toBe(false);
    expect(outcome.stop).toBe(true);
    expect(validateProtection).not.toHaveBeenCalled();
  });

  it('runValidateProtectionBatch returns exitCode 0 when dataplane passes', async() => {
    const batch = await runValidateProtectionBatch({});
    expect(batch.valid).toBe(true);
    expect(batch.exitCode).toBe(0);
    expect(validateProtection).toHaveBeenCalledTimes(1);
  });

  it('runValidateProtectionBatch includes .json manifests', async() => {
    const yaml = require('js-yaml');
    const base = yaml.load(fs.readFileSync(manifestPath, 'utf8'));
    const dealsManifest = {
      ...base,
      metadata: { ...base.metadata, key: 'hubspot-deals-prot' },
      spec: { ...base.spec, datasourceKey: 'hubspot-deals' }
    };
    const jsonPath = path.join(path.dirname(manifestPath), 'hubspot-deals.json');
    fs.writeFileSync(jsonPath, JSON.stringify(dealsManifest, null, 2), 'utf8');

    const batch = await runValidateProtectionBatch({});
    expect(batch.results.length).toBe(2);
    expect(batch.results.every((r) => r.ok)).toBe(true);
    expect(batch.valid).toBe(true);
    expect(validateProtection).toHaveBeenCalledTimes(2);
  });

  it('runValidateProtectionBatch returns exitCode 1 when dataplane fails', async() => {
    validateProtection.mockResolvedValue({
      summary: { fail: 1, warn: 0 },
      results: [{ status: 'FAIL', message: 'bad rule', errorCode: 'DP-PROT-001' }]
    });
    const batch = await runValidateProtectionBatch({});
    expect(batch.valid).toBe(false);
    expect(batch.exitCode).toBe(1);
    expect(batch.results[0].ok).toBe(false);
  });
});
