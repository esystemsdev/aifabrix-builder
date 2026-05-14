/**
 * @fileoverview Ensures urls.local.yaml registry refresh runs even without url:// in resolved template
 */

'use strict';

jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn().mockResolvedValue({}),
  getRemoteServer: jest.fn().mockResolvedValue(null),
  getDeveloperId: jest.fn().mockResolvedValue(0),
  getTlsEnabled: jest.fn().mockResolvedValue(false)
}));

jest.mock('../../../lib/utils/paths', () => ({
  ...jest.requireActual('../../../lib/utils/paths'),
  getProjectRoot: jest.fn().mockReturnValue('/tmp/fake-proj-root-for-registry-refresh')
}));

jest.mock('../../../lib/utils/app-scoped-config', () => ({
  readAppEnvironmentScopedFlagForAppPath: jest.fn().mockReturnValue(false)
}));

jest.mock('../../../lib/utils/url-declarative-vdir-inactive-env', () => ({
  rewriteInactiveDeclarativeVdirPublicContent: jest.fn((s) => s)
}));

const urlsReg = require('../../../lib/utils/urls-local-registry');
jest.spyOn(urlsReg, 'refreshUrlsLocalRegistryFromBuilder').mockReturnValue({});

const { expandDeclarativeUrlsIfPresent } = require('../../../lib/core/secrets-env-declarative-expand');

describe('expandDeclarativeUrlsIfPresent', () => {
  beforeEach(() => {
    urlsReg.refreshUrlsLocalRegistryFromBuilder.mockClear();
  });

  it('refreshes urls.local registry when application.yaml exists but resolved template has no url://', async() => {
    const out = await expandDeclarativeUrlsIfPresent(
      'PORT=3000\n',
      'miso-controller',
      '/fake/app',
      '/fake/app/application.yaml',
      'docker',
      false
    );
    expect(out).toBe('PORT=3000\n');
    expect(urlsReg.refreshUrlsLocalRegistryFromBuilder).toHaveBeenCalledTimes(1);
    expect(urlsReg.refreshUrlsLocalRegistryFromBuilder).toHaveBeenCalledWith(
      '/tmp/fake-proj-root-for-registry-refresh'
    );
  });

  it('does not refresh in env-only mode', async() => {
    await expandDeclarativeUrlsIfPresent('X=1\n', 'app', '/p', null, 'docker', true);
    expect(urlsReg.refreshUrlsLocalRegistryFromBuilder).not.toHaveBeenCalled();
  });
});
