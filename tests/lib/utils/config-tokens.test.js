/**
 * Tests for lib/utils/config-tokens.js
 *
 * @fileoverview Unit tests for token management functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { createTokenManagementFunctions } = require('../../../lib/utils/config-tokens');

describe('config-tokens', () => {
  let getConfigFn;
  let saveConfigFn;
  let getSecretsEncryptionKeyFn;
  let encryptTokenValueFn;
  let decryptTokenValueFn;
  let isTokenEncryptedFn;
  let tokenFunctions;

  beforeEach(() => {
    getConfigFn = jest.fn();
    saveConfigFn = jest.fn().mockResolvedValue();
    getSecretsEncryptionKeyFn = jest.fn().mockResolvedValue(null);
    encryptTokenValueFn = jest.fn((val) => Promise.resolve(`encrypted:${val}`));
    decryptTokenValueFn = jest.fn((val) => Promise.resolve(val.replace('encrypted:', '')));
    isTokenEncryptedFn = jest.fn((val) => val && val.startsWith('encrypted:'));

    tokenFunctions = createTokenManagementFunctions(
      getConfigFn,
      saveConfigFn,
      getSecretsEncryptionKeyFn,
      encryptTokenValueFn,
      decryptTokenValueFn,
      isTokenEncryptedFn
    );
  });

  describe('normalizeControllerUrl', () => {
    // Test normalizeControllerUrl indirectly through token functions
    // Since it's not exported, we test it via getDeviceToken and saveDeviceToken

    it('should normalize URL without protocol', async() => {
      getConfigFn.mockResolvedValue({ device: {} });
      await tokenFunctions.saveDeviceToken('example.com', 'token', 'refresh', '2024-01-01');
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.device['http://example.com']).toBeDefined();
    });

    it('should normalize URL with trailing slashes', async() => {
      getConfigFn.mockResolvedValue({ device: {} });
      await tokenFunctions.saveDeviceToken('https://example.com/', 'token', 'refresh', '2024-01-01');
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.device['https://example.com']).toBeDefined();
    });

    it('should handle null/undefined URL', async() => {
      getConfigFn.mockResolvedValue({ device: {} });
      const result = await tokenFunctions.getDeviceToken(null);
      expect(result).toBeNull();
    });

    it('should handle non-string URL', async() => {
      getConfigFn.mockResolvedValue({ device: {} });
      const result = await tokenFunctions.getDeviceToken(123);
      expect(result).toBeNull();
    });
  });

  describe('getDeviceToken', () => {
    it('should return null when controllerUrl is not provided', async() => {
      getConfigFn.mockResolvedValue({ device: {} });
      const result = await tokenFunctions.getDeviceToken(null);
      expect(result).toBeNull();
    });

    it('should return null when no device tokens exist', async() => {
      getConfigFn.mockResolvedValue({});
      const result = await tokenFunctions.getDeviceToken('https://example.com');
      expect(result).toBeNull();
    });

    it('should return device token for exact match', async() => {
      const deviceToken = {
        token: 'encrypted:token123',
        refreshToken: 'encrypted:refresh123',
        expiresAt: '2024-01-01'
      };
      getConfigFn.mockResolvedValue({
        device: {
          'https://example.com': deviceToken
        }
      });
      decryptTokenValueFn.mockImplementation((val) => Promise.resolve(val.replace('encrypted:', '')));

      const result = await tokenFunctions.getDeviceToken('https://example.com');
      expect(result).toEqual({
        controller: 'https://example.com',
        token: 'token123',
        refreshToken: 'refresh123',
        expiresAt: '2024-01-01'
      });
    });

    it('should normalize URL and find matching token', async() => {
      const deviceToken = {
        token: 'encrypted:token123',
        refreshToken: 'encrypted:refresh123',
        expiresAt: '2024-01-01'
      };
      const config = {
        device: {
          'example.com': deviceToken
        }
      };
      getConfigFn.mockResolvedValue(config);
      decryptTokenValueFn.mockImplementation((val) => Promise.resolve(val.replace('encrypted:', '')));

      const result = await tokenFunctions.getDeviceToken('http://example.com');
      expect(result).toEqual({
        controller: 'http://example.com',
        token: 'token123',
        refreshToken: 'refresh123',
        expiresAt: '2024-01-01'
      });
      // Should migrate to normalized URL
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.device['http://example.com']).toBeDefined();
      expect(savedConfig.device['example.com']).toBeUndefined();
    });

    it('should migrate plain text tokens to encrypted', async() => {
      const deviceToken = {
        token: 'plain-token',
        refreshToken: 'plain-refresh',
        expiresAt: '2024-01-01'
      };
      const config = {
        device: {
          'https://example.com': deviceToken
        }
      };
      getConfigFn.mockResolvedValue(config);
      getSecretsEncryptionKeyFn.mockResolvedValue('encryption-key');
      isTokenEncryptedFn.mockImplementation((val) => val && val.startsWith('encrypted:'));
      decryptTokenValueFn.mockImplementation((val) => Promise.resolve(val.replace('encrypted:', '')));

      const result = await tokenFunctions.getDeviceToken('https://example.com');
      expect(encryptTokenValueFn).toHaveBeenCalledWith('plain-token');
      expect(encryptTokenValueFn).toHaveBeenCalledWith('plain-refresh');
      expect(saveConfigFn).toHaveBeenCalled();
      expect(result.token).toBe('plain-token');
      expect(result.refreshToken).toBe('plain-refresh');
    });
  });

  describe('saveDeviceToken', () => {
    it('should save device token with normalized URL', async() => {
      getConfigFn.mockResolvedValue({});
      await tokenFunctions.saveDeviceToken('https://example.com/', 'token123', 'refresh123', '2024-01-01');

      expect(encryptTokenValueFn).toHaveBeenCalledWith('token123');
      expect(encryptTokenValueFn).toHaveBeenCalledWith('refresh123');
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.device['https://example.com']).toEqual({
        token: 'encrypted:token123',
        refreshToken: 'encrypted:refresh123',
        expiresAt: '2024-01-01'
      });
    });

    it('should remove existing entry with different URL format', async() => {
      const config = {
        device: {
          'example.com': {
            token: 'old-token',
            refreshToken: 'old-refresh',
            expiresAt: '2023-01-01'
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      await tokenFunctions.saveDeviceToken('http://example.com', 'new-token', 'new-refresh', '2024-01-01');

      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.device['example.com']).toBeUndefined();
      expect(savedConfig.device['http://example.com']).toBeDefined();
    });

    it('should handle null refreshToken', async() => {
      getConfigFn.mockResolvedValue({});
      await tokenFunctions.saveDeviceToken('https://example.com', 'token123', null, '2024-01-01');

      expect(encryptTokenValueFn).toHaveBeenCalledWith('token123');
      expect(encryptTokenValueFn).not.toHaveBeenCalledWith(null);
      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.device['https://example.com'].refreshToken).toBeNull();
    });
  });

  describe('getClientToken', () => {
    it('should return null when environment does not exist', async() => {
      getConfigFn.mockResolvedValue({ environments: {} });
      const result = await tokenFunctions.getClientToken('dev', 'app1');
      expect(result).toBeNull();
    });

    it('should return null when app does not exist', async() => {
      getConfigFn.mockResolvedValue({
        environments: {
          dev: { clients: {} }
        }
      });
      const result = await tokenFunctions.getClientToken('dev', 'app1');
      expect(result).toBeNull();
    });

    it('should return client token', async() => {
      const clientToken = {
        controller: 'https://example.com',
        token: 'encrypted:token123',
        expiresAt: '2024-01-01'
      };
      getConfigFn.mockResolvedValue({
        environments: {
          dev: {
            clients: {
              app1: clientToken
            }
          }
        }
      });
      decryptTokenValueFn.mockImplementation((val) => Promise.resolve(val.replace('encrypted:', '')));

      const result = await tokenFunctions.getClientToken('dev', 'app1');
      expect(result).toEqual({
        controller: 'https://example.com',
        token: 'token123',
        expiresAt: '2024-01-01'
      });
    });

    it('should migrate plain text token to encrypted', async() => {
      const clientToken = {
        controller: 'https://example.com',
        token: 'plain-token',
        expiresAt: '2024-01-01'
      };
      const config = {
        environments: {
          dev: {
            clients: {
              app1: clientToken
            }
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      getSecretsEncryptionKeyFn.mockResolvedValue('encryption-key');
      isTokenEncryptedFn.mockImplementation((val) => val && val.startsWith('encrypted:'));
      decryptTokenValueFn.mockImplementation((val) => Promise.resolve(val.replace('encrypted:', '')));

      const result = await tokenFunctions.getClientToken('dev', 'app1');
      expect(encryptTokenValueFn).toHaveBeenCalledWith('plain-token');
      expect(saveConfigFn).toHaveBeenCalled();
      expect(result.token).toBe('plain-token');
    });
  });

  describe('saveClientToken', () => {
    it('should save client token', async() => {
      getConfigFn.mockResolvedValue({});
      await tokenFunctions.saveClientToken('dev', 'app1', 'https://example.com', 'token123', '2024-01-01');

      expect(encryptTokenValueFn).toHaveBeenCalledWith('token123');
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.environments.dev.clients.app1).toEqual({
        controller: 'https://example.com',
        token: 'encrypted:token123',
        expiresAt: '2024-01-01'
      });
    });

    it('should create environment structure if it does not exist', async() => {
      getConfigFn.mockResolvedValue({});
      await tokenFunctions.saveClientToken('dev', 'app1', 'https://example.com', 'token123', '2024-01-01');

      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.environments.dev).toBeDefined();
      expect(savedConfig.environments.dev.clients).toBeDefined();
      expect(savedConfig.environments.dev.clients.app1).toBeDefined();
    });
  });

  describe('clearDeviceToken', () => {
    it('should return false when no device tokens exist', async() => {
      getConfigFn.mockResolvedValue({});
      const result = await tokenFunctions.clearDeviceToken('https://example.com');
      expect(result).toBe(false);
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should return false when controllerUrl is null', async() => {
      getConfigFn.mockResolvedValue({ device: {} });
      const result = await tokenFunctions.clearDeviceToken(null);
      expect(result).toBe(false);
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should clear device token for exact match', async() => {
      const config = {
        device: {
          'https://example.com': {
            token: 'token123',
            refreshToken: 'refresh123',
            expiresAt: '2024-01-01'
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      const result = await tokenFunctions.clearDeviceToken('https://example.com');

      expect(result).toBe(true);
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.device['https://example.com']).toBeUndefined();
    });

    it('should clear device token by normalizing URL', async() => {
      const config = {
        device: {
          'example.com': {
            token: 'token123',
            refreshToken: 'refresh123',
            expiresAt: '2024-01-01'
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      const result = await tokenFunctions.clearDeviceToken('http://example.com');

      expect(result).toBe(true);
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.device['example.com']).toBeUndefined();
    });
  });

  describe('clearAllDeviceTokens', () => {
    it('should return 0 when no device tokens exist', async() => {
      getConfigFn.mockResolvedValue({});
      const result = await tokenFunctions.clearAllDeviceTokens();
      expect(result).toBe(0);
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should clear all device tokens', async() => {
      const config = {
        device: {
          'https://example.com': { token: 'token1' },
          'https://example2.com': { token: 'token2' }
        }
      };
      getConfigFn.mockResolvedValue(config);
      const result = await tokenFunctions.clearAllDeviceTokens();

      expect(result).toBe(2);
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.device).toEqual({});
    });
  });

  describe('clearClientToken', () => {
    it('should return false when environment does not exist', async() => {
      getConfigFn.mockResolvedValue({ environments: {} });
      const result = await tokenFunctions.clearClientToken('dev', 'app1');
      expect(result).toBe(false);
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should return false when app does not exist', async() => {
      getConfigFn.mockResolvedValue({
        environments: {
          dev: { clients: {} }
        }
      });
      const result = await tokenFunctions.clearClientToken('dev', 'app1');
      expect(result).toBe(false);
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should clear client token', async() => {
      const config = {
        environments: {
          dev: {
            clients: {
              app1: { token: 'token1' },
              app2: { token: 'token2' }
            }
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      const result = await tokenFunctions.clearClientToken('dev', 'app1');

      expect(result).toBe(true);
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.environments.dev.clients.app1).toBeUndefined();
      expect(savedConfig.environments.dev.clients.app2).toBeDefined();
    });

    it('should clean up empty clients object', async() => {
      const config = {
        environments: {
          dev: {
            clients: {
              app1: { token: 'token1' }
            }
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      await tokenFunctions.clearClientToken('dev', 'app1');

      const savedConfig = saveConfigFn.mock.calls[0][0];
      // When clients object is cleaned up, the environment is also cleaned up if empty
      expect(savedConfig.environments.dev).toBeUndefined();
    });

    it('should clean up empty environment object', async() => {
      const config = {
        environments: {
          dev: {
            clients: {
              app1: { token: 'token1' }
            }
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      await tokenFunctions.clearClientToken('dev', 'app1');

      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.environments.dev).toBeUndefined();
    });
  });

  describe('clearClientTokensForEnvironment', () => {
    it('should return 0 when environment does not exist', async() => {
      getConfigFn.mockResolvedValue({ environments: {} });
      const result = await tokenFunctions.clearClientTokensForEnvironment('dev');
      expect(result).toBe(0);
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should return 0 when no clients exist', async() => {
      getConfigFn.mockResolvedValue({
        environments: {
          dev: {}
        }
      });
      const result = await tokenFunctions.clearClientTokensForEnvironment('dev');
      expect(result).toBe(0);
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should clear all client tokens for environment', async() => {
      const config = {
        environments: {
          dev: {
            clients: {
              app1: { token: 'token1' },
              app2: { token: 'token2' }
            }
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      const result = await tokenFunctions.clearClientTokensForEnvironment('dev');

      expect(result).toBe(2);
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      // When all clients are cleared, the environment is also cleaned up if empty
      expect(savedConfig.environments.dev).toBeUndefined();
    });

    it('should clean up empty environment object', async() => {
      const config = {
        environments: {
          dev: {
            clients: {
              app1: { token: 'token1' }
            }
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      await tokenFunctions.clearClientTokensForEnvironment('dev');

      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.environments.dev).toBeUndefined();
    });
  });

  describe('clearAllClientTokens', () => {
    it('should return 0 when no environments exist', async() => {
      getConfigFn.mockResolvedValue({});
      const result = await tokenFunctions.clearAllClientTokens();
      expect(result).toBe(0);
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should clear all client tokens across all environments', async() => {
      const config = {
        environments: {
          dev: {
            clients: {
              app1: { token: 'token1' },
              app2: { token: 'token2' }
            }
          },
          tst: {
            clients: {
              app1: { token: 'token3' }
            }
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      const result = await tokenFunctions.clearAllClientTokens();

      expect(result).toBe(3);
      expect(saveConfigFn).toHaveBeenCalled();
      const savedConfig = saveConfigFn.mock.calls[0][0];
      // When all clients are cleared, empty environments are removed
      expect(savedConfig.environments.dev).toBeUndefined();
      expect(savedConfig.environments.tst).toBeUndefined();
    });

    it('should remove empty environments', async() => {
      const config = {
        environments: {
          dev: {
            clients: {
              app1: { token: 'token1' }
            }
          },
          tst: {
            clients: {
              app1: { token: 'token2' }
            }
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      await tokenFunctions.clearAllClientTokens();

      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.environments.dev).toBeUndefined();
      expect(savedConfig.environments.tst).toBeUndefined();
    });

    it('should preserve environments with other properties', async() => {
      const config = {
        environments: {
          dev: {
            clients: {
              app1: { token: 'token1' }
            },
            otherProperty: 'value'
          }
        }
      };
      getConfigFn.mockResolvedValue(config);
      await tokenFunctions.clearAllClientTokens();

      const savedConfig = saveConfigFn.mock.calls[0][0];
      expect(savedConfig.environments.dev.clients).toBeUndefined();
      expect(savedConfig.environments.dev.otherProperty).toBe('value');
    });
  });
});

