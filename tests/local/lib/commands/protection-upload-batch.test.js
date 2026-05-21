/**
 * Local-only: temp `.protection` batch workspace + manifest files on disk; flaky when `fs` is mocked on the default worker.
 *
 * @fileoverview upload .protection batch
 */

'use strict';

jest.mock('../../../../lib/protection/auth-context', () => ({
  resolveProtectionDataplaneContext: jest.fn()
}));

jest.mock('../../../../lib/protection/preflight-datasource-ready', () => ({
  preflightDatasourceReady: jest.fn()
}));

jest.mock('../../../../lib/api/protection.api', () => ({
  validateProtection: jest.fn(),
  uploadProtection: jest.fn()
}));

jest.mock('../../../../lib/protection/sync-after-upload', () => ({
  syncUniqueDatasourcesAfterUpload: jest.fn().mockResolvedValue([])
}));

const path = require('path');
const yaml = require('js-yaml');
const {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync
} = require('../../../../lib/internal/fs-real-sync');

jest.mock('../../../../lib/protection/paths', () => ({
  getProtectionRoot: jest.fn(),
  describeProtectionRoot: jest.fn(() => ({
    root: '',
    label: 'integration/.protection',
    usingLegacy: false,
    migrationHint: null
  }))
}));

const { getProtectionRoot } = require('../../../../lib/protection/paths');
const protectionResolve = require('../../../../lib/protection/resolve');
const { validateProtection, uploadProtection } = require('../../../../lib/api/protection.api');
const { resolveProtectionDataplaneContext } = require('../../../../lib/protection/auth-context');
const { runUploadProtectionBatch } = require('../../../../lib/protection/upload-batch');
const { preflightDatasourceReady } = require('../../../../lib/protection/preflight-datasource-ready');
const { writeHubspotCompaniesManifest } = require('../../../lib/protection/protection-test-fixtures');

describe('upload .protection batch (local)', () => {
  let tmpRoot;
  let protectionDir;
  let manifestPaths;
  /** @type {jest.SpyInstance} */
  let listManifestPathsSpy;

  beforeEach(() => {
    const root = path.join(__dirname, '../../../../.temp/jest-protection-upload');
    mkdirSync(root, { recursive: true });
    tmpRoot = mkdtempSync(path.join(root, 'run-'));
    protectionDir = path.join(tmpRoot, 'prot');
    mkdirSync(protectionDir, { recursive: true });
    getProtectionRoot.mockReturnValue(protectionDir);

    const companiesPath = writeHubspotCompaniesManifest(protectionDir, 'aaa-hubspot-companies.yaml');
    const base = yaml.load(readFileSync(companiesPath, 'utf8'));
    const dealsManifest = {
      ...base,
      metadata: { ...base.metadata, key: 'hubspot-deals-prot' },
      spec: { ...base.spec, datasourceKey: 'hubspot-deals' }
    };
    const dealsPath = path.join(protectionDir, 'zzz-hubspot-deals.yaml');
    writeFileSync(dealsPath, yaml.dump(dealsManifest), 'utf8');

    manifestPaths = [companiesPath, dealsPath].sort((a, b) => a.localeCompare(b));
    listManifestPathsSpy = jest
      .spyOn(protectionResolve, 'listProtectionManifestPaths')
      .mockReturnValue(manifestPaths);

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
    validateProtection.mockClear();
    uploadProtection.mockClear();
    resolveProtectionDataplaneContext.mockClear();
    preflightDatasourceReady.mockClear();
    if (listManifestPathsSpy) {
      listManifestPathsSpy.mockRestore();
    }
    if (tmpRoot && existsSync(tmpRoot)) {
      try {
        rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
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
    expect(listManifestPathsSpy).toHaveBeenCalledWith(protectionDir);
  });

  it('dry-run skips upload', async() => {
    listManifestPathsSpy.mockReturnValue([manifestPaths[0]]);

    const batch = await runUploadProtectionBatch({ dryRun: true });

    expect(batch.results).toHaveLength(1);
    expect(batch.ok).toBe(true);
    expect(batch.results[0].dryRun).toBe(true);
    expect(uploadProtection).not.toHaveBeenCalled();
  });
});
