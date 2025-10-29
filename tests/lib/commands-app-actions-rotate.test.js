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

const { getConfig } = require('../../lib/config');
const { authenticatedApiCall } = require('../../lib/utils/api');
const { setupAppCommands } = require('../../lib/commands/app');

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = (text) => text;
  mockChalk.green = (text) => text;
  mockChalk.red = (text) => text;
  mockChalk.yellow = (text) => text;
  mockChalk.cyan = (text) => text;
  mockChalk.bold = (text) => text;
  mockChalk.gray = (text) => text;
  mockChalk.bold.yellow = (text) => text;
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
            if (cmdName === 'rotate-secret') {
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
  });

  describe('rotate-secret command action', () => {
    it('should rotate secret successfully', async() => {
      getConfig.mockResolvedValue({
        apiUrl: 'http://localhost:3000',
        token: 'test-token'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          application: {
            key: 'test-app'
          },
          credentials: {
            clientId: 'new-client-id',
            clientSecret: 'new-client-secret'
          }
        }
      });

      if (rotateSecretAction) {
        await rotateSecretAction({
          app: 'test-app',
          environment: 'dev'
        });

        expect(authenticatedApiCall).toHaveBeenCalledWith(
          'http://localhost:3000/api/applications/test-app/rotate-secret?environmentId=dev',
          expect.objectContaining({ method: 'POST' }),
          'test-token'
        );
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ Secret rotated successfully!'));
      }
    });

    it('should handle not logged in', async() => {
      getConfig.mockResolvedValue({
        apiUrl: null,
        token: null
      });

      if (rotateSecretAction) {
        await rotateSecretAction({
          app: 'test-app',
          environment: 'dev'
        });
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Not logged in'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should handle missing environment', async() => {
      getConfig.mockResolvedValue({
        apiUrl: 'http://localhost:3000',
        token: 'test-token'
      });

      if (rotateSecretAction) {
        await rotateSecretAction({
          app: 'test-app',
          environment: ''
        });
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Environment is required'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should handle API failure', async() => {
      getConfig.mockResolvedValue({
        apiUrl: 'http://localhost:3000',
        token: 'test-token'
      });

      authenticatedApiCall.mockResolvedValue({
        success: false,
        error: 'Rotation failed'
      });

      if (rotateSecretAction) {
        await rotateSecretAction({
          app: 'test-app',
          environment: 'dev'
        });
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should handle missing application key in response', async() => {
      getConfig.mockResolvedValue({
        apiUrl: 'http://localhost:3000',
        token: 'test-token'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          application: null,
          credentials: {
            clientId: 'new-client-id',
            clientSecret: 'new-client-secret'
          }
        }
      });

      if (rotateSecretAction) {
        await rotateSecretAction({
          app: 'test-app',
          environment: 'dev'
        });
        expect(console.log).toHaveBeenCalled();
      }
    });
  });
});

