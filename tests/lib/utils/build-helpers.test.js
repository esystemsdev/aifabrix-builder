/**
 * Tests for Build Helpers Module
 *
 * @fileoverview Unit tests for lib/utils/build-helpers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  return mockChalk;
});

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock dockerfile-utils
jest.mock('../../../lib/utils/dockerfile-utils', () => ({
  checkTemplateDockerfile: jest.fn(),
  checkProjectDockerfile: jest.fn()
}));

// Mock build module
jest.mock('../../../lib/build', () => ({
  loadVariablesYaml: jest.fn()
}));

// Mock validator
jest.mock('../../../lib/validation/validator', () => ({
  validateVariables: jest.fn()
}));

const path = require('path');
const logger = require('../../../lib/utils/logger');
const dockerfileUtils = require('../../../lib/utils/dockerfile-utils');
const { loadVariablesYaml } = require('../../../lib/build/index');
const validator = require('../../../lib/validation/validator');
const {
  determineDockerfile,
  loadAndValidateConfig
} = require('../../../lib/utils/build-helpers');

describe('Build Helpers Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('determineDockerfile', () => {
    it('should use template Dockerfile if exists', async() => {
      const appName = 'test-app';
      const options = {
        language: 'typescript',
        config: {},
        buildConfig: {},
        forceTemplate: false
      };
      const generateDockerfileFn = jest.fn();
      const templateDockerfilePath = path.join(process.cwd(), 'builder', appName, 'Dockerfile');
      dockerfileUtils.checkTemplateDockerfile.mockReturnValue(templateDockerfilePath);
      dockerfileUtils.checkProjectDockerfile.mockReturnValue(null);

      const result = await determineDockerfile(appName, options, generateDockerfileFn);

      expect(result).toBe(templateDockerfilePath);
      expect(dockerfileUtils.checkTemplateDockerfile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'builder', appName),
        appName,
        false
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✓ Using existing Dockerfile:'));
      expect(generateDockerfileFn).not.toHaveBeenCalled();
    });

    it('should use custom Dockerfile if template not found', async() => {
      const appName = 'test-app';
      const options = {
        language: 'typescript',
        config: {},
        buildConfig: {
          dockerfile: 'custom.Dockerfile'
        },
        contextPath: '/custom/path',
        forceTemplate: false
      };
      const generateDockerfileFn = jest.fn();
      dockerfileUtils.checkTemplateDockerfile.mockReturnValue(null);
      const customDockerfilePath = path.join(process.cwd(), 'builder', appName, 'custom.Dockerfile');
      dockerfileUtils.checkProjectDockerfile.mockReturnValue(customDockerfilePath);

      const result = await determineDockerfile(appName, options, generateDockerfileFn);

      expect(result).toBe(customDockerfilePath);
      expect(dockerfileUtils.checkProjectDockerfile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'builder', appName),
        appName,
        options.buildConfig,
        options.contextPath,
        false
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✓ Using custom Dockerfile:'));
      expect(generateDockerfileFn).not.toHaveBeenCalled();
    });

    it('should generate Dockerfile if neither template nor custom found', async() => {
      const appName = 'test-app';
      const options = {
        language: 'typescript',
        config: {},
        buildConfig: {}
      };
      const generatedDockerfilePath = path.join(process.cwd(), 'builder', appName, 'Dockerfile');
      const generateDockerfileFn = jest.fn().mockResolvedValue(generatedDockerfilePath);
      dockerfileUtils.checkTemplateDockerfile.mockReturnValue(null);
      dockerfileUtils.checkProjectDockerfile.mockReturnValue(null);

      const result = await determineDockerfile(appName, options, generateDockerfileFn);

      expect(result).toBe(generatedDockerfilePath);
      expect(generateDockerfileFn).toHaveBeenCalledWith(
        appName,
        options.language,
        options.config,
        options.buildConfig,
        undefined
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✓ Generated Dockerfile from template:'));
    });

    it('should use devDir if provided', async() => {
      const appName = 'test-app';
      const devDir = '/custom/dev/path';
      const options = {
        language: 'typescript',
        config: {},
        buildConfig: {},
        devDir
      };
      const generateDockerfileFn = jest.fn();
      dockerfileUtils.checkTemplateDockerfile.mockReturnValue(null);
      dockerfileUtils.checkProjectDockerfile.mockReturnValue(null);
      const generatedDockerfilePath = path.join(devDir, 'Dockerfile');
      generateDockerfileFn.mockResolvedValue(generatedDockerfilePath);

      const result = await determineDockerfile(appName, options, generateDockerfileFn);

      expect(result).toBe(generatedDockerfilePath);
      expect(dockerfileUtils.checkTemplateDockerfile).toHaveBeenCalledWith(devDir, appName, undefined);
      expect(generateDockerfileFn).toHaveBeenCalledWith(
        appName,
        options.language,
        options.config,
        options.buildConfig,
        devDir
      );
    });

    it('should respect forceTemplate flag', async() => {
      const appName = 'test-app';
      const options = {
        language: 'typescript',
        config: {},
        buildConfig: {},
        forceTemplate: true
      };
      const generateDockerfileFn = jest.fn().mockResolvedValue(path.join(process.cwd(), 'builder', appName, 'Dockerfile'));
      dockerfileUtils.checkTemplateDockerfile.mockReturnValue(null);
      dockerfileUtils.checkProjectDockerfile.mockReturnValue(null);

      await determineDockerfile(appName, options, generateDockerfileFn);

      expect(dockerfileUtils.checkTemplateDockerfile).toHaveBeenCalledWith(
        expect.any(String),
        appName,
        true
      );
    });
  });

  describe('loadAndValidateConfig', () => {
    it('should load and validate config successfully', async() => {
      const appName = 'test-app';
      const variables = {
        app: { key: 'test-app' },
        image: { name: 'test-image' },
        build: { context: './' }
      };
      loadVariablesYaml.mockResolvedValue(variables);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [] });

      const result = await loadAndValidateConfig(appName);

      expect(result).toEqual({
        config: variables,
        imageName: 'test-image',
        buildConfig: { context: './' }
      });
      expect(loadVariablesYaml).toHaveBeenCalledWith(appName);
      expect(validator.validateVariables).toHaveBeenCalledWith(appName);
    });

    it('should extract image name from string image', async() => {
      const appName = 'test-app';
      const variables = {
        app: { key: 'test-app' },
        image: 'test-image:latest',
        build: {}
      };
      loadVariablesYaml.mockResolvedValue(variables);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [] });

      const result = await loadAndValidateConfig(appName);

      expect(result.imageName).toBe('test-image');
    });

    it('should extract image name from image.name', async() => {
      const appName = 'test-app';
      const variables = {
        app: { key: 'test-app' },
        image: { name: 'test-image', tag: 'latest' },
        build: {}
      };
      loadVariablesYaml.mockResolvedValue(variables);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [] });

      const result = await loadAndValidateConfig(appName);

      expect(result.imageName).toBe('test-image');
    });

    it('should use app.key as image name if image not provided', async() => {
      const appName = 'test-app';
      const variables = {
        app: { key: 'my-app' },
        build: {}
      };
      loadVariablesYaml.mockResolvedValue(variables);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [] });

      const result = await loadAndValidateConfig(appName);

      expect(result.imageName).toBe('my-app');
    });

    it('should use appName as fallback for image name', async() => {
      const appName = 'test-app';
      const variables = {
        build: {}
      };
      loadVariablesYaml.mockResolvedValue(variables);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [] });

      const result = await loadAndValidateConfig(appName);

      expect(result.imageName).toBe('test-app');
    });

    it('should use empty object for buildConfig if not provided', async() => {
      const appName = 'test-app';
      const variables = {
        app: { key: 'test-app' }
      };
      loadVariablesYaml.mockResolvedValue(variables);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [] });

      const result = await loadAndValidateConfig(appName);

      expect(result.buildConfig).toEqual({});
    });

    it('should throw error if validation fails', async() => {
      const appName = 'test-app';
      const variables = {
        app: { key: 'test-app' }
      };
      loadVariablesYaml.mockResolvedValue(variables);
      validator.validateVariables.mockResolvedValue({
        valid: false,
        errors: ['Error 1', 'Error 2']
      });

      await expect(loadAndValidateConfig(appName)).rejects.toThrow(
        'Configuration validation failed:\nError 1\nError 2'
      );
    });

    it('should handle image string with no tag', async() => {
      const appName = 'test-app';
      const variables = {
        app: { key: 'test-app' },
        image: 'test-image',
        build: {}
      };
      loadVariablesYaml.mockResolvedValue(variables);
      validator.validateVariables.mockResolvedValue({ valid: true, errors: [] });

      const result = await loadAndValidateConfig(appName);

      expect(result.imageName).toBe('test-image');
    });
  });
});

