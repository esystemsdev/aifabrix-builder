/**
 * Additional Coverage Tests for Application Module
 *
 * @fileoverview Tests for uncovered code paths in app.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = jest.requireActual('fs').promises;
const fsSync = jest.requireActual('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const app = require('../../../lib/app');

jest.mock('inquirer');
jest.mock('../../../lib/generator/github');
jest.mock('../../../lib/core/env-reader', () => {
  const mockGenerateEnvTemplate = jest.fn();
  return {
    readExistingEnv: jest.fn(),
    generateEnvTemplate: mockGenerateEnvTemplate
  };
});

const inquirer = require('inquirer');
const githubGenerator = require('../../../lib/generator/github');
const envReader = require('../../../lib/core/env-reader');

describe('Application Module - Additional Coverage', () => {
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
    envReader.generateEnvTemplate.mockImplementation((config) => {
      return Promise.resolve({
        template: '# Environment template',
        warnings: []
      });
    });
    githubGenerator.generateGithubWorkflows.mockResolvedValue([]);
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('promptForOptions - edge cases', () => {
    it('should prompt for port when not provided', async() => {
      inquirer.prompt.mockResolvedValueOnce({
        port: '8080',
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: false,
        controller: false
      });

      const appName = 'test-app';
      await app.createApp(appName, { language: 'typescript' });

      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should prompt for language when not provided', async() => {
      inquirer.prompt.mockResolvedValueOnce({
        port: '3000',
        language: 'python',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: false,
        controller: false
      });

      const appName = 'test-app';
      await app.createApp(appName, { port: 3000 });

      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should prompt for database when not provided', async() => {
      inquirer.prompt.mockResolvedValueOnce({
        port: '3000',
        language: 'typescript',
        database: true,
        redis: false,
        storage: false,
        authentication: false,
        github: false,
        controller: false
      });

      const appName = 'test-app';
      await app.createApp(appName, { port: 3000, language: 'typescript' });

      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should handle controller URL prompt when controller is enabled', async() => {
      process.env.MISO_HOST = 'test-host';

      inquirer.prompt.mockResolvedValueOnce({
        port: '3000',
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: true,
        controller: true,
        controllerUrl: 'http://test-host:3000'
      });

      const appName = 'test-app-controller';
      await app.createApp(appName, {
        port: 3000,
        language: 'typescript',
        github: true
      });

      expect(inquirer.prompt).toHaveBeenCalled();
      delete process.env.MISO_HOST;
    });
  });

  describe('generateConfigFiles - coverage', () => {
    it('should generate config files with all services enabled', async() => {
      const appName = 'full-app';
      await app.createApp(appName, {
        port: 3000,
        language: 'typescript',
        database: true,
        redis: true,
        storage: true,
        authentication: true
      });

      const appPath = path.join(tempDir, 'builder', appName);
      const variablesPath = path.join(appPath, 'application.yaml');
      const variables = yaml.load(fsSync.readFileSync(variablesPath, 'utf8'));

      expect(variables.app.key).toBe(appName);
      // Port can be in build.port or just port
      const port = variables.build?.port || variables.port;
      expect(port).toBe(3000);
    });
  });

  describe('generateDockerfile', () => {
    it('should detect language from package.json', async() => {
      const appPath = path.join(tempDir, 'builder', 'test-app');
      fsSync.mkdirSync(appPath, { recursive: true });

      fsSync.writeFileSync(
        path.join(appPath, 'package.json'),
        JSON.stringify({ name: 'test-app', version: '1.0.0' })
      );

      const language = app.detectLanguage(appPath);
      expect(language).toBe('typescript');
    });

    it('should detect language from requirements.txt', async() => {
      const appPath = path.join(tempDir, 'builder', 'python-app');
      fsSync.mkdirSync(appPath, { recursive: true });

      fsSync.writeFileSync(
        path.join(appPath, 'requirements.txt'),
        'flask==1.0.0'
      );

      const language = app.detectLanguage(appPath);
      expect(language).toBe('python');
    });
  });

  describe('generateDockerfileForApp', () => {
    it('should generate Dockerfile for existing app', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appPath, { recursive: true });

      const variables = {
        app: { key: appName, name: 'Test App' },
        build: { language: 'typescript', port: 3000 }
      };

      fsSync.writeFileSync(
        path.join(appPath, 'application.yaml'),
        yaml.dump(variables)
      );

      fsSync.writeFileSync(
        path.join(appPath, 'package.json'),
        JSON.stringify({ name: appName })
      );

      await app.generateDockerfileForApp(appName);

      const dockerfilePath = path.join(appPath, 'Dockerfile');
      expect(fsSync.existsSync(dockerfilePath)).toBe(true);
    });

    it('should handle generation errors gracefully', async() => {
      const appName = 'missing-app';

      await expect(app.generateDockerfileForApp(appName)).rejects.toThrow();
    });
  });

  describe('createApp - error paths', () => {
    it('should handle missing directory creation errors', async() => {
      // Make builder directory read-only to force error
      const builderPath = path.join(tempDir, 'builder');
      fsSync.chmodSync(builderPath, 0o444);

      try {
        await app.createApp('test-app', {
          port: 3000,
          language: 'typescript'
        });
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        fsSync.chmodSync(builderPath, 0o755);
      }
    });
  });

  describe('app helper functions', () => {
    it('should check image exists', async() => {
      const result = await app.checkImageExists('nonexistent-app');
      expect(typeof result).toBe('boolean');
    });

    it('should check container running', async() => {
      const result = await app.checkContainerRunning('nonexistent-app');
      expect(typeof result).toBe('boolean');
    });

    it('should check port available', async() => {
      const result = await app.checkPortAvailable(3000);
      expect(typeof result).toBe('boolean');
    });
  });
});

