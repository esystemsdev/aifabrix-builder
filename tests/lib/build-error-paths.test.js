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
      copyFile: jest.fn()
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
jest.mock('child_process', () => ({
  exec: jest.fn()
}));
jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn)
}));

const fs = require('fs');
const build = require('../../lib/build');
const config = require('../../lib/config');
const generator = require('../../lib/generator');
const paths = require('../../lib/utils/paths');
const validator = require('../../lib/validator');

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
  });
});
