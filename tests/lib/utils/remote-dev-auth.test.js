/**
 * Tests for remote-dev-auth shared-secrets endpoint resolution (tilde vs getSecretsPath alignment).
 * @fileoverview Ensures resolveSharedSecretsEndpoint matches getSecretsPath expansion so secret list and loadSecrets agree.
 */

jest.mock('../../../lib/core/config', () => ({
  getRemoteServer: jest.fn(),
  getDeveloperId: jest.fn()
}));

jest.mock('../../../lib/utils/dev-cert-helper', () => ({
  getCertDir: jest.fn(),
  readClientCertPem: jest.fn(),
  readServerCaPem: jest.fn()
}));

jest.mock('../../../lib/utils/paths', () => ({
  getConfigDirForPaths: jest.fn(() => '/cfg'),
  getAifabrixHome: jest.fn(),
  getAifabrixWork: jest.fn()
}));

const os = require('os');
const path = require('path');
const remoteDevAuth = require('../../../lib/utils/remote-dev-auth');
const config = require('../../../lib/core/config');
const devCertHelper = require('../../../lib/utils/dev-cert-helper');
const paths = require('../../../lib/utils/paths');

describe('remote-dev-auth resolveSharedSecretsEndpoint', () => {
  const mockHome = '/home/devuser';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(os, 'homedir').mockReturnValue(mockHome);
    paths.getAifabrixHome.mockReturnValue(mockHome);
    paths.getAifabrixWork.mockReturnValue(null);
    config.getRemoteServer.mockResolvedValue(null);
    config.getDeveloperId.mockResolvedValue('2');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns trimmed https URL unchanged', async() => {
    const u = 'https://builder02.local/api/dev/secrets/';
    await expect(remoteDevAuth.resolveSharedSecretsEndpoint(u)).resolves.toBe('https://builder02.local/api/dev/secrets');
  });

  it('when remote auth absent, expands tilde like getSecretsPath', async() => {
    config.getRemoteServer.mockResolvedValue(null);
    const raw = '~/workspace/shared.yaml';
    await expect(remoteDevAuth.resolveSharedSecretsEndpoint(raw)).resolves.toBe(path.join(mockHome, 'workspace/shared.yaml'));
  });

  it('when remote auth absent, leaves absolute paths unchanged', async() => {
    config.getRemoteServer.mockResolvedValue(null);
    await expect(remoteDevAuth.resolveSharedSecretsEndpoint('/opt/foo/secrets.yaml')).resolves.toBe('/opt/foo/secrets.yaml');
  });

  it('when auth present, path under home stays local (expanded) — same decision as getSecretsPath + normalize', async() => {
    config.getRemoteServer.mockResolvedValue('https://builder02.local');
    devCertHelper.readClientCertPem.mockReturnValue('-----BEGIN CERT-----');
    devCertHelper.readServerCaPem.mockReturnValue(null);
    const underHome = path.join(mockHome, '.aifabrix', 'secrets.local.yaml');
    const tildePath = '~/.aifabrix/secrets.local.yaml';
    await expect(remoteDevAuth.resolveSharedSecretsEndpoint(tildePath)).resolves.toBe(underHome);
  });

  it('when auth present, server-side absolute path uses Builder secrets API', async() => {
    config.getRemoteServer.mockResolvedValue('https://builder02.local');
    devCertHelper.readClientCertPem.mockReturnValue('-----BEGIN CERT-----');
    devCertHelper.readServerCaPem.mockReturnValue(null);
    const serverPath = '/opt/aifabrix/builder/secrets.local.yaml';
    await expect(remoteDevAuth.resolveSharedSecretsEndpoint(serverPath)).resolves.toBe(
      'https://builder02.local/api/dev/secrets'
    );
  });
});
