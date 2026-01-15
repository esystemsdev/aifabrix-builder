/**
 * Tests for Dockerfile Utility Functions
 *
 * @fileoverview Unit tests for dockerfile-utils.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');

// Mock fs to use real implementation to override any other mocks
jest.mock('fs', () => {
  return jest.requireActual('fs');
});

const fsSync = require('fs');
const fs = require('fs').promises;
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aifabrix-test-'));
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
    await fs.mkdir(typescriptTemplateDir, { recursive: true });
    await fs.mkdir(pythonTemplateDir, { recursive: true });

    // Create minimal templates
    await fs.writeFile(path.join(typescriptTemplateDir, 'Dockerfile.hbs'), 'FROM node:20-alpine\nWORKDIR /app\nEXPOSE {{port}}');
    await fs.writeFile(path.join(pythonTemplateDir, 'Dockerfile.hbs'), 'FROM python:3.11-alpine\nWORKDIR /app\nEXPOSE {{port}}');

    // Change to temp directory for file path tests
    process.chdir(tempDir);
  });

  afterEach(async() => {
    // Restore original cwd - this is important for Jest's module resolution
    process.chdir(originalCwd);
    pathsModule.getProjectRoot.mockClear();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('loadDockerfileTemplate', () => {
    it('should load TypeScript Dockerfile template', () => {
      const template = dockerfileUtils.loadDockerfileTemplate('typescript');
      expect(template).toBeInstanceOf(Function);
    });

    it('should load Python Dockerfile template', () => {
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
      await fs.mkdir(builderPath, { recursive: true });
      await fs.writeFile(path.join(builderPath, 'Dockerfile'), 'FROM node:18');

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
      await fs.mkdir(builderPath, { recursive: true });
      await fs.writeFile(path.join(builderPath, 'Dockerfile'), 'FROM node:18');

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

      await fs.writeFile(path.join(contextPath, 'CustomDockerfile'), 'FROM node:18');

      const result = dockerfileUtils.checkProjectDockerfile(builderPath, 'test-app', buildConfig, contextPath, false);

      expect(result).toBe(path.resolve(contextPath, 'CustomDockerfile'));
    });

    it('should return custom Dockerfile path if exists in builder directory', async() => {
      const builderPath = path.resolve(tempDir, 'builder', 'test-app');
      const buildConfig = { dockerfile: 'CustomDockerfile' };
      const contextPath = path.resolve(tempDir, 'somewhere', 'else');

      await fs.mkdir(builderPath, { recursive: true });
      await fs.writeFile(path.join(builderPath, 'CustomDockerfile'), 'FROM node:18');

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
      await fs.writeFile(path.join(contextPath, 'CustomDockerfile'), 'FROM node:18 # context');
      await fs.mkdir(builderPath, { recursive: true });
      await fs.writeFile(path.join(builderPath, 'CustomDockerfile'), 'FROM node:18 # builder');

      const result = dockerfileUtils.checkProjectDockerfile(builderPath, 'test-app', buildConfig, contextPath, false);

      // Should return the one in contextPath
      expect(result).toBe(path.resolve(contextPath, 'CustomDockerfile'));
    });
  });
});

