/**
 * Tests for Application Commands Actions
 *
 * @fileoverview Tests that actually invoke the command action handlers in lib/commands/app.js
 * Local-only: complex cwd/temp-dir and path resolution; excluded from CI.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

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

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('http://localhost:3000')
}));
jest.mock('../../../lib/utils/api');
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/api/environments.api');
jest.mock('../../../lib/utils/api-error-handler', () => ({ formatApiError: jest.fn() }));
jest.mock('../../../lib/app', () => ({
  createApp: jest.fn()
}));
jest.mock('../../../lib/utils/app-register-config', () => {
  const actual = jest.requireActual('../../../lib/utils/app-register-config');
  return {
    ...actual,
    loadVariablesYaml: jest.fn((...args) => actual.loadVariablesYaml(...args)),
    createMinimalAppIfNeeded: jest.fn((...args) => actual.createMinimalAppIfNeeded(...args))
  };
});

const config = require('../../../lib/core/config');
const { formatApiError } = require('../../../lib/utils/api-error-handler');
const { getConfig } = config;
const { authenticatedApiCall } = require('../../../lib/utils/api');
const tokenManager = require('../../../lib/utils/token-manager');
const { listEnvironmentApplications } = require('../../../lib/api/environments.api');
const app = require('../../../lib/app');
const { setupAppCommands } = require('../../../lib/commands/app');

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

describe('Application Commands Actions - Invoke Handlers', () => {
  let tempDir;
  let originalCwd;
  let registerAction;
  let listAction;
  let rotateSecretAction;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    fsSync.mkdirSync(path.join(tempDir, 'builder'), { recursive: true });
    // Application config so resolveApplicationConfigPath + loadConfigFile find it
    const testAppDir = path.join(tempDir, 'builder', 'test-app');
    fsSync.mkdirSync(testAppDir, { recursive: true });
    fsSync.writeFileSync(
      path.join(testAppDir, 'application.yaml'),
      yaml.dump({ app: { key: 'test-app', name: 'Test App' }, build: { language: 'typescript', port: 3000 } }),
      'utf8'
    );
    const testAppUpperDir = path.join(tempDir, 'builder', 'TEST_APP');
    fsSync.mkdirSync(testAppUpperDir, { recursive: true });
    // Invalid config (missing app.key) so validation fails with "Invalid configuration"
    fsSync.writeFileSync(
      path.join(testAppUpperDir, 'application.yaml'),
      yaml.dump({ app: {}, build: { language: 'typescript', port: 3000 } }),
      'utf8'
    );

    jest.clearAllMocks();
    (config.resolveEnvironment || (config.resolveEnvironment = jest.fn())).mockResolvedValue('dev');
    (config.normalizeControllerUrl || (config.normalizeControllerUrl = jest.fn())).mockReturnValue('http://localhost:3000');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});

    // Create mock program that captures action handlers
    // The structure is: program.command('app').command('register <appKey>').action(handler)
    const mockAppCommand = {
      command: jest.fn().mockImplementation((cmdName) => {
        // cmdName could be 'register <appKey>', 'list', 'rotate-secret <appKey>'
        const cmdObj = {
          description: jest.fn().mockReturnThis(),
          requiredOption: jest.fn().mockReturnThis(),
          option: jest.fn().mockReturnThis(),
          action: jest.fn((handler) => {
            // Store handler based on command name
            if (cmdName && cmdName.startsWith('register')) {
              registerAction = handler;
            } else if (cmdName === 'list') {
              listAction = handler;
            } else if (cmdName && cmdName.startsWith('rotate-secret')) {
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
    // Use fsSync.rmSync if available, otherwise use fs.rm
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

  describe('register command action', () => {
    it('should register application with full flow', async() => {
      const variablesContent = yaml.dump({
        app: {
          key: 'test-app',
          name: 'Test Application',
          description: 'Test Description'
        },
        build: {
          language: 'typescript',
          port: 3000
        }
      });

      fs.readFile.mockResolvedValue(variablesContent);
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
          application: {
            id: 'app-123',
            key: 'test-app',
            displayName: 'Test Application'
          },
          credentials: {
            clientId: 'client-id-123',
            clientSecret: 'client-secret-456'
          }
        }
      });

      if (registerAction) {
        await registerAction('test-app', { environment: 'dev' });

        expect(authenticatedApiCall).toHaveBeenCalledWith(
          'http://localhost:3000/api/v1/environments/dev/applications/register',
          expect.objectContaining({ method: 'POST' }),
          expect.objectContaining({ token: 'test-token' })
        );
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ Application registered successfully!'));
      } else {
        expect(true).toBe(false); // Action was not captured
      }
    });

    it('should handle missing application.yaml and create app', async() => {
      const appRegisterConfig = require('../../../lib/utils/app-register-config');
      appRegisterConfig.loadVariablesYaml.mockResolvedValueOnce({ variables: null, created: true });
      appRegisterConfig.createMinimalAppIfNeeded.mockImplementation(async(appKey, options) => {
        await app.createApp(appKey, {
          port: options.port,
          language: 'typescript',
          database: false,
          redis: false,
          storage: false,
          authentication: false
        });
        return { app: { key: appKey, name: appKey }, build: { localPort: 3000 }, port: 3000 };
      });
      app.createApp.mockResolvedValue();
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
          application: { id: 'app-123', key: 'new-app', displayName: 'New App' },
          credentials: { clientId: 'client-id', clientSecret: 'client-secret' }
        }
      });

      if (registerAction) {
        await registerAction('new-app', { environment: 'dev' });
        expect(app.createApp).toHaveBeenCalled();
      }
    });

    it('should handle file read error (non-ENOENT)', async() => {
      const configPath = path.join(tempDir, 'builder', 'test-app', 'application.yaml');
      try {
        fsSync.chmodSync(configPath, 0o000);
        if (registerAction) {
          await registerAction('test-app', { environment: 'dev' });
          expect(process.exit).toHaveBeenCalledWith(1);
        }
      } finally {
        try {
          fsSync.chmodSync(configPath, 0o644);
        } catch {
          // ignore
        }
      }
    });

    it('should handle missing required fields', async() => {
      // Create variables with missing app.name (app.key will fallback to appKey parameter)
      const variablesContent = yaml.dump({
        app: {
          // No key, no name
        },
        build: { language: 'typescript', port: 3000 }
      });

      fs.readFile.mockResolvedValue(variablesContent);
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

      if (registerAction) {
        // Pass empty appKey and no name option to trigger missing fields check
        await registerAction('', { environment: 'dev' });
        // Check that error was logged or process.exit was called
        // appKeyFromFile will be empty string, displayName will also be empty
        const hasError = console.error.mock.calls.length > 0 || process.exit.mock.calls.length > 0;
        expect(hasError).toBe(true);
      }
    });

    it('should handle validation errors', async() => {
      const variablesContent = yaml.dump({
        app: { key: 'TEST_APP', name: 'Test App' }, // Invalid key format
        build: { language: 'typescript', port: 3000 }
      });

      fs.readFile.mockResolvedValue(variablesContent);
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

      if (registerAction) {
        await registerAction('TEST_APP', { environment: 'dev' });
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid configuration'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it.skip('should handle not logged in', async() => {
      // TODO: align with current register auth flow (resolveControllerUrl, checkAuthentication)
      const variablesContent = yaml.dump({
        app: { key: 'test-app', name: 'Test App' },
        build: { language: 'typescript', port: 3000 }
      });

      fs.readFile.mockResolvedValue(variablesContent);
      getConfig.mockResolvedValue({
        apiUrl: null,
        token: null
      });

      if (registerAction) {
        await registerAction('test-app', { environment: 'dev' });
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should handle registration API failure', async() => {
      const variablesContent = yaml.dump({
        app: { key: 'test-app', name: 'Test App' },
        build: { language: 'typescript', port: 3000 }
      });

      fs.readFile.mockResolvedValue(variablesContent);
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
        error: 'Registration failed'
      });

      if (registerAction) {
        await registerAction('test-app', { environment: 'dev' });
        expect(console.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should use options.name when app.name is missing', async() => {
      const variablesContent = yaml.dump({
        app: { key: 'test-app' }, // No name field
        build: { language: 'typescript', port: 3000 }
      });
      fsSync.writeFileSync(path.join(tempDir, 'builder', 'test-app', 'application.yaml'), variablesContent, 'utf8');
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
          application: { id: 'app-123', key: 'test-app', displayName: 'Override Name' },
          credentials: { clientId: 'client-id', clientSecret: 'client-secret' }
        }
      });

      if (registerAction) {
        await registerAction('test-app', { environment: 'dev', name: 'Override Name' });
        const callArgs = authenticatedApiCall.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        // options.name is used when variables.app.name is missing
        expect(body.displayName).toBe('Override Name');
      }
    });

    it('should handle Python language (service type)', async() => {
      const variablesContent = yaml.dump({
        app: { key: 'python-app', name: 'Python App' },
        build: { language: 'python', port: 8000 }
      });
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'python-app'), { recursive: true });
      fsSync.writeFileSync(path.join(tempDir, 'builder', 'python-app', 'application.yaml'), variablesContent, 'utf8');
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
          application: { id: 'app-123', key: 'python-app', displayName: 'Python App' },
          credentials: { clientId: 'client-id', clientSecret: 'client-secret' }
        }
      });

      if (registerAction) {
        await registerAction('python-app', { environment: 'dev' });
        const callArgs = authenticatedApiCall.mock.calls[0];
        const options = callArgs[1];
        const body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
        expect(body).toBeDefined();
        expect(body.type).toBe('service');
      }
    });
  });

  describe('list command action', () => {
    it('should list applications successfully', async() => {
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

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: {
          items: [
            {
              key: 'app1',
              displayName: 'App 1',
              status: 'active',
              configuration: {
                pipeline: { isActive: true }
              }
            },
            {
              key: 'app2',
              displayName: 'App 2',
              status: 'inactive',
              configuration: {
                pipeline: { isActive: false }
              }
            }
          ],
          meta: {
            totalItems: 2,
            currentPage: 1,
            pageSize: 10,
            type: 'application'
          },
          links: {}
        }
      });

      if (listAction) {
        await listAction({ environment: 'dev' });
        expect(listEnvironmentApplications).toHaveBeenCalledWith(
          'http://localhost:3000',
          'dev',
          { type: 'bearer', token: 'test-token' }
        );
        expect(console.log).toHaveBeenCalled();
      }
    });

    it.skip('should handle not logged in', async() => {
      // TODO: align with current list auth flow (resolveControllerUrl, getListAuthToken, logger vs console)
      getConfig.mockResolvedValue({
        apiUrl: null,
        token: null
      });

      if (listAction) {
        await listAction({ environment: 'dev' });
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
      formatApiError.mockReturnValue('❌ Error');

      listEnvironmentApplications.mockResolvedValue({
        success: false
      });

      if (listAction) {
        await listAction({ environment: 'dev' });
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('❌ Error'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });

    it('should handle empty data', async() => {
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
      formatApiError.mockReturnValue('❌ Unknown error occurred');

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: null
      });

      if (listAction) {
        await listAction({ environment: 'dev' });
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('❌ Unknown error occurred'));
        expect(process.exit).toHaveBeenCalledWith(1);
      }
    });
  });
});
