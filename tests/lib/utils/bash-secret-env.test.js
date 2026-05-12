/**
 * @fileoverview Tests for bash-secret-env (BASH_* → child env names)
 */

jest.mock('../../../lib/core/secrets-load', () => ({
  loadSecrets: jest.fn()
}));

const secretsLoad = require('../../../lib/core/secrets-load');
const {
  collectBashPrefixedEnv,
  getBashPrefixedProcessEnvOverlay
} = require('../../../lib/utils/bash-secret-env');

describe('bash-secret-env', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('collectBashPrefixedEnv', () => {
    it('maps BASH_NPM_TOKEN to NPM_TOKEN', () => {
      expect(collectBashPrefixedEnv({ BASH_NPM_TOKEN: 'tok' })).toEqual({ NPM_TOKEN: 'tok' });
    });

    it('skips empty values and invalid suffixes', () => {
      expect(
        collectBashPrefixedEnv({
          BASH_NPM_TOKEN: '  ',
          'BASH_123BAD': 'x',
          BASH_: 'y',
          plain: 'z'
        })
      ).toEqual({});
    });

    it('trims string values', () => {
      expect(collectBashPrefixedEnv({ BASH_PYPI_TOKEN: '  abc  ' })).toEqual({ PYPI_TOKEN: 'abc' });
    });
  });

  describe('getBashPrefixedProcessEnvOverlay', () => {
    it('delegates to loadSecrets', async() => {
      secretsLoad.loadSecrets.mockResolvedValue({ BASH_FOO: 'bar' });
      const r = await getBashPrefixedProcessEnvOverlay('/path', 'myapp');
      expect(r).toEqual({ FOO: 'bar' });
      expect(secretsLoad.loadSecrets).toHaveBeenCalledWith('/path', 'myapp');
    });
  });
});
