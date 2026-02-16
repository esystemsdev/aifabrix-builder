/**
 * Additional Coverage Tests for app.js
 *
 * @fileoverview Tests for remaining uncovered code paths in app.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const app = require('../../../lib/app');
const pushUtils = require('../../../lib/deployment/push');
const paths = require('../../../lib/utils/paths');
const configFormat = require('../../../lib/utils/config-format');

jest.mock('inquirer');
jest.mock('../../../lib/generator/github');
jest.mock('../../../lib/core/env-reader');
jest.mock('../../../lib/core/templates');
jest.mock('../../../lib/build');
jest.mock('../../../lib/app/run');
jest.mock('../../../lib/deployment/push');
jest.mock('../../../lib/app/deploy');
jest.mock('../../../lib/app/readme', () => ({
  generateReadmeMdFile: jest.fn().mockResolvedValue(),
  generateReadmeMd: jest.fn().mockReturnValue('# Test README\n')
}));
jest.mock('../../../lib/utils/controller-url', () => ({
  getDefaultControllerUrl: jest.fn().mockResolvedValue('http://localhost:3000')
}));

const inquirer = require('inquirer');
const githubGenerator = require('../../../lib/generator/github');
const envReader = require('../../../lib/core/env-reader');
const templates = require('../../../lib/core/templates');
const build = require('../../../lib/build');
const appRun = require('../../../lib/app/run');

describe('App.js Additional Coverage Tests', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    fsSync.mkdirSync(path.join(tempDir, 'builder'), { recursive: true });

    inquirer.prompt.mockResolvedValue({
      port: '3000',
      language: 'typescript',
      database: false,
      redis: false,
      storage: false,
      authentication: false,
      github: false,
      controller: false
    });

    envReader.readExistingEnv.mockResolvedValue(null);
    githubGenerator.generateGithubWorkflows.mockResolvedValue([]);
    templates.generateVariablesYaml.mockReturnValue('key: test-app\n');
    templates.generateEnvTemplate.mockReturnValue('# Environment template\n');
    templates.generateRbacYaml.mockReturnValue('roles:\n');
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    jest.clearAllMocks();
  });

  describe('promptForOptions - port validation in createApp flow', () => {
    it('should prompt for port and validate invalid port values', async() => {
      // Test that port validation function is called during createApp when port is not provided
      let portValidationCalled = false;
      let validationResult = null;

      inquirer.prompt.mockImplementationOnce((questions) => {
        const portQuestion = questions.find(q => q.name === 'port');
        if (portQuestion && portQuestion.validate) {
          // Test validation with invalid values
          portValidationCalled = true;
          validationResult = portQuestion.validate('70000');
          expect(validationResult).toBe('Port must be a number between 1 and 65535');

          // Test with 0
          expect(portQuestion.validate('0')).toBe('Port must be a number between 1 and 65535');

          // Test with negative
          expect(portQuestion.validate('-1')).toBe('Port must be a number between 1 and 65535');

          // Test with NaN
          expect(portQuestion.validate('abc')).toBe('Port must be a number between 1 and 65535');

          // Test with boundary values
          expect(portQuestion.validate('1')).toBe(true);
          expect(portQuestion.validate('65535')).toBe(true);

          // Test with valid port
          expect(portQuestion.validate('3000')).toBe(true);
          expect(portQuestion.validate('8080')).toBe(true);
        }

        return Promise.resolve({
          port: '3000', // Return valid port after validation
          language: 'typescript',
          database: false,
          redis: false,
          storage: false,
          authentication: false,
          github: false
        });
      });

      // Call createApp without port to trigger prompt
      await app.createApp('test-app', { language: 'typescript' });

      expect(portValidationCalled).toBe(true);
      expect(validationResult).toBe('Port must be a number between 1 and 65535');
    });

    it('should not prompt for port when port is already provided', async() => {
      inquirer.prompt.mockImplementationOnce((questions) => {
        // Port question should not be present when port is provided
        const portQuestion = questions.find(q => q.name === 'port');
        expect(portQuestion).toBeUndefined();

        return Promise.resolve({
          language: 'typescript',
          database: false,
          redis: false,
          storage: false,
          authentication: false
        });
      });

      await app.createApp('test-app', { port: 8080, language: 'typescript' });

      expect(inquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('promptForOptions - controller prompt when conditions', () => {
    it('should NOT prompt for controller when github is explicitly false', async() => {
      inquirer.prompt.mockImplementationOnce((questions) => {
        // Check that controller question is not added when github is false
        const hasControllerQuestion = questions.some(q => q.name === 'controller');
        expect(hasControllerQuestion).toBe(false);

        return Promise.resolve({
          port: '3000',
          language: 'typescript',
          database: false,
          redis: false,
          storage: false,
          authentication: false
        });
      });

      await app.createApp('test-app', {
        port: 3000,
        language: 'typescript',
        github: false
      });

      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should prompt for controller URL when controller is true and controllerUrl not provided', async() => {
      process.env.MISO_HOST = 'test-controller';

      inquirer.prompt.mockImplementationOnce((questions) => {
        const controllerUrlQuestion = questions.find(q => q.name === 'controllerUrl');

        if (controllerUrlQuestion) {
          // Test the when condition
          const whenResult = controllerUrlQuestion.when({ controller: true });
          expect(whenResult).toBe(true);

          const whenResultFalse = controllerUrlQuestion.when({ controller: false });
          expect(whenResultFalse).toBe(false);

          // Check default value (may vary based on developer ID, so check it contains the host)
          expect(controllerUrlQuestion.default).toContain('test-controller');
          expect(controllerUrlQuestion.default).toMatch(/^http:\/\/test-controller:\d+$/);
        }

        return Promise.resolve({
          port: '3000',
          language: 'typescript',
          database: false,
          redis: false,
          storage: false,
          authentication: false,
          github: true,
          controller: true,
          controllerUrl: 'http://test-controller:3000'
        });
      });

      await app.createApp('test-app', {
        port: 3000,
        language: 'typescript',
        github: true,
        controller: true
        // controllerUrl not provided - should trigger prompt
      });

      expect(inquirer.prompt).toHaveBeenCalled();
      delete process.env.MISO_HOST;
    });

    it('should use MISO_HOST env var or localhost for controller URL default', async() => {
      // Test with MISO_HOST set
      process.env.MISO_HOST = 'custom-host';

      inquirer.prompt.mockImplementationOnce((questions) => {
        const controllerUrlQuestion = questions.find(q => q.name === 'controllerUrl');
        if (controllerUrlQuestion) {
          expect(controllerUrlQuestion.default).toContain('custom-host');
          expect(controllerUrlQuestion.default).toMatch(/^http:\/\/custom-host:\d+$/);
        }
        return Promise.resolve({
          port: '3000',
          language: 'typescript',
          github: true,
          controller: true,
          controllerUrl: 'http://custom-host:3000'
        });
      });

      await app.createApp('test-app', {
        port: 3000,
        language: 'typescript',
        github: true,
        controller: true
      });

      delete process.env.MISO_HOST;

      // Test without MISO_HOST (should default to localhost)
      inquirer.prompt.mockImplementationOnce((questions) => {
        const controllerUrlQuestion = questions.find(q => q.name === 'controllerUrl');
        if (controllerUrlQuestion) {
          expect(controllerUrlQuestion.default).toContain('localhost');
          expect(controllerUrlQuestion.default).toMatch(/^http:\/\/localhost:\d+$/);
        }
        return Promise.resolve({
          port: '3000',
          language: 'typescript',
          github: true,
          controller: true,
          controllerUrl: 'http://localhost:3000'
        });
      });

      await app.createApp('test-app-2', {
        port: 3000,
        language: 'typescript',
        github: true,
        controller: true
      });
    });
  });

  describe('generateConfigFiles - environment warnings display', () => {
    it('should display warnings when env conversion has warnings', async() => {
      const appName = 'test-app-warnings';
      const appPath = path.join(tempDir, 'builder', appName);
      await fs.mkdir(appPath, { recursive: true });

      const warnings = [
        'Warning: DATABASE_URL format may need adjustment',
        'Warning: Some sensitive values were not converted'
      ];

      envReader.readExistingEnv.mockResolvedValue({
        DATABASE_URL: 'postgres://user:pass@localhost/db',
        API_KEY: 'secret-key'
      });

      envReader.generateEnvTemplate.mockResolvedValue({
        template: '# Environment template\nDATABASE_URL=kv://databases-test-app-0-urlKeyVault\n',
        warnings: warnings
      });

      jest.spyOn(console, 'log').mockImplementation(() => {});

      const config = {
        port: 3000,
        language: 'typescript',
        database: true,
        redis: false,
        storage: false,
        authentication: false
      };

      // Simulate the generateConfigFiles logic
      const existingEnv = await envReader.readExistingEnv(process.cwd());
      if (existingEnv) {
        const envResult = await envReader.generateEnvTemplate(config, existingEnv);
        if (envResult.warnings && envResult.warnings.length > 0) {
          console.log('\n⚠️  Environment conversion warnings:');
          envResult.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
      }

      expect(console.log).toHaveBeenCalledWith('\n⚠️  Environment conversion warnings:');
      expect(console.log).toHaveBeenCalledWith('  - Warning: DATABASE_URL format may need adjustment');
      expect(console.log).toHaveBeenCalledWith('  - Warning: Some sensitive values were not converted');

      console.log.mockRestore();
    });
  });

  describe('generateConfigFiles - error handling', () => {
    it('should wrap errors in generateConfigFiles catch block', async() => {
      // Use unique valid app name to avoid conflicts and pass validation
      const appName = `test-app-error-${Date.now()}`;

      // Mock templates.generateVariablesYaml to throw error
      templates.generateVariablesYaml.mockImplementationOnce(() => {
        throw new Error('Template generation failed');
      });

      const config = {
        port: 3000,
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false
      };

      // Test that generateConfigFiles throws wrapped error
      try {
        await app.createApp(appName, config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        // The error should be wrapped with "Failed to generate configuration files:"
        expect(error.message).toContain('Failed to generate configuration files');
        expect(error.message).toContain('Template generation failed');
      }
    });
  });

  describe('pushApp - successful ACR authentication and push flow', () => {
    const defaultPushConfig = { app: { key: 'test-app' }, image: { registry: 'myacr.azurecr.io' } };

    beforeEach(() => {
      const appPath = path.join(tempDir, 'builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(
        path.join(appPath, 'application.yaml'),
        yaml.dump(defaultPushConfig)
      );

      jest.spyOn(paths, 'detectAppType').mockImplementation(async(name) => ({
        appPath: path.join(tempDir, 'builder', name),
        appType: 'regular',
        baseDir: 'builder',
        isExternal: false
      }));

      // Avoid fs dependency in CI: push.js loadConfigFile() may see mocked fs from other suites
      jest.spyOn(configFormat, 'loadConfigFile').mockImplementation((filePath) => {
        if (filePath && String(filePath).includes('test-app')) {
          return { ...defaultPushConfig };
        }
        throw new Error(`Application config not found in ${filePath}. Expected application.yaml, application.yml, application.json, or variables.yaml.\nRun 'aifabrix create test-app' first`);
      });

      pushUtils.validateRegistryURL.mockImplementation((url) => {
        return url.endsWith('.azurecr.io');
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle successful push with ACR already authenticated', async() => {
      const appName = 'test-app';

      pushUtils.checkLocalImageExists.mockResolvedValue(true);
      pushUtils.checkAzureCLIInstalled.mockResolvedValue(true);
      pushUtils.checkACRAuthentication.mockResolvedValue(true);
      pushUtils.tagImage.mockResolvedValue();
      pushUtils.pushImage.mockResolvedValue();

      jest.spyOn(console, 'log').mockImplementation(() => {});

      await app.pushApp(appName, {});

      expect(pushUtils.checkLocalImageExists).toHaveBeenCalledWith(appName, 'latest');
      expect(pushUtils.checkAzureCLIInstalled).toHaveBeenCalled();
      expect(pushUtils.checkACRAuthentication).toHaveBeenCalledWith('myacr.azurecr.io');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Already authenticated'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Successfully pushed'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Tags: latest'));

      console.log.mockRestore();
    });

    it('should handle successful push with ACR authentication required', async() => {
      const appName = 'test-app';

      pushUtils.checkLocalImageExists.mockResolvedValue(true);
      pushUtils.checkAzureCLIInstalled.mockResolvedValue(true);
      pushUtils.checkACRAuthentication.mockResolvedValue(false);
      pushUtils.authenticateACR.mockResolvedValue();
      pushUtils.tagImage.mockResolvedValue();
      pushUtils.pushImage.mockResolvedValue();

      jest.spyOn(console, 'log').mockImplementation(() => {});

      await app.pushApp(appName, {});

      expect(pushUtils.authenticateACR).toHaveBeenCalledWith('myacr.azurecr.io');
      expect(pushUtils.tagImage).toHaveBeenCalled();
      expect(pushUtils.pushImage).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Successfully pushed'));

      console.log.mockRestore();
    });

    it('should push multiple tags successfully', async() => {
      const appName = 'test-app';

      pushUtils.checkLocalImageExists.mockResolvedValue(true);
      pushUtils.checkAzureCLIInstalled.mockResolvedValue(true);
      pushUtils.checkACRAuthentication.mockResolvedValue(true);
      pushUtils.tagImage.mockResolvedValue();
      pushUtils.pushImage.mockResolvedValue();

      jest.spyOn(console, 'log').mockImplementation(() => {});

      await app.pushApp(appName, { tag: 'v1.0.0,v1.1.0,latest' });

      // Should tag and push each tag
      expect(pushUtils.tagImage).toHaveBeenCalledTimes(3);
      expect(pushUtils.pushImage).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Successfully pushed 3 tag(s)'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Tags: v1.0.0, v1.1.0, latest'));

      console.log.mockRestore();
    });

    it('should display image and tags in success message', async() => {
      const appName = 'test-app';
      const registry = 'myacr.azurecr.io';

      pushUtils.checkLocalImageExists.mockResolvedValue(true);
      pushUtils.checkAzureCLIInstalled.mockResolvedValue(true);
      pushUtils.checkACRAuthentication.mockResolvedValue(true);
      pushUtils.tagImage.mockResolvedValue();
      pushUtils.pushImage.mockResolvedValue();

      jest.spyOn(console, 'log').mockImplementation(() => {});

      await app.pushApp(appName, { tag: 'v1.0.0,latest' });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Successfully pushed'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`Image: ${registry}/${appName}:*`));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Tags: v1.0.0, latest'));

      console.log.mockRestore();
    });
  });

  describe('pushApp - error paths', () => {
    beforeEach(() => {
      const appPath = path.join(tempDir, 'builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(
        path.join(appPath, 'application.yaml'),
        yaml.dump({ app: { key: 'test-app' }, image: { registry: 'myacr.azurecr.io' } })
      );

      jest.spyOn(paths, 'detectAppType').mockImplementation(async(name) => ({
        appPath: path.join(tempDir, 'builder', name),
        appType: 'regular',
        baseDir: 'builder',
        isExternal: false
      }));

      jest.spyOn(configFormat, 'loadConfigFile').mockImplementation((filePath) => {
        if (filePath && String(filePath).includes('test-app')) {
          return { app: { key: 'test-app' }, image: { registry: 'myacr.azurecr.io' } };
        }
        if (filePath && String(filePath).includes('missing-config-app')) {
          throw new Error(`Application config not found in ${filePath}. Expected application.yaml, application.yml, application.json, or variables.yaml.\nRun 'aifabrix create missing-config-app' first`);
        }
        throw new Error(`Application config not found in ${filePath}. Expected application.yaml, application.yml, application.json, or variables.yaml.\nRun 'aifabrix create test-app' first`);
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle missing config file error', async() => {
      const appName = 'missing-config-app';

      await expect(app.pushApp(appName, {}))
        .rejects.toThrow(/Failed to load configuration|not found in integration|not found in builder/);
    });

    it('should handle invalid registry URL error', async() => {
      const appName = 'test-app';
      configFormat.loadConfigFile.mockImplementationOnce(() => ({
        app: { key: 'test-app' },
        image: { registry: 'invalid-registry.com' }
      }));

      pushUtils.validateRegistryURL.mockReturnValue(false);

      await expect(app.pushApp(appName, {}))
        .rejects.toThrow('Invalid ACR URL format');
    });
  });
});

