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

jest.mock('../../../lib/utils/paths', () => ({
  getAppsMaterializationParent: jest.fn()
}));

const { getAppsMaterializationParent } = require('../../../lib/utils/paths');
const { validateProtection, uploadProtection } = require('../../../lib/api/protection.api');
const { resolveProtectionDataplaneContext } = require('../../../lib/protection/auth-context');
const { runUploadProtectionBatch } = require('../../../lib/protection/upload-batch');
const { preflightDatasourceReady } = require('../../../lib/protection/preflight-datasource-ready');
const { writeHubspotCompaniesManifest } = require('../protection/protection-test-fixtures');

describe('upload .protection batch', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prot-batch-'));
    getAppsMaterializationParent.mockReset();
    getAppsMaterializationParent.mockReturnValue(tmpRoot);
    const dir = path.join(tmpRoot, '.protection');
    writeHubspotCompaniesManifest(dir);
    resolveProtectionDataplaneContext.mockResolvedValue({
      environment: 'dev',
      dataplaneUrl: 'http://dp',
      authConfig: { type: 'bearer', token: 't' }
    });
    preflightDatasourceReady.mockResolvedValue(undefined);
    validateProtection.mockResolvedValue({ summary: { fail: 0, warn: 0 }, results: [] });
    uploadProtection.mockResolvedValue({ deploymentId: 'd1', revision: 1 });
  });

  afterEach(() => {
    validateProtection.mockClear();
    uploadProtection.mockClear();
    resolveProtectionDataplaneContext.mockClear();
    preflightDatasourceReady.mockClear();
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
    expect(batch.ok).toBe(true);
    expect(uploadProtection).toHaveBeenCalledTimes(1);
  });

  it('dry-run skips upload', async() => {
    const batch = await runUploadProtectionBatch({ dryRun: true });
    expect(batch.results[0].dryRun).toBe(true);
    expect(uploadProtection).not.toHaveBeenCalled();
  });
});
