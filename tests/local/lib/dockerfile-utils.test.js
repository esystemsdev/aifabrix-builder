/**
 * Tests for Dockerfile Utility Functions
 *
 * @fileoverview Unit tests for dockerfile-utils.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');

// Ensure fs is not mocked - use jest.unmock to prevent mocking
jest.unmock('fs');

// Use real fs implementation - use regular require after unmocking
const fs = require('fs').promises;
const fsSync = require('fs');
const dockerfileUtils = require('../../../lib/utils/dockerfile-utils');

jest.mock('../../../lib/utils/paths', () => {
  const actualPaths = jest.requireActual('../../../lib/utils/paths');
  return {
    ...actualPaths,
    getProjectRoot: jest.fn()
  };
});

const pathsModule = require('../../../lib/utils/paths');

describe('Dockerfile Utils', () => {
  let tempDir;
  let originalCwd;
  let realProjectRoot;

  beforeEach(async() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();

    // Get real project root and set up mock
    const { getProjectRoot: realGetProjectRoot, clearProjectRootCache } = jest.requireActual('../../../lib/utils/paths');
    clearProjectRootCache();
    realProjectRoot = realGetProjectRoot();

    // Mock getProjectRoot to return tempDir for most tests, but real root for template loading tests
    pathsModule.getProjectRoot.mockReturnValue(tempDir);

    // Create templates in tempDir for template loading tests
    const typescriptTemplateDir = path.join(tempDir, 'templates', 'typescript');
    const pythonTemplateDir = path.join(tempDir, 'templates', 'python');
    fsSync.mkdirSync(typescriptTemplateDir, { recursive: true });
    fsSync.mkdirSync(pythonTemplateDir, { recursive: true });

    // Create minimal templates using sync operations for reliability
    const tsTemplatePath = path.join(typescriptTemplateDir, 'Dockerfile.hbs');
    const pyTemplatePath = path.join(pythonTemplateDir, 'Dockerfile.hbs');
    fsSync.writeFileSync(tsTemplatePath, 'FROM node:20-alpine\nWORKDIR /app\nEXPOSE {{port}}', 'utf8');
    fsSync.writeFileSync(pyTemplatePath, 'FROM python:3.11-alpine\nWORKDIR /app\nEXPOSE {{port}}', 'utf8');

    // Verify templates were created
    expect(fsSync.existsSync(tsTemplatePath)).toBe(true);
    expect(fsSync.existsSync(pyTemplatePath)).toBe(true);
    expect(fsSync.statSync(tsTemplatePath).isFile()).toBe(true);
    expect(fsSync.statSync(pyTemplatePath).isFile()).toBe(true);

    // Change to temp directory for file path tests
    process.chdir(tempDir);
  });

  afterEach(async() => {
    // Restore original cwd - this is important for Jest's module resolution
    process.chdir(originalCwd);
    pathsModule.getProjectRoot.mockClear();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('loadDockerfileTemplate', () => {
    it('should load TypeScript Dockerfile template', () => {
      // Verify mock is set correctly
      expect(pathsModule.getProjectRoot()).toBe(tempDir);
      // Verify template exists
      const templatePath = path.join(tempDir, 'templates', 'typescript', 'Dockerfile.hbs');
      expect(fsSync.existsSync(templatePath)).toBe(true);

      const template = dockerfileUtils.loadDockerfileTemplate('typescript');
      expect(template).toBeInstanceOf(Function);
    });

    it('should load Python Dockerfile template', () => {
      // Verify mock is set correctly
      expect(pathsModule.getProjectRoot()).toBe(tempDir);
      // Verify template exists
      const templatePath = path.join(tempDir, 'templates', 'python', 'Dockerfile.hbs');
      expect(fsSync.existsSync(templatePath)).toBe(true);

      const template = dockerfileUtils.loadDockerfileTemplate('python');
      expect(template).toBeInstanceOf(Function);
    });

    it('should throw error for unsupported language', () => {
      expect(() => {
        dockerfileUtils.loadDockerfileTemplate('unsupported');
      }).toThrow('Template not found for language: unsupported');
    });
  });

  describe('renderDockerfile', () => {
    let template;

    beforeEach(() => {
      // Create a simple mock template
      template = jest.fn((vars) => {
        return `FROM node:20-alpine
WORKDIR /app
COPY . .
COPY package*.json ./
RUN npm install
EXPOSE ${vars.port || 3000}
CMD ["npm", "start"]`;
      });
    });

    it('should render Dockerfile without app flag', () => {
      const templateVars = { port: 3000 };
      const result = dockerfileUtils.renderDockerfile(template, templateVars, 'typescript', false, '');

      expect(template).toHaveBeenCalledWith(templateVars);
      expect(result).toContain('COPY . .');
      expect(result).toContain('COPY package*.json ./');
    });

    it('should replace COPY . . with app source path for TypeScript when isAppFlag is true', () => {
      const templateVars = { port: 3000 };
      const appSourcePath = 'apps/myapp/';
      const result = dockerfileUtils.renderDockerfile(template, templateVars, 'typescript', true, appSourcePath);

      expect(result).toContain(`COPY ${appSourcePath} .`);
      expect(result).not.toContain('COPY . .');
    });

    it('should replace COPY package*.json with app source path for TypeScript when isAppFlag is true', () => {
      const templateVars = { port: 3000 };
      const appSourcePath = 'apps/myapp/';
      const result = dockerfileUtils.renderDockerfile(template, templateVars, 'typescript', true, appSourcePath);

      expect(result).toContain(`COPY ${appSourcePath}package*.json ./`);
      expect(result).not.toContain('COPY package*.json ./');
    });

    it('should replace COPY . . with app source path for Python when isAppFlag is true', () => {
      const pythonTemplate = jest.fn((vars) => {
        return `FROM python:3.11-alpine
WORKDIR /app
COPY . .
COPY requirements*.txt ./
RUN pip install -r requirements.txt
EXPOSE ${vars.port || 3000}
CMD ["python", "app.py"]`;
      });

      const templateVars = { port: 8080 };
      const appSourcePath = 'apps/myapp/';
      const result = dockerfileUtils.renderDockerfile(pythonTemplate, templateVars, 'python', true, appSourcePath);

      expect(result).toContain(`COPY ${appSourcePath} .`);
      expect(result).not.toContain('COPY . .');
    });

    it('should replace COPY requirements*.txt with app source path for Python when isAppFlag is true', () => {
      const pythonTemplate = jest.fn((vars) => {
        return `FROM python:3.11-alpine
WORKDIR /app
COPY . .
COPY requirements*.txt ./
RUN pip install -r requirements.txt
EXPOSE ${vars.port || 3000}`;
      });

      const templateVars = { port: 8080 };
      const appSourcePath = 'apps/myapp/';
      const result = dockerfileUtils.renderDockerfile(pythonTemplate, templateVars, 'python', true, appSourcePath);

      expect(result).toContain(`COPY ${appSourcePath}requirements*.txt ./`);
      expect(result).not.toContain('COPY requirements*.txt ./');
    });

    it('should replace COPY requirements.txt with app source path for Python when isAppFlag is true', () => {
      const pythonTemplate = jest.fn((vars) => {
        return `FROM python:3.11-alpine
WORKDIR /app
COPY . .
COPY requirements.txt ./
RUN pip install -r requirements.txt
EXPOSE ${vars.port || 3000}`;
      });

      const templateVars = { port: 8080 };
      const appSourcePath = 'apps/myapp/';
      const result = dockerfileUtils.renderDockerfile(pythonTemplate, templateVars, 'python', true, appSourcePath);

      expect(result).toContain(`COPY ${appSourcePath}requirements.txt ./`);
      expect(result).not.toContain('COPY requirements.txt ./');
    });

    it('should handle multiple COPY statements correctly', () => {
      const multiCopyTemplate = jest.fn((vars) => {
        return `FROM node:20-alpine
WORKDIR /app
COPY . .
COPY package*.json ./
COPY src ./src
EXPOSE ${vars.port || 3000}`;
      });

      const templateVars = { port: 3000 };
      const appSourcePath = 'apps/myapp/';
      const result = dockerfileUtils.renderDockerfile(multiCopyTemplate, templateVars, 'typescript', true, appSourcePath);

      expect(result).toContain(`COPY ${appSourcePath} .`);
      expect(result).toContain(`COPY ${appSourcePath}package*.json ./`);
      expect(result).toContain('COPY src ./src'); // This should not be replaced
    });
  });

  describe('checkTemplateDockerfile', () => {
    it('should return Dockerfile path if exists and forceTemplate is false', async() => {
      const builderPath = path.resolve(tempDir, 'builder', 'test-app');
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'Dockerfile'), 'FROM node:18', 'utf8');

      const result = dockerfileUtils.checkTemplateDockerfile(builderPath, 'test-app', false);

      expect(result).toBe(path.resolve(builderPath, 'Dockerfile'));
    });

    it('should return null if Dockerfile does not exist', () => {
      const builderPath = path.resolve(tempDir, 'builder', 'test-app');

      const result = dockerfileUtils.checkTemplateDockerfile(builderPath, 'test-app', false);

      expect(result).toBeNull();
    });

    it('should return null if forceTemplate is true even if Dockerfile exists', async() => {
      const builderPath = path.resolve(tempDir, 'builder', 'test-app');
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'Dockerfile'), 'FROM node:18', 'utf8');

      const result = dockerfileUtils.checkTemplateDockerfile(builderPath, 'test-app', true);

      expect(result).toBeNull();
    });
  });

  describe('checkProjectDockerfile', () => {
    it('should return null if dockerfile is not specified in buildConfig', () => {
      const builderPath = path.resolve(tempDir, 'builder', 'test-app');
      const buildConfig = {};
      const contextPath = path.resolve(tempDir);

      const result = dockerfileUtils.checkProjectDockerfile(builderPath, 'test-app', buildConfig, contextPath, false);

      expect(result).toBeNull();
    });

    it('should return null if forceTemplate is true', () => {
      const builderPath = path.resolve(tempDir, 'builder', 'test-app');
      const buildConfig = { dockerfile: 'CustomDockerfile' };
      const contextPath = path.resolve(tempDir);

      const result = dockerfileUtils.checkProjectDockerfile(builderPath, 'test-app', buildConfig, contextPath, true);

      expect(result).toBeNull();
    });

    it('should return custom Dockerfile path if exists in contextPath', async() => {
      const builderPath = path.resolve(tempDir, 'builder', 'test-app');
      const buildConfig = { dockerfile: 'CustomDockerfile' };
      const contextPath = path.resolve(tempDir);

      fsSync.writeFileSync(path.join(contextPath, 'CustomDockerfile'), 'FROM node:18', 'utf8');

      const result = dockerfileUtils.checkProjectDockerfile(builderPath, 'test-app', buildConfig, contextPath, false);

      expect(result).toBe(path.resolve(contextPath, 'CustomDockerfile'));
    });

    it('should return custom Dockerfile path if exists in builder directory', async() => {
      const builderPath = path.resolve(tempDir, 'builder', 'test-app');
      const buildConfig = { dockerfile: 'CustomDockerfile' };
      const contextPath = path.resolve(tempDir, 'somewhere', 'else');

      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'CustomDockerfile'), 'FROM node:18', 'utf8');

      const result = dockerfileUtils.checkProjectDockerfile(builderPath, 'test-app', buildConfig, contextPath, false);

      expect(result).toBe(path.resolve(builderPath, 'CustomDockerfile'));
    });

    it('should return null if custom Dockerfile does not exist in either location', () => {
      const builderPath = path.resolve(tempDir, 'builder', 'test-app');
      const buildConfig = { dockerfile: 'NonExistentDockerfile' };
      const contextPath = path.resolve(tempDir);

      const result = dockerfileUtils.checkProjectDockerfile(builderPath, 'test-app', buildConfig, contextPath, false);

      expect(result).toBeNull();
    });

    it('should prefer contextPath Dockerfile over builder directory Dockerfile', async() => {
      const builderPath = path.resolve(tempDir, 'builder', 'test-app');
      const buildConfig = { dockerfile: 'CustomDockerfile' };
      const contextPath = path.resolve(tempDir);

      // Create Dockerfile in both locations
      fsSync.writeFileSync(path.join(contextPath, 'CustomDockerfile'), 'FROM node:18 # context', 'utf8');
      fsSync.mkdirSync(builderPath, { recursive: true });
      fsSync.writeFileSync(path.join(builderPath, 'CustomDockerfile'), 'FROM node:18 # builder', 'utf8');

      const result = dockerfileUtils.checkProjectDockerfile(builderPath, 'test-app', buildConfig, contextPath, false);

      // Should return the one in contextPath
      expect(result).toBe(path.resolve(contextPath, 'CustomDockerfile'));
    });
  });
});

