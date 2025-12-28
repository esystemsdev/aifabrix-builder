/**
 * Tests for Build Error Paths
 *
 * @fileoverview Unit tests for build.js error handling paths
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    promises: {
      readdir: jest.fn(),
      stat: jest.fn(),
      copyFile: jest.fn(),
      mkdir: jest.fn(),
      writeFile: jest.fn()
    }
  };
});
jest.mock('../../lib/config', () => ({
  getDeveloperId: jest.fn()
}));
jest.mock('../../lib/utils/build-copy', () => ({
  copyBuilderToDevDirectory: jest.fn(),
  copyAppSourceFiles: jest.fn()
}));
jest.mock('../../lib/utils/dockerfile-utils', () => ({
  generateDockerfile: jest.fn()
}));
jest.mock('../../lib/utils/image-name', () => ({
  buildImageName: jest.fn().mockResolvedValue('testapp:latest'),
  buildDevImageName: jest.fn((imageName, devId) => {
    return devId === 0 ? imageName : `${imageName}-dev-${devId}`;
  })
}));
jest.mock('../../lib/utils/logger', () => ({
  log: jest.fn()
}));
jest.mock('../../lib/generator', () => ({
  generateDeployJson: jest.fn()
}));
jest.mock('../../lib/utils/paths', () => ({
  detectAppType: jest.fn()
}));
jest.mock('../../lib/utils/docker-build', () => ({
  executeDockerBuild: jest.fn().mockResolvedValue()
}));
jest.mock('../../lib/validator', () => ({
  validateVariables: jest.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] })
}));
jest.mock('../../lib/secrets', () => ({
  generateEnvFile: jest.fn().mockResolvedValue('/path/to/.env')
}));
jest.mock('../../lib/utils/dockerfile-utils', () => ({
  loadDockerfileTemplate: jest.fn(() => jest.fn(() => 'FROM node:18\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["npm", "start"]')),
  renderDockerfile: jest.fn((template, vars, language, isAppFlag, appSourcePath) => 'FROM node:18\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["npm", "start"]'),
  checkTemplateDockerfile: jest.fn().mockReturnValue(null),
  checkProjectDockerfile: jest.fn().mockReturnValue(null),
  generateDockerfile: jest.fn()
}));
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    if (callback) {
      callback(null, { stdout: '', stderr: '' });
    }
  })
}));
jest.mock('util', () => ({
  promisify: jest.fn((fn) => {
    // Return a function that can be mocked per test
    return jest.fn();
  })
}));

const fs = require('fs');
const fsPromises = require('fs').promises;
const build = require('../../lib/build');
const config = require('../../lib/config');
const generator = require('../../lib/generator');
const paths = require('../../lib/utils/paths');
const validator = require('../../lib/validator');
const buildCopy = require('../../lib/utils/build-copy');
const dockerfileUtils = require('../../lib/utils/dockerfile-utils');
const dockerBuild = require('../../lib/utils/docker-build');
const secrets = require('../../lib/secrets');
const logger = require('../../lib/utils/logger');
const { exec } = require('child_process');
const { promisify } = require('util');

describe('Build Error Paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paths.detectAppType.mockResolvedValue({
      isExternal: false,
      appPath: 'builder/testapp',
      appType: 'regular',
      baseDir: 'builder'
    });
  });

  describe('buildApp error paths', () => {
    it('should handle variables.yaml not found', async() => {
      const appName = 'testapp';
      fs.existsSync.mockReturnValue(false);

      await expect(
        build.buildApp(appName)
      ).rejects.toThrow();
    });

    it('should handle invalid YAML in variables.yaml', async() => {
      const appName = 'testapp';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: [');

      await expect(
        build.buildApp(appName)
      ).rejects.toThrow();
    });

    it('should handle external system build (no Docker build)', async() => {
      const appName = 'external-app';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: {
          type: 'external',
          key: 'external-app',
          name: 'External App',
          description: 'External system'
        }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      generator.generateDeployJson.mockResolvedValue('/path/to/deploy.json');

      const result = await build.buildApp(appName);

      expect(result).toBeNull();
      expect(generator.generateDeployJson).toHaveBeenCalledWith(appName);
    });

    it('should handle configuration validation errors', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: {
          key: 'testapp'
          // Missing required fields
        }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({
        valid: false,
        errors: ['Missing required field: name'],
        warnings: []
      });

      await expect(
        build.buildApp(appName)
      ).rejects.toThrow('Configuration validation failed');
    });

    it('should handle image name extraction from string format', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' },
        image: 'myimage:latest'
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      await build.buildApp(appName);

      expect(dockerBuild.executeDockerBuild).toHaveBeenCalled();
    });

    it('should handle image name extraction from object format', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' },
        image: { name: 'myimage', tag: 'v1.0' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      await build.buildApp(appName);

      expect(dockerBuild.executeDockerBuild).toHaveBeenCalled();
    });

    it('should handle image name extraction from app.key', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'myapp', name: 'My App' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      await build.buildApp(appName);

      expect(dockerBuild.executeDockerBuild).toHaveBeenCalled();
    });

    it('should handle image name fallback to appName', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { name: 'Test App' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      await build.buildApp(appName);

      expect(dockerBuild.executeDockerBuild).toHaveBeenCalled();
    });

    it('should handle additional tag option', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      // Mock promisify to return a resolving function
      const { promisify } = require('util');
      const mockRun = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });
      promisify.mockReturnValueOnce(mockRun);

      await build.buildApp(appName, { tag: 'v1.0' });

      expect(dockerBuild.executeDockerBuild).toHaveBeenCalled();
    });

    it('should handle post-build tasks error', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();
      secrets.generateEnvFile.mockRejectedValue(new Error('Failed to generate env file'));

      await build.buildApp(appName);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning: Could not generate .env file'));
    });

    it('should handle copying app source files from apps directory', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps/testapp')) return true;
        if (path.includes('Dockerfile')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      await build.buildApp(appName);

      expect(buildCopy.copyAppSourceFiles).toHaveBeenCalled();
    });

    it('should handle Python template file copying', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' },
        build: { language: 'python' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        if (path.includes('requirements.txt')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue(['main.py', 'requirements.txt.hbs']);
      fsPromises.stat.mockResolvedValue({ isFile: () => true });
      fsPromises.copyFile.mockResolvedValue();
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      await build.buildApp(appName);

      expect(fsPromises.copyFile).toHaveBeenCalled();
    });

    it('should handle old context format warning', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' },
        build: { context: '../oldpath' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      await build.buildApp(appName);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning: Build context uses old format'));
    });

    it('should handle apps flag context path', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' },
        build: { context: '../..' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      await build.buildApp(appName);

      expect(dockerBuild.executeDockerBuild).toHaveBeenCalled();
    });

    it('should handle compatibility tag error', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        return true;
      });
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      // Mock promisify to return a rejecting function
      const { promisify } = require('util');
      const mockRun = jest.fn().mockRejectedValue(new Error('Tag failed'));
      promisify.mockReturnValueOnce(mockRun);

      await build.buildApp(appName);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning: Could not create compatibility tag'));
    });

    it('should handle template path not found error', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' },
        build: { language: 'typescript' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        if (path.includes('package.json')) return false;
        if (path.includes('templates/typescript')) return false; // Template path doesn't exist
        return true;
      });
      fsPromises.readdir.mockRejectedValue(new Error('Template path not found'));

      await expect(build.buildApp(appName)).rejects.toThrow();
    });

    it('should handle directory creation when targetDir does not exist', async() => {
      const appName = 'testapp';
      const yaml = require('js-yaml');
      const variablesContent = yaml.dump({
        app: { key: 'testapp', name: 'Test App' }
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(variablesContent);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      config.getDeveloperId.mockResolvedValue(0);
      buildCopy.copyBuilderToDevDirectory.mockResolvedValue('/path/to/dev');
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('apps')) return false;
        if (path.includes('Dockerfile')) return false;
        if (path.includes('/path/to/dev')) return false; // Target dir doesn't exist
        return true;
      });
      fsPromises.mkdir = jest.fn().mockResolvedValue();
      fsPromises.readdir.mockResolvedValue([]);
      dockerfileUtils.generateDockerfile.mockResolvedValue('/path/to/Dockerfile');
      dockerBuild.executeDockerBuild.mockResolvedValue();

      await build.buildApp(appName);

      expect(fsPromises.mkdir).toHaveBeenCalled();
    });
  });
});
