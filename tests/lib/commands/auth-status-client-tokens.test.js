/**
 * @fileoverview Tests for auth-status-client-tokens.js
 */

'use strict';

jest.mock('../../../lib/core/config', () => {
  const getConfig = jest.fn();
  const getClientToken = jest.fn();
  const normalizeControllerUrl = jest.fn(url => (url || '').replace(/\/+$/, ''));
  return { getConfig, getClientToken, normalizeControllerUrl };
});
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshClientToken: jest.fn(),
  loadClientCredentials: jest.fn(),
  refreshClientToken: jest.fn(),
  isTokenExpired: jest.fn()
}));

const config = require('../../../lib/core/config');
const tokenManager = require('../../../lib/utils/token-manager');
const {
  refreshExpiredClientTokensWherePossible,
  listClientTokenRows,
  tryResolveClientTokenAuth
} = require('../../../lib/commands/auth-status-client-tokens');

describe('auth-status-client-tokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getConfig.mockResolvedValue({
      environments: {
        dev: {
          clients: {
            dataplane: {
              controller: 'http://localhost:3600',
              token: 't1',
              expiresAt: '2099-01-01T00:00:00.000Z'
            },
            'hubspot-e2e': {
              controller: 'http://localhost:3600',
              token: 't2',
              expiresAt: '2020-01-01T00:00:00.000Z'
            }
          }
        }
      }
    });
  });

  it('refreshExpiredClientTokensWherePossible refreshes expired apps with credentials', async() => {
    tokenManager.isTokenExpired.mockImplementation(exp => exp.startsWith('2020'));
    tokenManager.loadClientCredentials.mockResolvedValue({ clientId: 'id', clientSecret: 'sec' });
    tokenManager.refreshClientToken.mockResolvedValue({ token: 'new', expiresAt: '2099-01-01T00:00:00.000Z' });

    const count = await refreshExpiredClientTokensWherePossible('dev', 'http://localhost:3600');

    expect(count).toBe(1);
    expect(tokenManager.refreshClientToken).toHaveBeenCalledWith(
      'dev',
      'hubspot-e2e',
      'http://localhost:3600'
    );
    expect(tokenManager.refreshClientToken).not.toHaveBeenCalledWith('dev', 'dataplane', expect.any(String));
  });

  it('listClientTokenRows marks expired apps without credentials', async() => {
    tokenManager.isTokenExpired.mockImplementation(exp => exp.startsWith('2020'));
    tokenManager.loadClientCredentials.mockImplementation(async app => {
      if (app === 'dataplane') {
        return { clientId: 'id', clientSecret: 'sec' };
      }
      return null;
    });

    const rows = await listClientTokenRows('dev', 'http://localhost:3600');

    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.appName === 'hubspot-e2e').state).toContain('no client id/secret');
    expect(rows.find(r => r.appName === 'hubspot-e2e').logoutCmd).toBe(
      'aifabrix logout -e dev -a hubspot-e2e'
    );
  });

  it('tryResolveClientTokenAuth uses getOrRefreshClientToken and validates', async() => {
    tokenManager.getOrRefreshClientToken.mockResolvedValue({
      token: 'fresh-token',
      controller: 'http://localhost:3600'
    });
    config.getClientToken.mockResolvedValue({
      controller: 'http://localhost:3600',
      token: 'fresh-token',
      expiresAt: '2099-01-01T00:00:00.000Z'
    });
    const validateFn = jest.fn().mockResolvedValue({
      type: 'Client Token',
      authenticated: true,
      appName: 'dataplane'
    });

    const result = await tryResolveClientTokenAuth(
      'http://localhost:3600',
      'dev',
      validateFn
    );

    expect(tokenManager.getOrRefreshClientToken).toHaveBeenCalledWith(
      'dev',
      'dataplane',
      'http://localhost:3600'
    );
    expect(result.authenticated).toBe(true);
  });
});
