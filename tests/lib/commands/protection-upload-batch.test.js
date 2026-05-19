'use strict';

jest.mock('../../../lib/protection/auth-context', () => ({
  resolveProtectionDataplaneContext: jest.fn()
}));

jest.mock('../../../lib/protection/preflight-datasource-ready', () => ({
  preflightDatasourceReady: jest.fn()
}));

jest.mock('../../../lib/api/protection.api', () => ({
  validateProtection: jest.fn(),
  uploadProtection: jest.fn()
}));

jest.mock('../../../lib/protection/sync-after-upload', () => ({
  syncUniqueDatasourcesAfterUpload: jest.fn().mockResolvedValue([])
}));

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

jest.mock('../../../lib/protection/paths', () => ({
  getProtectionRoot: jest.fn(),
  describeProtectionRoot: jest.fn(() => ({
    root: '',
    label: 'integration/.protection',
    usingLegacy: false,
    migrationHint: null
  }))
}));

jest.mock('../../../lib/protection/resolve', () => {
  const actual = jest.requireActual('../../../lib/protection/resolve');
  return {
    ...actual,
    listProtectionManifestPaths: jest.fn()
  };
});

const { getProtectionRoot } = require('../../../lib/protection/paths');
const { listProtectionManifestPaths } = require('../../../lib/protection/resolve');
const { validateProtection, uploadProtection } = require('../../../lib/api/protection.api');
const { resolveProtectionDataplaneContext } = require('../../../lib/protection/auth-context');
const { runUploadProtectionBatch } = require('../../../lib/protection/upload-batch');
const { preflightDatasourceReady } = require('../../../lib/protection/preflight-datasource-ready');
const { writeHubspotCompaniesManifest } = require('../protection/protection-test-fixtures');

describe('upload .protection batch', () => {
  let tmpRoot;
  let protectionDir;
  let manifestPaths;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prot-batch-'));
    protectionDir = path.join(tmpRoot, 'prot');
    getProtectionRoot.mockReturnValue(protectionDir);

    const companiesPath = writeHubspotCompaniesManifest(protectionDir, 'aaa-hubspot-companies.yaml');
    const base = yaml.load(fs.readFileSync(companiesPath, 'utf8'));
    const dealsManifest = {
      ...base,
      metadata: { ...base.metadata, key: 'hubspot-deals-prot' },
      spec: { ...base.spec, datasourceKey: 'hubspot-deals' }
    };
    const dealsPath = path.join(protectionDir, 'zzz-hubspot-deals.yaml');
    fs.writeFileSync(dealsPath, yaml.dump(dealsManifest), 'utf8');

    manifestPaths = [companiesPath, dealsPath].sort((a, b) => a.localeCompare(b));
    listProtectionManifestPaths.mockReturnValue(manifestPaths);

    resolveProtectionDataplaneContext.mockResolvedValue({
      environment: 'dev',
      dataplaneUrl: 'http://dp',
      authConfig: { type: 'bearer', token: 't' }
    });
    preflightDatasourceReady.mockResolvedValue(undefined);
    validateProtection.mockResolvedValue({
      summary: { fail: 0, warn: 0, pass: 1 },
      results: [{ status: 'PASS', taskId: 't1' }]
    });
    uploadProtection.mockResolvedValue({ deploymentId: 'd1', revision: 1 });
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
      } catch {
        /* best-effort temp cleanup */
      }
    }
  });

  it('uploads manifests in lexical order', async() => {
    const batch = await runUploadProtectionBatch({});

    expect(batch.results).toHaveLength(2);
    expect(batch.ok).toBe(true);
    expect(uploadProtection).toHaveBeenCalledTimes(2);
    expect(uploadProtection.mock.calls[0][2].spec.datasourceKey).toBe('hubspot-companies');
    expect(uploadProtection.mock.calls[1][2].spec.datasourceKey).toBe('hubspot-deals');
    expect(listProtectionManifestPaths).toHaveBeenCalledWith(protectionDir);
  });

  it('dry-run skips upload', async() => {
    listProtectionManifestPaths.mockReturnValue([manifestPaths[0]]);

    const batch = await runUploadProtectionBatch({ dryRun: true });

    expect(batch.results).toHaveLength(1);
    expect(batch.ok).toBe(true);
    expect(batch.results[0].dryRun).toBe(true);
    expect(uploadProtection).not.toHaveBeenCalled();
  });
});
