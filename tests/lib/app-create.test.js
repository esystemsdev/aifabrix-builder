/**
 * Tests for AI Fabrix Builder Application Creation Module
 *
 * @fileoverview Unit tests for app-create.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const app = require('../../lib/app');

// Mock inquirer to avoid interactive prompts
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock GitHub generator
jest.mock('../../lib/github-generator', () => ({
  generateGithubWorkflows: jest.fn().mockResolvedValue([
    '.github/workflows/ci.yaml',
    '.github/workflows/release.yaml',
    '.github/workflows/pr-checks.yaml'
  ])
}));

describe('Application Create Module', () => {
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
      expect(variablesContent).toContain('requireAuth: true');

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

      // Mock the GitHub generator to track calls
      const githubGenerator = require('../../lib/github-generator');
      const generateWorkflowsSpy = jest.spyOn(githubGenerator, 'generateGithubWorkflows');

      await app.createApp(appName, options);

      // Verify GitHub generator was called
      expect(generateWorkflowsSpy).toHaveBeenCalledWith(
        process.cwd(),
        expect.objectContaining({
          appName,
          port: 3000,
          language: 'typescript'
        }),
        expect.objectContaining({
          mainBranch: 'main',
          uploadCoverage: true,
          githubSteps: []
        })
      );

      generateWorkflowsSpy.mockRestore();
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

  describe('validateAppName', () => {
    it('should accept valid app names', async() => {
      // Just test that valid names don't throw during creation attempt
      // The actual validation happens in createApp
      await expect(app.createApp('valid-app', { port: 3000, language: 'typescript' })).resolves.not.toThrow();
      await expect(app.createApp('app123', { port: 3000, language: 'typescript' })).resolves.not.toThrow();
    });

    it('should reject invalid characters', () => {
      // These will be caught during createApp execution
      // The actual validation happens in createApp's validateAppName
      expect(app.createApp('My App', {})).rejects.toThrow();
      expect(app.createApp('my_app', {})).rejects.toThrow();
      expect(app.createApp('my.app', {})).rejects.toThrow();
    });

    it('should reject names starting with dash', () => {
      expect(app.createApp('-myapp', {})).rejects.toThrow();
    });

    it('should reject names ending with dash', () => {
      expect(app.createApp('myapp-', {})).rejects.toThrow();
    });

    it('should reject consecutive dashes', () => {
      expect(app.createApp('my--app', {})).rejects.toThrow();
    });
  });
});

