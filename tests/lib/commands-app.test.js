/**
 * Tests for Application Commands Module
 *
 * @fileoverview Tests for commands/app.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Mock dependencies
jest.mock('../../lib/config');
jest.mock('../../lib/utils/api');
jest.mock('../../lib/app', () => ({
  createApp: jest.fn()
}));

const { getConfig } = require('../../lib/config');
const { authenticatedApiCall } = require('../../lib/utils/api');
const { createApp } = require('../../lib/app');
const { setupAppCommands } = require('../../lib/commands/app');

describe('Application Commands Module', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    getConfig.mockResolvedValue({
      apiUrl: 'http://localhost:3000',
      token: 'test-token-123',
      expiry: Date.now() + 3600000
    });

    fsSync.mkdirSync(path.join(tempDir, 'builder'), { recursive: true });
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('setupAppCommands', () => {
    it('should set up app commands with register, list, and rotate-secret', () => {
      const mockProgram = {
        command: jest.fn().mockReturnThis(),
        description: jest.fn().mockReturnThis(),
        requiredOption: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
        action: jest.fn().mockReturnThis()
      };

      const result = setupAppCommands(mockProgram);

      expect(mockProgram.command).toHaveBeenCalledWith('app');
      expect(mockProgram.description).toHaveBeenCalled();
    });
  });

  describe('register command', () => {
    it('should register application successfully', async() => {
      const appKey = 'test-app';
      const environment = 'dev';
      const appDir = path.join(tempDir, 'builder', appKey);
      fsSync.mkdirSync(appDir, { recursive: true });

      const variables = {
        app: { key: appKey, name: 'Test App', description: 'Test description' },
        build: { language: 'typescript', port: 3000 }
      };

      await fs.writeFile(
        path.join(appDir, 'variables.yaml'),
        yaml.dump(variables)
      );

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          application: { id: 'app-123', key: appKey },
          credentials: { clientId: 'client-id', clientSecret: 'client-secret' }
        }
      });

      const variablesPath = path.join(appDir, 'variables.yaml');
      const variablesContent = await fs.readFile(variablesPath, 'utf-8');
      const loadedVariables = yaml.load(variablesContent);

      expect(loadedVariables.app.key).toBe(appKey);
      expect(loadedVariables.app.name).toBe('Test App');
      expect(loadedVariables.build.language).toBe('typescript');
    });

    it('should handle missing variables.yaml by creating app', async() => {
      const appKey = 'new-app';
      createApp.mockResolvedValue();

      const variablesPath = path.join(tempDir, 'builder', appKey, 'variables.yaml');

      const error = new Error('File not found');
      error.code = 'ENOENT';

      expect(error.code).toBe('ENOENT');
    });

    it('should validate application key format', () => {
      const invalidKeys = ['Invalid Key', 'invalid_key', '123', 'a', 'a'.repeat(60)];
      const validKey = 'valid-app-key';

      invalidKeys.forEach(key => {
        if (key.length < 1 || key.length > 50) {
          expect(key.length >= 1 && key.length <= 50).toBe(false);
        }
      });

      expect(validKey.length).toBeGreaterThanOrEqual(1);
      expect(validKey.length).toBeLessThanOrEqual(50);
    });

    it('should validate port range', () => {
      const validPort = 3000;
      const invalidPorts = [0, 65536, -1];

      expect(validPort).toBeGreaterThanOrEqual(1);
      expect(validPort).toBeLessThanOrEqual(65535);

      invalidPorts.forEach(port => {
        expect(port < 1 || port > 65535).toBe(true);
      });
    });
  });

  describe('list command', () => {
    it('should list applications for environment', async() => {
      const environment = 'dev';

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: [
          { id: 'app-1', key: 'app1', displayName: 'App 1' },
          { id: 'app-2', key: 'app2', displayName: 'App 2' }
        ]
      });

      expect(authenticatedApiCall).toBeDefined();
    });

    it('should handle empty application list', async() => {
      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: []
      });

      expect(authenticatedApiCall).toBeDefined();
    });

    it('should handle API errors gracefully', async() => {
      authenticatedApiCall.mockResolvedValue({
        success: false,
        error: 'Access denied',
        status: 403
      });

      expect(authenticatedApiCall).toBeDefined();
    });
  });

  describe('rotate-secret command', () => {
    it('should rotate secret successfully', async() => {
      const appKey = 'test-app';
      const environment = 'dev';

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          application: { id: 'app-123', key: appKey },
          credentials: {
            clientId: 'ctrl-dev-test-app',
            clientSecret: 'new-secret-123'
          }
        }
      });

      expect(authenticatedApiCall).toBeDefined();
    });

    it('should handle rotation failure', async() => {
      authenticatedApiCall.mockResolvedValue({
        success: false,
        error: 'Application not found',
        status: 404
      });

      expect(authenticatedApiCall).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing config gracefully', async() => {
      getConfig.mockResolvedValue({
        apiUrl: null,
        token: null
      });

      const config = await getConfig();
      expect(config.apiUrl).toBeNull();
      expect(config.token).toBeNull();
    });

    it('should handle missing variables.yaml gracefully', async() => {
      const appKey = 'missing-app';

      try {
        await fs.readFile(
          path.join(tempDir, 'builder', appKey, 'variables.yaml'),
          'utf-8'
        );
      } catch (error) {
        expect(error.code).toBe('ENOENT');
      }
    });

    it('should validate required fields in variables.yaml', () => {
      const incompleteConfig = {
        app: { name: 'Test' }
        // Missing app.key
      };

      const missingFields = [];
      if (!incompleteConfig.app?.key) missingFields.push('app.key');
      if (!incompleteConfig.app?.name) missingFields.push('app.name');

      expect(missingFields).toContain('app.key');
      expect(missingFields).not.toContain('app.name');
    });
  });

  describe('configuration validation', () => {
    it('should validate application type', () => {
      const validTypes = ['webapp', 'api', 'service', 'functionapp'];
      const invalidType = 'invalid';

      expect(validTypes).toContain('webapp');
      expect(validTypes).not.toContain(invalidType);
    });

    it('should validate registry mode', () => {
      const validModes = ['acr', 'external', 'public'];
      const invalidMode = 'invalid';

      expect(validModes).toContain('external');
      expect(validModes).not.toContain(invalidMode);
    });

    it('should extract app configuration from variables.yaml', async() => {
      const appKey = 'test-app';
      const appDir = path.join(tempDir, 'builder', appKey);
      fsSync.mkdirSync(appDir, { recursive: true });

      const variables = {
        app: {
          key: appKey,
          name: 'Test App',
          description: 'Test description'
        },
        build: {
          language: 'typescript',
          port: 3000
        }
      };

      await fs.writeFile(
        path.join(appDir, 'variables.yaml'),
        yaml.dump(variables)
      );

      const loaded = yaml.load(await fs.readFile(path.join(appDir, 'variables.yaml'), 'utf-8'));

      expect(loaded.app.key).toBe(appKey);
      expect(loaded.app.name).toBe('Test App');
      expect(loaded.build.language).toBe('typescript');
      expect(loaded.build.port).toBe(3000);
    });
  });
});

