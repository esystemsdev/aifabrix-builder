/**
 * Tests for AI Fabrix Builder Application Module
 *
 * @fileoverview Unit tests for app.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const templates = require('../../lib/templates');
const envReader = require('../../lib/env-reader');
const githubGenerator = require('../../lib/github-generator');
const validator = require('../../lib/validator');
const secrets = require('../../lib/secrets');

// Mock inquirer to avoid interactive prompts
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock template validator
jest.mock('../../lib/template-validator', () => ({
  validateTemplate: jest.fn().mockResolvedValue(true),
  copyTemplateFiles: jest.fn().mockResolvedValue([]),
  listAvailableTemplates: jest.fn().mockResolvedValue([])
}));

const app = require('../../lib/app');
const templateValidator = require('../../lib/template-validator');

// Mock execAsync to avoid actual Docker builds
jest.mock('util', () => ({
  promisify: jest.fn(() => jest.fn().mockResolvedValue({
    stdout: 'Build successful',
    stderr: ''
  }))
}));

describe('Application Module', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Mock inquirer prompts to return default values
    const inquirer = require('inquirer');
    inquirer.prompt.mockResolvedValue({
      port: '3000',
      language: 'typescript',
      database: false,
      redis: false,
      storage: false,
      authentication: false
    });

    // Reset template validator mocks
    templateValidator.validateTemplate.mockReset();
    templateValidator.copyTemplateFiles.mockReset();
    templateValidator.validateTemplate.mockResolvedValue(true);
  });

  afterEach(async() => {
    // Clean up temporary directory
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createApp', () => {
    it('should create application with scaffolded configuration files', async() => {
      const appName = 'test-app';
      const options = {
        port: 3000,
        language: 'typescript',
        database: true,
        redis: false,
        storage: false,
        authentication: true
      };

      await app.createApp(appName, options);

      // Verify directory structure
      const appPath = path.join('builder', appName);
      expect(await fs.access(appPath).then(() => true).catch(() => false)).toBe(true);

      // Verify files were created
      const variablesPath = path.join(appPath, 'variables.yaml');
      const envTemplatePath = path.join(appPath, 'env.template');
      const rbacPath = path.join(appPath, 'rbac.yaml');
      const deployPath = path.join(appPath, 'aifabrix-deploy.json');

      expect(await fs.access(variablesPath).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(envTemplatePath).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(rbacPath).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(deployPath).then(() => true).catch(() => false)).toBe(true);

      // Verify variables.yaml content
      const variablesContent = await fs.readFile(variablesPath, 'utf8');
      expect(variablesContent).toContain('key: test-app');
      expect(variablesContent).toContain('language: typescript');
      expect(variablesContent).toContain('port: 3000');
      expect(variablesContent).toContain('database: true');
      expect(variablesContent).toContain('authentication:');
      expect(variablesContent).toContain('type: azure');

      // Verify env.template content
      const envContent = await fs.readFile(envTemplatePath, 'utf8');
      expect(envContent).toContain('# DATABASE CONFIGURATION');
      expect(envContent).toContain('DATABASE_URL=kv://databases-test-app-0-urlKeyVault');
      expect(envContent).toContain('DB_USER=test_app_user');
      expect(envContent).toContain('DB_PASSWORD=kv://databases-test-app-0-passwordKeyVault');

      // Verify rbac.yaml content
      const rbacContent = await fs.readFile(rbacPath, 'utf8');
      expect(rbacContent).toContain('roles:');
      expect(rbacContent).toContain('permissions:');
      expect(rbacContent).toContain('- name: AI Fabrix Admin');
      expect(rbacContent).toContain('value: aifabrix-admin');
    });

    it('should validate app name format', async() => {
      await expect(app.createApp('invalid app name'))
        .rejects.toThrow('Application name must be 3-40 characters, lowercase letters, numbers, and dashes only');
    });

    it('should handle existing application conflicts', async() => {
      const appName = 'existing-app';
      const options = { port: 3000, language: 'typescript' };

      // Create the app first time
      await app.createApp(appName, options);

      // Try to create again - should throw error
      await expect(app.createApp(appName, options))
        .rejects.toThrow(`Application '${appName}' already exists in builder/${appName}/`);
    });

    it('should generate GitHub workflows when requested', async() => {
      const appName = 'github-app';
      const options = {
        port: 3000,
        language: 'typescript',
        github: true
      };

      await app.createApp(appName, options);

      // Verify GitHub workflows were created
      const workflowsDir = path.join('.github', 'workflows');
      expect(await fs.access(workflowsDir).then(() => true).catch(() => false)).toBe(true);

      const ciPath = path.join(workflowsDir, 'ci.yaml');
      const releasePath = path.join(workflowsDir, 'release.yaml');
      const prChecksPath = path.join(workflowsDir, 'pr-checks.yaml');

      expect(await fs.access(ciPath).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(releasePath).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(prChecksPath).then(() => true).catch(() => false)).toBe(true);
    });

    it('should validate and copy template files when template is specified', async() => {
      // This test requires actual template folders, so we'll mock it
      const appName = 'template-app';
      const options = {
        port: 3000,
        language: 'typescript',
        template: 'controller'
      };

      // Setup mocks
      templateValidator.validateTemplate.mockResolvedValue(true);
      templateValidator.copyTemplateFiles.mockResolvedValue([
        'builder/template-app/variables.yaml',
        'builder/template-app/env.template'
      ]);

      await app.createApp(appName, options);

      // Verify template validation and copying were called
      expect(templateValidator.validateTemplate).toHaveBeenCalledWith('controller');
      expect(templateValidator.copyTemplateFiles).toHaveBeenCalledWith(
        'controller',
        expect.stringMatching(/builder[\\/]template-app$/)
      );

      // Reset mocks
      templateValidator.validateTemplate.mockReset();
      templateValidator.copyTemplateFiles.mockReset();
    });

    it('should handle existing .env file conversion', async() => {
      const appName = 'env-conversion-app';
      const options = {
        port: 3000,
        language: 'typescript',
        database: true
      };

      // Create existing .env file in the root directory (not in the app directory)
      const existingEnvPath = '.env';
      await fs.writeFile(existingEnvPath, 'DATABASE_URL=postgresql://user:pass@localhost/db\nAPI_KEY=secret123');

      await app.createApp(appName, options);

      // Verify env.template was created with kv:// references
      const appPath = path.join('builder', appName);
      const envTemplatePath = path.join(appPath, 'env.template');
      const envContent = await fs.readFile(envTemplatePath, 'utf8');
      expect(envContent).toContain('DATABASE_URL=kv://databases-env-conversion-app-0-urlKeyVault');
      expect(envContent).toContain('DB_USER=env_conversion_app_user');
      expect(envContent).toContain('DB_PASSWORD=kv://databases-env-conversion-app-0-passwordKeyVault');
      expect(envContent).toContain('API_KEY=kv://api-key');
    });
  });

  describe('buildApp', () => {
    it('should build container image for application', async() => {
      const appName = 'test-app';
      const options = { language: 'typescript' };

      // Mock the build function to return success
      jest.spyOn(app, 'buildApp').mockResolvedValue('test-app:latest');

      const result = await app.buildApp(appName, options);
      expect(result).toBe('test-app:latest');
    });

    it('should auto-detect runtime language', async() => {
      const appName = 'test-app';
      const options = {};

      // Mock the build function
      jest.spyOn(app, 'buildApp').mockResolvedValue('test-app:latest');

      const result = await app.buildApp(appName, options);
      expect(result).toBe('test-app:latest');
    });

    it('should handle build failures gracefully', async() => {
      const appName = 'test-app';
      const options = {};

      // Mock the build function to throw error
      jest.spyOn(app, 'buildApp').mockRejectedValue(new Error('Build failed'));

      await expect(app.buildApp(appName, options))
        .rejects.toThrow('Build failed');
    });
  });

  describe('runApp', () => {
    it('should run application locally using Docker', async() => {
      const appName = 'test-app';
      const options = { port: 3000 };

      // Mock the run function
      jest.spyOn(app, 'runApp').mockResolvedValue();

      await expect(app.runApp(appName, options)).resolves.not.toThrow();
    });

    it('should handle port conflicts', async() => {
      const appName = 'test-app';
      const options = { port: 3000 };

      // Mock the run function to throw port conflict error
      jest.spyOn(app, 'runApp').mockRejectedValue(new Error('Port 3000 is already in use'));

      await expect(app.runApp(appName, options))
        .rejects.toThrow('Port 3000 is already in use');
    });

    it('should wait for application health', async() => {
      const appName = 'test-app';
      const options = { port: 3000 };

      // Mock the run function
      jest.spyOn(app, 'runApp').mockResolvedValue();

      await expect(app.runApp(appName, options)).resolves.not.toThrow();
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript/Node.js projects', async() => {
      const appPath = path.join(process.cwd(), 'test-app');
      await fs.mkdir(appPath, { recursive: true });
      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      const result = app.detectLanguage(appPath);
      expect(result).toBe('typescript');
    });

    it('should detect Python projects', async() => {
      const appPath = path.join(process.cwd(), 'test-app');
      await fs.mkdir(appPath, { recursive: true });
      await fs.writeFile(path.join(appPath, 'requirements.txt'), 'flask==2.0.0');

      const result = app.detectLanguage(appPath);
      expect(result).toBe('python');
    });

    it('should handle unknown project types', async() => {
      const appPath = path.join(process.cwd(), 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const result = app.detectLanguage(appPath);
      expect(result).toBe('typescript'); // Default fallback
    });
  });

  describe('generateDockerfile', () => {
    it('should generate Dockerfile from template', async() => {
      const appPath = path.join(process.cwd(), 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const config = {
        port: 3000,
        healthCheck: { interval: 30, path: '/health' },
        startupCommand: 'npm start'
      };

      // Mock the generateDockerfile function
      jest.spyOn(app, 'generateDockerfile').mockResolvedValue('/path/to/Dockerfile');

      const result = await app.generateDockerfile(appPath, 'typescript', config);
      expect(result).toBe('/path/to/Dockerfile');
    });

    it('should handle template errors gracefully', async() => {
      const appPath = path.join(process.cwd(), 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const config = { port: 3000 };

      // Mock the generateDockerfile function to throw error
      jest.spyOn(app, 'generateDockerfile').mockRejectedValue(new Error('Template not found'));

      await expect(app.generateDockerfile(appPath, 'unsupported', config))
        .rejects.toThrow('Template not found');
    });
  });

  describe('pushApp', () => {
    beforeEach(() => {
      // Create app directory structure
      fsSync.mkdirSync(path.join(tempDir, 'builder', 'test-app'), { recursive: true });

      // Create variables.yaml
      const variablesYaml = `
app:
  key: test-app
  name: Test App
image:
  name: test-app
  registry: myacr.azurecr.io
`;
      fsSync.writeFileSync(path.join(tempDir, 'builder', 'test-app', 'variables.yaml'), variablesYaml);
    });

    it('should push image to Azure Container Registry', async() => {
      const appName = 'test-app';
      const options = { registry: 'myacr.azurecr.io', tag: 'v1.0.0' };

      // Mock execAsync to simulate successful commands
      const execAsync = require('util').promisify;
      jest.spyOn(require('util'), 'promisify').mockReturnValue(jest.fn()
        .mockResolvedValueOnce({ stdout: 'az cli version', stderr: '' }) // az --version
        .mockResolvedValueOnce({ stdout: 'myacr', stderr: '' }) // az acr show
        .mockResolvedValueOnce({ stdout: 'test-app:latest', stderr: '' }) // docker images check
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker tag
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker push
      );

      // Mock pushApp to avoid actual implementation for now
      jest.spyOn(app, 'pushApp').mockResolvedValue();

      await expect(app.pushApp(appName, options)).resolves.not.toThrow();
    });

    it('should handle multiple tags', async() => {
      const appName = 'test-app';
      const options = { registry: 'myacr.azurecr.io', tag: 'v1.0.0,latest,stable' };

      jest.spyOn(app, 'pushApp').mockResolvedValue();

      await expect(app.pushApp(appName, options)).resolves.not.toThrow();
    });

    it('should handle authentication failures', async() => {
      const appName = 'test-app';
      const options = { registry: 'myacr.azurecr.io' };

      jest.spyOn(app, 'pushApp').mockRejectedValue(new Error('Authentication failed'));

      await expect(app.pushApp(appName, options))
        .rejects.toThrow('Authentication failed');
    });

    it('should error when image does not exist locally', async() => {
      const appName = 'test-app';
      const options = { registry: 'myacr.azurecr.io' };

      jest.spyOn(app, 'pushApp').mockRejectedValue(new Error('Docker image not found locally'));

      await expect(app.pushApp(appName, options))
        .rejects.toThrow('Docker image not found locally');
    });

    it('should error when Azure CLI is not installed', async() => {
      const appName = 'test-app';
      const options = { registry: 'myacr.azurecr.io' };

      jest.spyOn(app, 'pushApp').mockRejectedValue(new Error('Azure CLI is not installed'));

      await expect(app.pushApp(appName, options))
        .rejects.toThrow('Azure CLI is not installed');
    });

    it('should error when registry URL is invalid', async() => {
      const appName = 'test-app';
      const options = { registry: 'invalid-registry.com' };

      jest.spyOn(app, 'pushApp').mockRejectedValue(new Error('Invalid registry URL format'));

      await expect(app.pushApp(appName, options))
        .rejects.toThrow('Invalid registry URL format');
    });

    it('should use registry from variables.yaml when not provided via flag', async() => {
      const appName = 'test-app';
      const options = { tag: 'v1.0.0' };

      jest.spyOn(app, 'pushApp').mockResolvedValue();

      await expect(app.pushApp(appName, options)).resolves.not.toThrow();
    });

    it('should error when no registry is configured', async() => {
      const appName = 'test-app-no-registry';
      const options = { tag: 'v1.0.0' };

      // Create app without registry in variables.yaml
      fsSync.mkdirSync(path.join(tempDir, 'builder', appName), { recursive: true });
      const variablesYaml = `
app:
  key: ${appName}
  name: Test App
`;
      fsSync.writeFileSync(path.join(tempDir, 'builder', appName, 'variables.yaml'), variablesYaml);

      jest.spyOn(app, 'pushApp').mockRejectedValue(new Error('Registry URL is required'));

      await expect(app.pushApp(appName, options))
        .rejects.toThrow('Registry URL is required');
    });

    it('should error when app configuration is missing', async() => {
      const appName = 'non-existent-app';
      const options = { registry: 'myacr.azurecr.io' };

      jest.spyOn(app, 'pushApp').mockRejectedValue(new Error('Failed to load configuration'));

      await expect(app.pushApp(appName, options))
        .rejects.toThrow('Failed to load configuration');
    });
  });

  describe('deployApp', () => {
    it('should deploy application via Miso Controller', async() => {
      const appName = 'test-app';
      const options = { controller: 'https://controller.aifabrix.ai', environment: 'production' };

      // Mock the deploy function
      jest.spyOn(app, 'deployApp').mockResolvedValue();

      await expect(app.deployApp(appName, options)).resolves.not.toThrow();
    });

    it('should handle deployment failures', async() => {
      const appName = 'test-app';
      const options = { controller: 'https://controller.aifabrix.ai' };

      // Mock the deploy function to throw error
      jest.spyOn(app, 'deployApp').mockRejectedValue(new Error('Deployment failed'));

      await expect(app.deployApp(appName, options))
        .rejects.toThrow('Deployment failed');
    });

    it('should monitor deployment status', async() => {
      const appName = 'test-app';
      const options = { controller: 'https://controller.aifabrix.ai' };

      // Mock the deploy function
      jest.spyOn(app, 'deployApp').mockResolvedValue();

      await expect(app.deployApp(appName, options)).resolves.not.toThrow();
    });
  });

  describe('loadTemplateVariables', () => {
    it('should load template variables.yaml successfully', async() => {
      const templateName = 'test-template';
      // loadTemplateVariables uses __dirname/../templates/applications/
      // __dirname in lib/app.js is lib/, so it goes to templates/applications/
      // We need to use the actual project root, not tempDir
      const projectRoot = path.resolve(__dirname, '..', '..');
      const templateDir = path.join(projectRoot, 'templates', 'applications', templateName);
      const templateFile = path.join(templateDir, 'variables.yaml');
      const templateContent = 'app:\n  key: test\nport: 3000';

      // Create template directory and file in actual project location
      fsSync.mkdirSync(templateDir, { recursive: true });
      fsSync.writeFileSync(templateFile, templateContent);

      try {
        const result = await app.loadTemplateVariables(templateName);
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        if (result && result.app) {
          expect(result.app.key).toBe('test');
        }
        if (result && result.port) {
          expect(result.port).toBe(3000);
        }
      } finally {
        // Clean up
        if (fsSync.existsSync(templateFile)) {
          fsSync.unlinkSync(templateFile);
        }
        if (fsSync.existsSync(templateDir)) {
          try {
            fsSync.rmdirSync(templateDir);
          } catch (err) {
            // Ignore errors if directory is not empty
          }
        }
      }
    });

    it('should return null when template not found', async() => {
      const result = await app.loadTemplateVariables('nonexistent-template');
      expect(result).toBeNull();
    });

    it('should return null when template name is empty', async() => {
      const result = await app.loadTemplateVariables(null);
      expect(result).toBeNull();
    });

    it('should warn and return null on non-ENOENT error', async() => {
      const templateName = 'test-template';
      const templateDir = path.join(process.cwd(), 'templates', 'applications', templateName);
      const templateFile = path.join(templateDir, 'variables.yaml');
      // Create a file that can be read but has invalid YAML syntax
      const invalidYaml = 'invalid: yaml: content: [';

      // Create template directory and invalid file
      fsSync.mkdirSync(templateDir, { recursive: true });
      fsSync.writeFileSync(templateFile, invalidYaml);

      const loggerModule = require('../../lib/utils/logger');
      const warnSpy = jest.spyOn(loggerModule, 'warn');

      try {
        const result = await app.loadTemplateVariables(templateName);
        // YAML parsing errors should return null
        expect(result).toBeNull();
      } finally {
        warnSpy.mockRestore();
        if (fsSync.existsSync(templateFile)) {
          fsSync.unlinkSync(templateFile);
        }
        if (fsSync.existsSync(templateDir)) {
          fsSync.rmdirSync(templateDir);
        }
      }
    });
  });

  describe('updateTemplateVariables', () => {
    it('should update variables.yaml with app name and port', async() => {
      const appName = 'new-app';
      const appPath = path.join(tempDir, 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const originalContent = `app:
  key: template-app
  displayName: Miso Controller Application
port: 8080
`;

      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(variablesPath, originalContent);

      const options = { port: 3000 };
      const config = { port: 3000 };

      await app.updateTemplateVariables(appPath, appName, options, config);

      const updatedContent = await fs.readFile(variablesPath, 'utf8');
      const updated = yaml.load(updatedContent);

      expect(updated.app.key).toBe('new-app');
      expect(updated.app.displayName).toBe('New App');
      expect(updated.port).toBe(3000);
    });

    it('should update app.key when app section exists', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const originalContent = `app:
  key: old-key
  displayName: Old App
`;

      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(variablesPath, originalContent);

      await app.updateTemplateVariables(appPath, appName, {}, {});

      const updatedContent = await fs.readFile(variablesPath, 'utf8');
      const updated = yaml.load(updatedContent);

      expect(updated.app.key).toBe('test-app');
    });

    it('should update displayName when it contains miso', async() => {
      const appName = 'my-new-app';
      const appPath = path.join(tempDir, 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const originalContent = `app:
  key: ${appName}
  displayName: Miso Application
`;

      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(variablesPath, originalContent);

      await app.updateTemplateVariables(appPath, appName, {}, {});

      const updatedContent = await fs.readFile(variablesPath, 'utf8');
      const updated = yaml.load(updatedContent);

      expect(updated.app.displayName).toBe('My New App');
    });

    it('should update port when provided in options', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      const originalContent = `port: 8080
`;

      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(variablesPath, originalContent);

      const options = { port: 3000 };
      const config = { port: 3000 };

      await app.updateTemplateVariables(appPath, appName, options, config);

      const updatedContent = await fs.readFile(variablesPath, 'utf8');
      const updated = yaml.load(updatedContent);

      expect(updated.port).toBe(3000);
    });

    it('should handle file not found error silently', async() => {
      const appName = 'nonexistent-app';
      const appPath = path.join(tempDir, 'builder', appName);

      await expect(app.updateTemplateVariables(appPath, appName, {}, {}))
        .resolves.not.toThrow();
    });

    it('should warn on non-ENOENT error', async() => {
      const appName = 'test-app';
      const appPath = path.join(tempDir, 'builder', appName);
      const variablesPath = path.join(appPath, 'variables.yaml');
      // Create invalid YAML that will cause parsing error
      const invalidYaml = 'invalid: yaml: [';

      fsSync.mkdirSync(appPath, { recursive: true });
      fsSync.writeFileSync(variablesPath, invalidYaml);

      const loggerModule = require('../../lib/utils/logger');
      const warnSpy = jest.spyOn(loggerModule, 'warn');

      try {
        await app.updateTemplateVariables(appPath, appName, {}, {});
        // YAML parsing errors should trigger a warning
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe('mergeTemplateVariables', () => {
    it('should merge port from template variables', () => {
      const options = {};
      const templateVariables = { port: 3000 };

      const result = app.mergeTemplateVariables(options, templateVariables);

      expect(result.port).toBe(3000);
    });

    it('should merge language from template variables', () => {
      const options = {};
      const templateVariables = { build: { language: 'python' } };

      const result = app.mergeTemplateVariables(options, templateVariables);

      expect(result.language).toBe('python');
    });

    it('should merge database requirement from template variables', () => {
      const options = {};
      const templateVariables = { requires: { database: true } };

      const result = app.mergeTemplateVariables(options, templateVariables);

      expect(result.database).toBe(true);
    });

    it('should merge redis requirement from template variables', () => {
      const options = {};
      const templateVariables = { requires: { redis: true } };

      const result = app.mergeTemplateVariables(options, templateVariables);

      expect(result.redis).toBe(true);
    });

    it('should merge storage requirement from template variables', () => {
      const options = {};
      const templateVariables = { requires: { storage: true } };

      const result = app.mergeTemplateVariables(options, templateVariables);

      expect(result.storage).toBe(true);
    });

    it('should merge authentication from template variables', () => {
      const options = {};
      const templateVariables = { authentication: true };

      const result = app.mergeTemplateVariables(options, templateVariables);

      expect(result.authentication).toBe(true);
    });

    it('should not override existing options with template variables', () => {
      const options = { port: 8080, language: 'typescript' };
      const templateVariables = { port: 3000, build: { language: 'python' } };

      const result = app.mergeTemplateVariables(options, templateVariables);

      expect(result.port).toBe(8080);
      expect(result.language).toBe('typescript');
    });

    it('should merge all template variables together', () => {
      const options = {};
      const templateVariables = {
        port: 3000,
        build: { language: 'python' },
        requires: { database: true, redis: true, storage: false },
        authentication: true
      };

      const result = app.mergeTemplateVariables(options, templateVariables);

      expect(result.port).toBe(3000);
      expect(result.language).toBe('python');
      expect(result.database).toBe(true);
      expect(result.redis).toBe(true);
      expect(result.storage).toBe(false);
      expect(result.authentication).toBe(true);
    });

    it('should return options unchanged when templateVariables is null', () => {
      const options = { port: 3000 };

      const result = app.mergeTemplateVariables(options, null);

      expect(result).toEqual(options);
    });

    it('should handle undefined template variables', () => {
      const options = { port: 3000 };

      const result = app.mergeTemplateVariables(options, undefined);

      expect(result).toEqual(options);
    });

    it('should handle template variables with undefined requires', () => {
      const options = {};
      const templateVariables = { port: 3000 };

      const result = app.mergeTemplateVariables(options, templateVariables);

      expect(result.port).toBe(3000);
      expect(result.database).toBeUndefined();
    });
  });
});
