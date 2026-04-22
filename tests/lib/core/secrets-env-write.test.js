/**
 * @fileoverview Tests for secrets-env-write registry token injection
 */

'use strict';

jest.mock('../../../lib/core/secrets', () => ({
  generateEnvContent: jest.fn(),
  loadSecrets: jest.fn()
}));

const secrets = require('../../../lib/core/secrets');
const { resolveAndGetEnvMap } = require('../../../lib/core/secrets-env-write');

describe('secrets-env-write resolveAndGetEnvMap', () => {
  const originalNpm = process.env.NPM_TOKEN;
  const originalPypi = process.env.PYPI_TOKEN;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalNpm === undefined) delete process.env.NPM_TOKEN;
    else process.env.NPM_TOKEN = originalNpm;
    if (originalPypi === undefined) delete process.env.PYPI_TOKEN;
    else process.env.PYPI_TOKEN = originalPypi;
  });

  it('injects NPM_TOKEN from process.env when template has kv:// only and secrets empty', async() => {
    secrets.generateEnvContent.mockResolvedValue('NPM_TOKEN=kv://BASH_NPM_TOKEN\n');
    secrets.loadSecrets.mockResolvedValue({});
    process.env.NPM_TOKEN = 'token-from-shell';

    const map = await resolveAndGetEnvMap('miso-controller', { environment: 'docker' });

    expect(map.NPM_TOKEN).toBe('token-from-shell');
  });

  it('prefers secrets file over process.env for NPM_TOKEN', async() => {
    secrets.generateEnvContent.mockResolvedValue('NPM_TOKEN=kv://BASH_NPM_TOKEN\n');
    secrets.loadSecrets.mockResolvedValue({ NPM_TOKEN: 'from-secrets' });
    process.env.NPM_TOKEN = 'from-shell';

    const map = await resolveAndGetEnvMap('miso-controller', { environment: 'docker' });

    expect(map.NPM_TOKEN).toBe('from-secrets');
  });

  it('does not override resolved NPM_TOKEN in content with process.env', async() => {
    secrets.generateEnvContent.mockResolvedValue('NPM_TOKEN=already-set\n');
    secrets.loadSecrets.mockResolvedValue({});
    process.env.NPM_TOKEN = 'from-shell';

    const map = await resolveAndGetEnvMap('miso-controller', { environment: 'docker' });

    expect(map.NPM_TOKEN).toBe('already-set');
  });

  it('injects PYPI_TOKEN from process.env when missing', async() => {
    secrets.generateEnvContent.mockResolvedValue('X=1\n');
    secrets.loadSecrets.mockResolvedValue({});
    process.env.PYPI_TOKEN = 'pypi-secret';

    const map = await resolveAndGetEnvMap('some-app', { environment: 'docker' });

    expect(map.PYPI_TOKEN).toBe('pypi-secret');
  });
});
