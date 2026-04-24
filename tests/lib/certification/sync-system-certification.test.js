/**
 * @fileoverview Tests for sync-system-certification (dataplane → system file certification).
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn()
}));

jest.mock('../../../lib/commands/repair-internal', () => ({
  discoverIntegrationFiles: jest.fn()
}));

jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn(),
  writeConfigFile: jest.fn()
}));

jest.mock('../../../lib/api/certificates.api', () => ({
  getActiveIntegrationCertificate: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { getIntegrationPath } = require('../../../lib/utils/paths');
const { discoverIntegrationFiles } = require('../../../lib/commands/repair-internal');
const { loadConfigFile, writeConfigFile } = require('../../../lib/utils/config-format');
const { getActiveIntegrationCertificate } = require('../../../lib/api/certificates.api');

const {
  syncSystemCertificationFromDataplane,
  maybeSyncSystemCertificationFromDataplane,
  resolvePrimarySystemFilePath,
  collectActiveArtifacts
} = require('../../../lib/certification/sync-system-certification');

const baseCert = {
  enabled: true,
  publicKey: 'EXISTING-PEM',
  algorithm: 'RS256',
  issuer: 'legacy',
  version: '0.9.0'
};

const artifactWithKey = {
  version: '2.0.0',
  publicKey: 'ARTIFACT-PEM',
  contractHash: `sha256:${'e'.repeat(64)}`,
  licenseLevelIssuer: 'TrustLine',
  issuedBy: 'dataplane'
};

function setupHappyPathFilesystem() {
  getIntegrationPath.mockReturnValue('/integration/hub');
  discoverIntegrationFiles.mockReturnValue({ systemFiles: ['hub-system.json'], datasourceFiles: [] });
  loadConfigFile.mockReturnValue({
    key: 'hub',
    displayName: 'Hub',
    certification: { ...baseCert }
  });
  getActiveIntegrationCertificate.mockResolvedValue({ success: true, data: { ...artifactWithKey } });
}

describe('resolvePrimarySystemFilePath', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('joins integration path and first system file', () => {
    getIntegrationPath.mockReturnValue('/integration/myapp');
    discoverIntegrationFiles.mockReturnValue({ systemFiles: ['myapp-system.json'], datasourceFiles: [] });
    expect(resolvePrimarySystemFilePath('myapp')).toEqual({
      systemFilePath: '/integration/myapp/myapp-system.json'
    });
    expect(discoverIntegrationFiles).toHaveBeenCalledWith('/integration/myapp');
  });

  it('returns null when no system files', () => {
    getIntegrationPath.mockReturnValue('/integration/x');
    discoverIntegrationFiles.mockReturnValue({ systemFiles: [], datasourceFiles: [] });
    expect(resolvePrimarySystemFilePath('x')).toBeNull();
  });
});

describe('collectActiveArtifacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips API rows with success false', async() => {
    getActiveIntegrationCertificate
      .mockResolvedValueOnce({ success: false, error: 'forbidden' })
      .mockResolvedValueOnce({ success: true, data: { version: '1', publicKey: 'k', licenseLevelIssuer: 'L' } });
    const arts = await collectActiveArtifacts({
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      systemKey: 'hub',
      datasourceKeys: ['ds1', 'ds2']
    });
    expect(arts).toHaveLength(1);
    expect(arts[0].publicKey).toBe('k');
    expect(getActiveIntegrationCertificate).toHaveBeenCalledTimes(2);
  });

  it('continues when one datasource request throws', async() => {
    getActiveIntegrationCertificate
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ success: true, data: { version: '1', publicKey: 'ok', licenseLevelIssuer: 'L' } });
    const arts = await collectActiveArtifacts({
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      systemKey: 'hub',
      datasourceKeys: ['bad', 'good']
    });
    expect(arts).toHaveLength(1);
    expect(arts[0].publicKey).toBe('ok');
  });
});

describe('syncSystemCertificationFromDataplane', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    writeConfigFile.mockReset();
    loadConfigFile.mockReset();
    getActiveIntegrationCertificate.mockReset();
  });

  it('writes merged certification when active certificate is available', async() => {
    setupHappyPathFilesystem();
    const r = await syncSystemCertificationFromDataplane({
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: ['users']
    });
    expect(r.written).toBe(true);
    expect(writeConfigFile).toHaveBeenCalledTimes(1);
    const [filePath, body] = writeConfigFile.mock.calls[0];
    expect(filePath).toBe('/integration/hub/hub-system.json');
    expect(body.certification).toEqual({
      enabled: true,
      publicKey: 'ARTIFACT-PEM',
      algorithm: 'RS256',
      issuer: 'TrustLine',
      version: '2.0.0',
      status: 'passed',
      contractHash: `sha256:${'e'.repeat(64)}`
    });
    expect(body.key).toBe('hub');
  });

  it('does not write certification when artifact has no PEM publicKey to merge', async() => {
    getIntegrationPath.mockReturnValue('/integration/hub');
    discoverIntegrationFiles.mockReturnValue({ systemFiles: ['hub-system.json'], datasourceFiles: [] });
    loadConfigFile.mockReturnValue({
      key: 'hub',
      displayName: 'Hub',
      certification: {}
    });
    getActiveIntegrationCertificate.mockResolvedValue({
      success: true,
      data: {
        certificateId: 'AIC-20260101-xyz',
        algorithm: 'HS256',
        version: '1.0.0',
        licenseLevelIssuer: 'L',
        issuedBy: 'dp'
      }
    });
    const r = await syncSystemCertificationFromDataplane({
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: ['users']
    });
    expect(r).toEqual({
      written: false,
      reason: 'incomplete_certification',
      detail: 'no_public_key'
    });
    expect(writeConfigFile).not.toHaveBeenCalled();
  });

  it('returns no_system_file when discovery is empty', async() => {
    getIntegrationPath.mockReturnValue('/integration/x');
    discoverIntegrationFiles.mockReturnValue({ systemFiles: [], datasourceFiles: [] });
    const r = await syncSystemCertificationFromDataplane({
      systemKey: 'x',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: ['d']
    });
    expect(r).toEqual({ written: false, reason: 'no_system_file' });
    expect(loadConfigFile).not.toHaveBeenCalled();
  });

  it('returns no_auth without bearer token', async() => {
    setupHappyPathFilesystem();
    const r = await syncSystemCertificationFromDataplane({
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: {},
      datasourceKeys: ['users']
    });
    expect(r).toEqual({ written: false, reason: 'no_auth' });
    expect(getActiveIntegrationCertificate).not.toHaveBeenCalled();
  });

  it('accepts apiKey without token and fetches active certificates', async() => {
    setupHappyPathFilesystem();
    const r = await syncSystemCertificationFromDataplane({
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { apiKey: 'dp-api-key' },
      datasourceKeys: ['users']
    });
    expect(r.written).toBe(true);
    expect(getActiveIntegrationCertificate).toHaveBeenCalledWith(
      'http://dp.test',
      { apiKey: 'dp-api-key' },
      'hub',
      'users'
    );
  });

  it('returns invalid_system when loadConfigFile throws', async() => {
    getIntegrationPath.mockReturnValue('/integration/hub');
    discoverIntegrationFiles.mockReturnValue({ systemFiles: ['hub-system.json'], datasourceFiles: [] });
    loadConfigFile.mockImplementation(() => {
      throw new Error('bad yaml');
    });
    const r = await syncSystemCertificationFromDataplane({
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: ['users']
    });
    expect(r).toEqual({ written: false, reason: 'invalid_system' });
    expect(logger.log).toHaveBeenCalled();
  });

  it('returns incomplete_certification when artifact cannot satisfy schema', async() => {
    getIntegrationPath.mockReturnValue('/integration/hub');
    discoverIntegrationFiles.mockReturnValue({ systemFiles: ['hub-system.json'], datasourceFiles: [] });
    loadConfigFile.mockReturnValue({ key: 'hub', certification: {} });
    getActiveIntegrationCertificate.mockResolvedValue({
      success: true,
      data: { version: '1.0' }
    });
    const r = await syncSystemCertificationFromDataplane({
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: ['users']
    });
    expect(r).toEqual({ written: false, reason: 'incomplete_certification', detail: 'no_public_key' });
    expect(writeConfigFile).not.toHaveBeenCalled();
  });

  it('returns incomplete_certification with no_active when dataplane returns no artifacts', async() => {
    getIntegrationPath.mockReturnValue('/integration/hub');
    discoverIntegrationFiles.mockReturnValue({ systemFiles: ['hub-system.json'], datasourceFiles: [] });
    loadConfigFile.mockReturnValue({ key: 'hub', certification: {} });
    getActiveIntegrationCertificate.mockResolvedValue({ success: false, status: 404 });
    const r = await syncSystemCertificationFromDataplane({
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: ['users']
    });
    expect(r).toEqual({ written: false, reason: 'incomplete_certification', detail: 'no_active' });
    expect(writeConfigFile).not.toHaveBeenCalled();
  });

  it('returns write_error when writeConfigFile throws', async() => {
    setupHappyPathFilesystem();
    writeConfigFile.mockImplementation(() => {
      throw new Error('disk full');
    });
    const r = await syncSystemCertificationFromDataplane({
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: ['users']
    });
    expect(r).toEqual({ written: false, reason: 'write_error' });
    expect(logger.log).toHaveBeenCalled();
  });
});

describe('maybeSyncSystemCertificationFromDataplane', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    writeConfigFile.mockReset();
    loadConfigFile.mockReset();
    getActiveIntegrationCertificate.mockReset();
  });

  it('does not read or write when noCertSync is true', async() => {
    getIntegrationPath.mockReturnValue('/integration/hub');
    discoverIntegrationFiles.mockReturnValue({ systemFiles: ['hub-system.json'], datasourceFiles: [] });
    await maybeSyncSystemCertificationFromDataplane({
      noCertSync: true,
      label: 'upload',
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: ['users']
    });
    expect(loadConfigFile).not.toHaveBeenCalled();
    expect(writeConfigFile).not.toHaveBeenCalled();
  });

  it('logs success line when sync writes', async() => {
    setupHappyPathFilesystem();
    await maybeSyncSystemCertificationFromDataplane({
      noCertSync: false,
      label: 'deploy',
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: ['users']
    });
    const combined = logger.log.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(combined).toMatch(/Updated certification block from dataplane \(deploy\)/);
  });

  it('swallows unexpected errors from sync path', async() => {
    discoverIntegrationFiles.mockImplementation(() => {
      throw new Error('unexpected');
    });
    getIntegrationPath.mockReturnValue('/integration/hub');
    await maybeSyncSystemCertificationFromDataplane({
      noCertSync: false,
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: []
    });
    const combined = logger.log.mock.calls.flat().join(' ');
    expect(combined).toContain('unexpected');
  });

  it('logs when sync completes without write (reason from dataplane)', async() => {
    getIntegrationPath.mockReturnValue('/integration/hub');
    discoverIntegrationFiles.mockReturnValue({ systemFiles: ['hub-system.json'], datasourceFiles: [] });
    loadConfigFile.mockReturnValue({ key: 'hub' });
    getActiveIntegrationCertificate.mockResolvedValue({ success: false });
    await maybeSyncSystemCertificationFromDataplane({
      noCertSync: false,
      label: 'upload',
      systemKey: 'hub',
      dataplaneUrl: 'http://dp.test',
      authConfig: { token: 't' },
      datasourceKeys: ['users']
    });
    const combined = logger.log.mock.calls.flat().join(' ');
    expect(combined).toMatch(/Certification block not updated|Could not build certification/);
  });
});
