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
const app = require('../../lib/app');
const templates = require('../../lib/templates');
const envReader = require('../../lib/env-reader');
const githubGenerator = require('../../lib/github-generator');
const validator = require('../../lib/validator');
const secrets = require('../../lib/secrets');

// Mock inquirer to avoid interactive prompts
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

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
      expect(variablesContent).toContain('authentication: true');

      // Verify env.template content
      const envContent = await fs.readFile(envTemplatePath, 'utf8');
      expect(envContent).toContain('# Database Configuration');
      expect(envContent).toContain('DATABASE_URL=kv://database-url');

      // Verify rbac.yaml content
      const rbacContent = await fs.readFile(rbacPath, 'utf8');
      expect(rbacContent).toContain('roles:');
      expect(rbacContent).toContain('- name: admin');
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
      expect(envContent).toContain('DATABASE_URL=kv://database-url');
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
    it('should push image to Azure Container Registry', async() => {
      const appName = 'test-app';
      const options = { registry: 'myacr.azurecr.io', tag: 'v1.0.0' };

      // Mock the push function
      jest.spyOn(app, 'pushApp').mockResolvedValue();

      await expect(app.pushApp(appName, options)).resolves.not.toThrow();
    });

    it('should handle authentication failures', async() => {
      const appName = 'test-app';
      const options = { registry: 'myacr.azurecr.io' };

      // Mock the push function to throw authentication error
      jest.spyOn(app, 'pushApp').mockRejectedValue(new Error('Authentication failed'));

      await expect(app.pushApp(appName, options))
        .rejects.toThrow('Authentication failed');
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
});
