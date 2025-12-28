/**
 * Tests for Application Commands - Rotate Secret Action
 *
 * @fileoverview Tests for rotate-secret command action in lib/commands/app.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn()
    },
    existsSync: actualFs.existsSync,
    rmSync: actualFs.rmSync
  };
});

jest.mock('../../lib/config');
jest.mock('../../lib/utils/api');
jest.mock('../../lib/utils/token-manager');
jest.mock('../../lib/utils/local-secrets', () => ({
  saveLocalSecret: jest.fn().mockResolvedValue(),
  isLocalhost: jest.fn().mockReturnValue(false) // Return false so it doesn't try to update env.template
}));
jest.mock('../../lib/utils/env-template', () => ({
  updateEnvTemplate: jest.fn().mockResolvedValue()
}));
jest.mock('../../lib/secrets', () => ({
  generateEnvFile: jest.fn().mockResolvedValue('/path/to/.env')
}));
jest.mock('../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const { getConfig } = require('../../lib/config');
const { authenticatedApiCall } = require('../../lib/utils/api');
const tokenManager = require('../../lib/utils/token-manager');
const localSecrets = require('../../lib/utils/local-secrets');
const secrets = require('../../lib/secrets');
const logger = require('../../lib/utils/logger');
const { setupAppCommands } = require('../../lib/commands/app');

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = (text) => text;
  mockChalk.green = (text) => text;
  mockChalk.red = (text) => text;
  mockChalk.yellow = (text) => text;
  mockChalk.cyan = (text) => text;
  mockChalk.gray = (text) => text;
  // Mock bold as a function that returns an object with color methods
  mockChalk.bold = (text) => {
    const boldObj = (t) => t;
    boldObj.red = (t) => t;
    boldObj.yellow = (t) => t;
    boldObj.green = (t) => t;
    return typeof text === 'string' ? text : boldObj;
  };
  mockChalk.bold.yellow = (text) => text;
  mockChalk.bold.red = (text) => text;
  return mockChalk;
});

describe('Application Commands - Rotate Secret Action', () => {
  let tempDir;
  let originalCwd;
  let rotateSecretAction;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    fsSync.mkdirSync(path.join(tempDir, 'builder'), { recursive: true });

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});

    const mockAppCommand = {
      command: jest.fn().mockImplementation((cmdName) => {
        const cmdObj = {
          description: jest.fn().mockReturnThis(),
          requiredOption: jest.fn().mockReturnThis(),
          option: jest.fn().mockReturnThis(),
          action: jest.fn((handler) => {
            if (cmdName && cmdName.startsWith('rotate-secret')) {
              rotateSecretAction = handler;
            }
            return cmdObj;
          })
        };
        return cmdObj;
      }),
      description: jest.fn().mockReturnThis(),
      requiredOption: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis()
    };

    const mockProgram = {
      command: jest.fn().mockImplementation((name) => {
        if (name === 'app') {
          return mockAppCommand;
        }
        return mockAppCommand;
      }),
      description: jest.fn().mockReturnThis()
    };

    setupAppCommands(mockProgram);
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    if (fsSync.rmSync) {
      try {
        fsSync.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    } else {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // Clear logger mocks
    if (logger) {
      logger.log.mockClear();
      logger.warn.mockClear();
      logger.error.mockClear();
    }
  });

  describe('rotate-secret command action', () => {
    it('should rotate secret successfully', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {
          'http://localhost:3000': {
            token: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          success: true,
          credentials: {
            clientId: 'new-client-id',
            clientSecret: 'new-client-secret'
          },
          message: 'IMPORTANT: Save new clientSecret now - old secret is now invalid',
          timestamp: '2025-11-07T18:48:55.726Z'
        }
      });

      // Set isLocalhost to true to test .env file generation
      localSecrets.isLocalhost.mockReturnValue(true);

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: 'dev'
        });

        expect(authenticatedApiCall).toHaveBeenCalledWith(
          'http://localhost:3000/api/v1/environments/dev/applications/test-app/rotate-secret',
          expect.objectContaining({ method: 'POST' }),
          'test-token'
        );
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✅ Secret rotated successfully!'));
        // Verify that saveLocalSecret is called (always saves now)
        expect(localSecrets.saveLocalSecret).toHaveBeenCalledWith('test-app-client-idKeyVault', 'new-client-id');
        expect(localSecrets.saveLocalSecret).toHaveBeenCalledWith('test-app-client-secretKeyVault', 'new-client-secret');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✓ Credentials saved to ~/.aifabrix/secrets.local.yaml'));
        // Verify that env.template is updated and .env file is generated when localhost
        expect(require('../../lib/utils/env-template').updateEnvTemplate).toHaveBeenCalled();
        expect(secrets.generateEnvFile).toHaveBeenCalledWith('test-app', null, 'local');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✓ .env file updated with new credentials'));
      }
    });

    it('should handle not logged in', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {},
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue(null);

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: 'dev'
        });
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Authentication Failed'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should handle missing environment', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {
          'http://localhost:3000': {
            token: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: ''
        });
        expect(logger.error).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Environment is required'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should handle API failure', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {
          'http://localhost:3000': {
            token: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      authenticatedApiCall.mockResolvedValue({
        success: false,
        error: 'Rotation failed'
      });

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: 'dev'
        });
        expect(logger.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should handle missing application key in response', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {
          'http://localhost:3000': {
            token: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          success: true,
          credentials: {
            clientId: 'new-client-id',
            clientSecret: 'new-client-secret'
          },
          message: 'IMPORTANT: Save new clientSecret now - old secret is now invalid',
          timestamp: '2025-11-07T18:48:55.726Z'
        }
      });

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: 'dev'
        });
        expect(logger.log).toHaveBeenCalled();
      }
    });

    it('should validate response structure - missing data', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {
          'http://localhost:3000': {
            token: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: null
      });

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: 'dev'
        });
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to rotate secret via controller'));
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error: Invalid response: missing data'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should validate response structure - missing credentials', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {
          'http://localhost:3000': {
            token: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          success: true,
          message: 'Some message'
        }
      });

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: 'dev'
        });
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to rotate secret via controller'));
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error: Invalid response: missing or invalid credentials'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should validate response structure - missing clientId', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {
          'http://localhost:3000': {
            token: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          success: true,
          credentials: {
            clientSecret: 'new-client-secret'
          }
        }
      });

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: 'dev'
        });
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to rotate secret via controller'));
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error: Invalid response: missing or invalid credentials'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should validate response structure - missing clientSecret', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {
          'http://localhost:3000': {
            token: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          success: true,
          credentials: {
            clientId: 'new-client-id'
          }
        }
      });

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: 'dev'
        });
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to rotate secret via controller'));
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error: Invalid response: missing or invalid credentials'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should display message from API response', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {
          'http://localhost:3000': {
            token: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          success: true,
          credentials: {
            clientId: 'new-client-id',
            clientSecret: 'new-client-secret'
          },
          message: 'IMPORTANT: Save new clientSecret now - old secret is now invalid',
          timestamp: '2025-11-07T18:48:55.726Z'
        }
      });

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: 'dev'
        });
        // The message from API response is displayed via logger.log
        // Since logger is mocked, check logger.log instead of console.log
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('IMPORTANT: Save new clientSecret now'));
      }
    });

    it('should handle error when generating .env file', async() => {
      getConfig.mockResolvedValue({
        'developer-id': 0,
        environment: 'dev',
        device: {
          'http://localhost:3000': {
            token: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          success: true,
          credentials: {
            clientId: 'new-client-id',
            clientSecret: 'new-client-secret'
          },
          message: 'IMPORTANT: Save new clientSecret now - old secret is now invalid',
          timestamp: '2025-11-07T18:48:55.726Z'
        }
      });

      // Set isLocalhost to true to test .env file generation
      localSecrets.isLocalhost.mockReturnValue(true);
      secrets.generateEnvFile.mockRejectedValueOnce(new Error('Failed to generate .env'));

      if (rotateSecretAction) {
        await rotateSecretAction('test-app', {
          environment: 'dev'
        });

        expect(require('../../lib/utils/env-template').updateEnvTemplate).toHaveBeenCalled();
        expect(secrets.generateEnvFile).toHaveBeenCalledWith('test-app', null, 'local');
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('⚠️  Could not regenerate .env file')
        );
        // Should still complete successfully
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✅ Secret rotated successfully!'));
      }
    });
  });
});

