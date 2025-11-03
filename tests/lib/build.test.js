/**
 * Tests for AI Fabrix Builder Build Module
 *
 * @fileoverview Unit tests for build.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const build = require('../../lib/build');
const validator = require('../../lib/validator');
const secrets = require('../../lib/secrets');

// Mock inquirer to avoid interactive prompts
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock util.promisify to prevent actual Docker commands
jest.mock('util', () => ({
  promisify: jest.fn(() => jest.fn().mockResolvedValue({
    stdout: 'Build successful',
    stderr: ''
  }))
}));

describe('Build Module', () => {
  let tempDir;

  beforeEach(async() => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aifabrix-test-'));
    process.chdir(tempDir);
  });

  afterEach(async() => {
    process.chdir(require('os').homedir());
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('loadVariablesYaml', () => {
    it('should load and parse variables.yaml file', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      await fs.mkdir(appPath, { recursive: true });

      const mockConfig = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`
      };

      // Create variables.yaml
      const variablesPath = path.join(appPath, 'variables.yaml');
      await fs.writeFile(variablesPath, yaml.dump(mockConfig));

      const result = await build.loadVariablesYaml(appName);
      expect(result).toEqual(mockConfig);
    });

    it('should throw error if variables.yaml not found', async() => {
      await expect(build.loadVariablesYaml('nonexistent-app'))
        .rejects.toThrow('Configuration not found. Run \'aifabrix create nonexistent-app\' first.');
    });

    it('should throw error for invalid YAML syntax', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      await fs.mkdir(appPath, { recursive: true });

      const variablesPath = path.join(appPath, 'variables.yaml');
      await fs.writeFile(variablesPath, 'invalid: yaml: content: [[');

      await expect(build.loadVariablesYaml(appName))
        .rejects.toThrow('Invalid YAML syntax in variables.yaml');
    });
  });

  describe('resolveContextPath', () => {
    it('should return current directory if no context path provided', () => {
      const result = build.resolveContextPath('/builder/test-app', '');
      expect(result).toBe(process.cwd());
    });

    it('should resolve relative context path', async() => {
      const builderPath = path.join(process.cwd(), 'builder', 'test-app');
      const contextPath = 'src';

      // Create the context directory that the resolved path will point to
      const resolvedPath = path.resolve(builderPath, contextPath);
      await fs.mkdir(resolvedPath, { recursive: true });

      const result = build.resolveContextPath(builderPath, contextPath);
      expect(result).toBe(resolvedPath);
      expect(fsSync.existsSync(result)).toBe(true);
    });

    it('should throw error if context path does not exist', () => {
      const builderPath = path.join(process.cwd(), 'builder', 'test-app');
      const contextPath = 'nonexistent';

      expect(() => build.resolveContextPath(builderPath, contextPath))
        .toThrow('Build context not found');
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript from package.json', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      const result = build.detectLanguage(appPath);
      expect(result).toBe('typescript');
    });

    it('should detect Python from requirements.txt', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      await fs.writeFile(path.join(appPath, 'requirements.txt'), 'flask==2.0.0');

      const result = build.detectLanguage(appPath);
      expect(result).toBe('python');
    });

    it('should detect Python from pyproject.toml', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      await fs.writeFile(path.join(appPath, 'pyproject.toml'), '[project]\nname = "test-app"');

      const result = build.detectLanguage(appPath);
      expect(result).toBe('python');
    });

    it('should throw error for custom Dockerfile', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      await fs.writeFile(path.join(appPath, 'Dockerfile'), 'FROM node:18');

      expect(() => build.detectLanguage(appPath))
        .toThrow('Custom Dockerfile found. Use --force-template to regenerate from template.');
    });

    it('should default to typescript if no indicators found', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const result = build.detectLanguage(appPath);
      expect(result).toBe('typescript');
    });
  });

  describe('generateDockerfile', () => {
    it('should generate TypeScript Dockerfile from template', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const config = {
        port: 3000,
        healthCheck: {
          interval: 30,
          path: '/health'
        },
        startupCommand: 'npm start'
      };

      const dockerfilePath = await build.generateDockerfile(appPath, 'typescript', config);

      expect(dockerfilePath).toMatch(/[\\/]\.aifabrix[\\/]test-app[\\/]Dockerfile\.typescript$/);

      const dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
      expect(dockerfileContent).toContain('FROM node:20-alpine');
      expect(dockerfileContent).toContain('EXPOSE 3000');
      expect(dockerfileContent).toContain('HEALTHCHECK --interval=30s');
      expect(dockerfileContent).toContain('CMD ["npm start"]');
    });

    it('should generate Python Dockerfile from template', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const config = {
        port: 8080,
        healthCheck: {
          interval: 60,
          path: '/health'
        },
        startupCommand: 'python app.py'
      };

      const dockerfilePath = await build.generateDockerfile(appPath, 'python', config);

      expect(dockerfilePath).toMatch(/[\\/]\.aifabrix[\\/]test-app[\\/]Dockerfile\.python$/);

      const dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
      expect(dockerfileContent).toContain('FROM python:3.11-alpine');
      expect(dockerfileContent).toContain('EXPOSE 8080');
      expect(dockerfileContent).toContain('HEALTHCHECK --interval=60s');
      expect(dockerfileContent).toContain('CMD ["python app.py"]');
    });

    it('should throw error for unsupported language', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'test-app');
      await fs.mkdir(appPath, { recursive: true });

      const config = { port: 3000 };

      await expect(build.generateDockerfile(appPath, 'unsupported', config))
        .rejects.toThrow('Template not found for language: unsupported');
    });
  });

  describe('buildApp', () => {
    it('should build application with generated Dockerfile', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      await fs.mkdir(appPath, { recursive: true });

      // Create variables.yaml
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Create package.json for language detection
      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      // Mock validator
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({ valid: true, errors: [] });

      // Mock secrets
      jest.spyOn(secrets, 'generateEnvFile').mockResolvedValue('/path/to/.env');

      const result = await build.buildApp(appName);
      expect(result).toBe(`${appName}:latest`);
    });

    it('should use custom Dockerfile when specified', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      await fs.mkdir(appPath, { recursive: true });

      // Create variables.yaml with custom Dockerfile
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`,
        build: {
          dockerfile: 'CustomDockerfile'
        }
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Create custom Dockerfile
      await fs.writeFile(path.join(appPath, 'CustomDockerfile'), 'FROM node:18');

      // Create package.json for language detection
      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      // Mock validator
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({ valid: true, errors: [] });

      // Mock secrets
      jest.spyOn(secrets, 'generateEnvFile').mockResolvedValue('/path/to/.env');

      const result = await build.buildApp(appName);
      expect(result).toBe(`${appName}:latest`);
    });

    it('should force template regeneration when requested', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      await fs.mkdir(appPath, { recursive: true });

      // Create variables.yaml
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Create package.json for language detection
      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      // Mock validator
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({ valid: true, errors: [] });

      // Mock secrets
      jest.spyOn(secrets, 'generateEnvFile').mockResolvedValue('/path/to/.env');

      const result = await build.buildApp(appName, { forceTemplate: true });
      expect(result).toBe(`${appName}:latest`);
    });

    it('should handle validation errors', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      await fs.mkdir(appPath, { recursive: true });

      // Create variables.yaml with invalid port
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 99999, // Invalid port
        image: `${appName}:latest`
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Mock validator to return errors
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({
        valid: false,
        errors: ['Port must be between 1 and 65535']
      });

      await expect(build.buildApp(appName))
        .rejects.toThrow('Configuration validation failed');
    });

    it.skip('should handle Docker build errors', async() => {
      const appName = 'test-app';
      const appPath = path.join(process.cwd(), 'builder', appName);
      await fs.mkdir(appPath, { recursive: true });

      // Create variables.yaml
      const variablesPath = path.join(appPath, 'variables.yaml');
      const config = {
        name: appName,
        port: 3000,
        image: `${appName}:latest`
      };
      await fs.writeFile(variablesPath, yaml.dump(config));

      // Create package.json for language detection
      await fs.writeFile(path.join(appPath, 'package.json'), '{"name": "test-app"}');

      // Mock validator
      jest.spyOn(validator, 'validateVariables').mockResolvedValue({ valid: true, errors: [] });

      // Mock Docker build to fail
      const util = require('util');
      util.promisify = jest.fn(() => jest.fn().mockRejectedValue(new Error('Docker build failed')));

      await expect(build.buildApp(appName))
        .rejects.toThrow('Build failed: Docker build failed');
    });
  });
});
