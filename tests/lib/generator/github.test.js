/**
 * Tests for AI Fabrix Builder GitHub Generator Module
 *
 * @fileoverview Unit tests for github-generator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const githubGenerator = require('../../../lib/generator/github');

describe('GitHub Generator Module', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-github-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('getTemplateContext', () => {
    it('should generate correct context for TypeScript application', async() => {
      const config = {
        appName: 'test-app',
        language: 'typescript',
        port: 3000,
        database: true,
        redis: false,
        storage: false,
        authentication: true
      };

      const options = {
        mainBranch: 'main',
        uploadCoverage: true,
        githubSteps: []
      };

      const context = await githubGenerator.getTemplateContext(config, options);

      expect(context.appName).toBe('test-app');
      expect(context.mainBranch).toBe('main');
      expect(context.language).toBe('typescript');
      expect(context.fileExtension).toBe('js');
      expect(context.sourceDir).toBe('lib');
      expect(context.buildCommand).toBe('npm run build');
      expect(context.uploadCoverage).toBe(true);
      expect(context.githubSteps).toEqual([]);
      expect(context.hasSteps).toBe(false);
      expect(context.hasNpmStep).toBe(false);
      expect(context.port).toBe(3000);
      expect(context.database).toBe(true);
      expect(context.redis).toBe(false);
      expect(context.storage).toBe(false);
      expect(context.authentication).toBe(true);
    });

    it('should generate correct context for Python application', async() => {
      const config = {
        appName: 'python-app',
        language: 'python',
        port: 8000,
        database: true,
        redis: true,
        storage: true,
        authentication: false
      };

      const options = {
        mainBranch: 'develop',
        uploadCoverage: false,
        githubSteps: []
      };

      const context = await githubGenerator.getTemplateContext(config, options);

      expect(context.appName).toBe('python-app');
      expect(context.mainBranch).toBe('develop');
      expect(context.language).toBe('python');
      expect(context.fileExtension).toBe('py');
      expect(context.sourceDir).toBe('src');
      expect(context.port).toBe(8000);
      expect(context.database).toBe(true);
      expect(context.redis).toBe(true);
      expect(context.storage).toBe(true);
      expect(context.authentication).toBe(false);
    });

    it('should use default values when options are missing', async() => {
      const config = {
        appName: 'minimal-app',
        language: 'typescript'
      };

      const context = await githubGenerator.getTemplateContext(config);

      expect(context.mainBranch).toBe('main');
      expect(context.buildCommand).toBe('npm run build');
      expect(context.uploadCoverage).toBe(true);
      expect(context.githubSteps).toEqual([]);
      expect(context.hasSteps).toBe(false);
    });
  });

  describe('validateWorkflowConfig', () => {
    it('should validate correct configuration', () => {
      const config = {
        appName: 'test-app',
        language: 'typescript',
        port: 3000
      };

      const options = {
        mainBranch: 'main'
      };

      const result = githubGenerator.validateWorkflowConfig(config, options);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const config = {
        language: 'typescript'
        // missing appName
      };

      const result = githubGenerator.validateWorkflowConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Application name is required');
    });

    it('should detect invalid language', () => {
      const config = {
        appName: 'test-app',
        language: 'ruby' // invalid language
      };

      const result = githubGenerator.validateWorkflowConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Language must be either typescript or python');
    });

    it('should detect invalid port', () => {
      const config = {
        appName: 'test-app',
        language: 'typescript',
        port: 70000 // invalid port
      };

      const result = githubGenerator.validateWorkflowConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Port must be between 1 and 65535');
    });

    it('should detect invalid branch name', () => {
      const config = {
        appName: 'test-app',
        language: 'typescript'
      };

      const options = {
        mainBranch: 'main@branch' // invalid characters
      };

      const result = githubGenerator.validateWorkflowConfig(config, options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Main branch name contains invalid characters');
    });

    it('should generate warnings for common issues', () => {
      const config = {
        appName: 'python-app',
        language: 'python',
        database: false, // Python without database
        authentication: true // Auth without database
      };

      const result = githubGenerator.validateWorkflowConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Python applications typically require a database');
      expect(result.warnings).toContain('Authentication typically requires a database for user storage');
    });
  });

  describe('generateWorkflowsWithValidation', () => {
    it('should generate workflows with valid configuration', async() => {
      const config = {
        appName: 'test-app',
        language: 'typescript',
        port: 3000,
        database: true,
        redis: false,
        storage: false,
        authentication: true
      };

      const options = {
        mainBranch: 'main',
        uploadCoverage: true,
        githubSteps: []
      };

      // Mock the template files - use templates/github/ (where code expects them, root level)
      const templatesDir = path.join(process.cwd(), 'templates', 'github');
      await fs.mkdir(templatesDir, { recursive: true });

      const ciTemplate = `name: CI/CD Pipeline
on:
  push:
    branches: [{{mainBranch}}]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Run tests
        run: npm test`;

      await fs.writeFile(path.join(templatesDir, 'ci.yaml.hbs'), ciTemplate);

      const result = await githubGenerator.generateWorkflowsWithValidation(tempDir, config, options);

      expect(result.success).toBe(true);
      expect(result.validation.valid).toBe(true);
      expect(result.files).toHaveLength(5);
      expect(result.files[0]).toContain('ci.yaml');
    });

    it('should fail with invalid configuration', async() => {
      const config = {
        // missing appName
        language: 'typescript'
      };

      const result = await githubGenerator.generateWorkflowsWithValidation(tempDir, config);

      expect(result.success).toBe(false);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors).toContain('Application name is required');
      expect(result.files).toHaveLength(0);
    });

    it.skip('should handle template generation errors', async() => {
      const config = {
        appName: 'test-app',
        language: 'typescript'
      };

      // Test with invalid path to cause error
      const invalidPath = '/invalid/path/that/does/not/exist';

      await expect(
        githubGenerator.generateWorkflowsWithValidation(invalidPath, config)
      ).rejects.toThrow('Failed to generate GitHub workflows');
    });
  });

  describe('generateWorkflowFile', () => {
    it('should generate a specific workflow file', async() => {
      const config = {
        appName: 'test-app',
        language: 'typescript',
        port: 3000
      };

      const options = {
        mainBranch: 'main'
      };

      // Create template file in the real templates directory - use templates/github/ (where code expects them, root level)
      const templatesDir = path.join(process.cwd(), 'templates', 'github');
      await fs.mkdir(templatesDir, { recursive: true });

      const template = `name: Test Workflow
on:
  push:
    branches: [{{mainBranch}}]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Test {{appName}}
        run: echo "Testing {{appName}}"`;

      await fs.writeFile(path.join(templatesDir, 'test.hbs'), template);

      const result = await githubGenerator.generateWorkflowFile(tempDir, 'test', config, options);

      expect(result).toContain('test');

      // Verify generated content
      const content = await fs.readFile(result, 'utf8');
      expect(content).toContain('name: Test Workflow');
      expect(content).toContain('branches: [main]');
      expect(content).toContain('Testing test-app');
    });

    it('should handle template file not found', async() => {
      const config = {
        appName: 'test-app',
        language: 'typescript'
      };

      await expect(
        githubGenerator.generateWorkflowFile(tempDir, 'nonexistent', config)
      ).rejects.toThrow('Failed to generate workflow file nonexistent');
    });
  });
});
