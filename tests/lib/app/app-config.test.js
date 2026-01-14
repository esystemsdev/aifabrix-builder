/**
 * Tests for AI Fabrix Builder Application Configuration Module
 *
 * @fileoverview Unit tests for app-config.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');

// Mock fs
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      access: jest.fn(),
      writeFile: jest.fn(),
      readFile: jest.fn(),
      mkdir: jest.fn(),
      rm: jest.fn()
    }
  };
});

const fsPromises = require('fs').promises;
const fsSync = require('fs');

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

// Mock templates
jest.mock('../../../lib/core/templates', () => ({
  generateVariablesYaml: jest.fn(),
  generateEnvTemplate: jest.fn(),
  generateRbacYaml: jest.fn()
}));

// Mock env-reader
jest.mock('../../../lib/core/env-reader', () => ({
  generateEnvTemplate: jest.fn()
}));

// Mock app-readme
jest.mock('../../../lib/app/readme', () => ({
  generateReadmeMdFile: jest.fn().mockResolvedValue(undefined)
}));

const { generateConfigFiles } = require('../../../lib/app/config');

describe('Application Configuration Module', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Reset all mocks
    jest.clearAllMocks();

    // Mock fs.promises methods
    fsPromises.access = jest.fn().mockRejectedValue(new Error('File not found'));
    fsPromises.writeFile = jest.fn().mockResolvedValue(undefined);
    fsPromises.mkdir = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(async() => {
    // Clean up temporary directory
    process.chdir(originalCwd);
    try {
      if (fsPromises.rm) {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      } else {
        // Fallback if rm is not available
        const fs = require('fs');
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateConfigFiles - External System', () => {
    it('should generate env.template for external system with OAuth2 auth', async() => {
      const appPath = path.join(tempDir, 'integration', 'test-external');
      const appName = 'test-external';
      const config = {
        type: 'external',
        authType: 'oauth2',
        systemKey: 'test-external',
        systemDisplayName: 'Test External',
        systemDescription: 'Test external system'
      };
      const existingEnv = null;

      // Mock file doesn't exist
      fsPromises.access = jest.fn().mockRejectedValue(new Error('File not found'));

      await generateConfigFiles(appPath, appName, config, existingEnv);

      // Verify env.template was written
      expect(fsPromises.writeFile).toHaveBeenCalled();
      const writeCalls = fsPromises.writeFile.mock.calls;
      const envTemplateCall = writeCalls.find(call => call[0].includes('env.template'));

      expect(envTemplateCall).toBeDefined();
      const envTemplateContent = envTemplateCall[1];
      expect(envTemplateContent).toContain('# test-external OAUTH2 Configuration');
      expect(envTemplateContent).toContain('CLIENTID=kv://test-external-clientidKeyVault');
      expect(envTemplateContent).toContain('CLIENTSECRET=kv://test-external-clientsecretKeyVault');
      expect(envTemplateContent).toContain('TOKENURL=https://api.example.com/oauth/token');
      expect(envTemplateContent).toContain('REDIRECT_URI=kv://test-external-redirect-uriKeyVault');
    });

    it('should generate env.template for external system with API Key auth', async() => {
      const appPath = path.join(tempDir, 'integration', 'test-external');
      const appName = 'test-external';
      const config = {
        type: 'external',
        authType: 'apikey',
        systemKey: 'test-external'
      };
      const existingEnv = null;

      // Mock file doesn't exist
      fsPromises.access = jest.fn().mockRejectedValue(new Error('File not found'));

      await generateConfigFiles(appPath, appName, config, existingEnv);

      // Verify env.template was written
      expect(fsPromises.writeFile).toHaveBeenCalled();
      const writeCalls = fsPromises.writeFile.mock.calls;
      const envTemplateCall = writeCalls.find(call => call[0].includes('env.template'));

      expect(envTemplateCall).toBeDefined();
      const envTemplateContent = envTemplateCall[1];
      expect(envTemplateContent).toContain('# test-external APIKEY Configuration');
      expect(envTemplateContent).toContain('API_KEY=kv://test-external-api-keyKeyVault');
      expect(envTemplateContent).not.toContain('CLIENTID');
      expect(envTemplateContent).not.toContain('CLIENTSECRET');
    });

    it('should generate env.template for external system with Basic Auth', async() => {
      const appPath = path.join(tempDir, 'integration', 'test-external');
      const appName = 'test-external';
      const config = {
        type: 'external',
        authType: 'basic',
        systemKey: 'test-external'
      };
      const existingEnv = null;

      // Mock file doesn't exist
      fsPromises.access = jest.fn().mockRejectedValue(new Error('File not found'));

      await generateConfigFiles(appPath, appName, config, existingEnv);

      // Verify env.template was written
      expect(fsPromises.writeFile).toHaveBeenCalled();
      const writeCalls = fsPromises.writeFile.mock.calls;
      const envTemplateCall = writeCalls.find(call => call[0].includes('env.template'));

      expect(envTemplateCall).toBeDefined();
      const envTemplateContent = envTemplateCall[1];
      expect(envTemplateContent).toContain('# test-external BASIC Configuration');
      expect(envTemplateContent).toContain('USERNAME=kv://test-external-usernameKeyVault');
      expect(envTemplateContent).toContain('PASSWORD=kv://test-external-passwordKeyVault');
    });

    it('should use appName as fallback for systemKey in env.template', async() => {
      const appPath = path.join(tempDir, 'integration', 'test-external');
      const appName = 'test-external';
      const config = {
        type: 'external',
        authType: 'apikey'
        // systemKey not provided
      };
      const existingEnv = null;

      // Mock file doesn't exist
      fsPromises.access = jest.fn().mockRejectedValue(new Error('File not found'));

      await generateConfigFiles(appPath, appName, config, existingEnv);

      // Verify env.template uses appName
      expect(fsPromises.writeFile).toHaveBeenCalled();
      const writeCalls = fsPromises.writeFile.mock.calls;
      const envTemplateCall = writeCalls.find(call => call[0].includes('env.template'));

      expect(envTemplateCall).toBeDefined();
      const envTemplateContent = envTemplateCall[1];
      expect(envTemplateContent).toContain('# test-external APIKEY Configuration');
      expect(envTemplateContent).toContain('API_KEY=kv://test-external-api-keyKeyVault');
    });

    it('should not overwrite existing env.template file', async() => {
      const appPath = path.join(tempDir, 'integration', 'test-external');
      const appName = 'test-external';
      const config = {
        type: 'external',
        authType: 'oauth2',
        systemKey: 'test-external'
      };
      const existingEnv = null;

      // Mock file exists
      fsPromises.access = jest.fn().mockResolvedValue(undefined);

      await generateConfigFiles(appPath, appName, config, existingEnv);

      // Verify env.template was NOT written
      const writeCalls = fsPromises.writeFile.mock.calls;
      const envTemplateCall = writeCalls.find(call => call[0] && call[0].includes('env.template'));
      expect(envTemplateCall).toBeUndefined();
    });
  });
});

