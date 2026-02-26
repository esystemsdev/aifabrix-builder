/**
 * Tests for setup-utility CLI module
 *
 * @fileoverview Unit tests for lib/cli/setup-utility.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn()
}));
jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn(),
  getDeployJsonPath: jest.fn(),
  getResolveAppPath: jest.fn()
}));
jest.mock('../../../lib/utils/cli-utils', () => ({
  handleCommandError: jest.fn(),
  logOfflinePathWhenType: jest.fn()
}));
jest.mock('../../../lib/generator', () => ({
  splitDeployJson: jest.fn(),
  splitExternalApplicationSchema: jest.fn()
}));

const { detectAppType, getDeployJsonPath } = require('../../../lib/utils/paths');
const { logOfflinePathWhenType } = require('../../../lib/utils/cli-utils');
const generator = require('../../../lib/generator');
const { resolveSplitJsonApp, handleSplitJsonCommand } = require('../../../lib/cli/setup-utility');

describe('setup-utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveSplitJsonApp', () => {
    it('returns appPath and appType from detectAppType', async() => {
      const appPath = '/workspace/integration/test-app';
      detectAppType.mockResolvedValue({ appPath, appType: 'external' });

      const result = await resolveSplitJsonApp('test-app');
      expect(result).toEqual({ appPath, appType: 'external' });
      expect(detectAppType).toHaveBeenCalledWith('test-app');
    });

    it('passes through app type for builder apps', async() => {
      const appPath = '/workspace/builder/my-app';
      detectAppType.mockResolvedValue({ appPath, appType: 'regular' });

      const result = await resolveSplitJsonApp('my-app');
      expect(result).toEqual({ appPath, appType: 'regular' });
    });
  });

  describe('handleSplitJsonCommand', () => {
    const mockResult = {
      envTemplate: '/out/env.template',
      variables: '/out/application.yaml',
      readme: '/out/README.md'
    };

    it('splits deploy JSON for external app when deploy JSON exists', async() => {
      const appPath = '/workspace/integration/test-app';
      const deployPath = '/workspace/integration/test-app/test-app-deploy.json';
      detectAppType.mockResolvedValue({ appPath, appType: 'external' });
      getDeployJsonPath.mockReturnValue(deployPath);
      fs.existsSync.mockImplementation((p) => p === deployPath);
      generator.splitDeployJson.mockResolvedValue(mockResult);

      const result = await handleSplitJsonCommand('test-app', {});
      expect(logOfflinePathWhenType).toHaveBeenCalledWith(appPath);
      expect(getDeployJsonPath).toHaveBeenCalledWith('test-app', 'external', true);
      expect(generator.splitDeployJson).toHaveBeenCalledWith(deployPath, appPath);
      expect(result).toEqual(mockResult);
    });

    it('splits application-schema.json for external app when deploy JSON missing', async() => {
      const appPath = '/workspace/integration/test-app';
      const deployPath = '/workspace/integration/test-app/test-app-deploy.json';
      const schemaPath = path.join(appPath, 'application-schema.json');
      detectAppType.mockResolvedValue({ appPath, appType: 'external' });
      getDeployJsonPath.mockReturnValue(deployPath);
      fs.existsSync.mockImplementation((p) => p === schemaPath);
      generator.splitExternalApplicationSchema.mockResolvedValue(mockResult);

      const result = await handleSplitJsonCommand('test-app', {});
      expect(generator.splitDeployJson).not.toHaveBeenCalled();
      expect(generator.splitExternalApplicationSchema).toHaveBeenCalledWith(schemaPath, appPath);
      expect(result).toEqual(mockResult);
    });

    it('throws when external app has neither deploy JSON nor schema', async() => {
      const appPath = '/workspace/integration/test-app';
      const deployPath = '/workspace/integration/test-app/test-app-deploy.json';
      const schemaPath = path.join(appPath, 'application-schema.json');
      detectAppType.mockResolvedValue({ appPath, appType: 'external' });
      getDeployJsonPath.mockReturnValue(deployPath);
      fs.existsSync.mockReturnValue(false);

      await expect(handleSplitJsonCommand('test-app', {})).rejects.toThrow(
        /No deployment or schema file found/
      );
      expect(generator.splitDeployJson).not.toHaveBeenCalled();
      expect(generator.splitExternalApplicationSchema).not.toHaveBeenCalled();
    });

    it('splits deploy JSON for regular app', async() => {
      const appPath = '/workspace/builder/my-app';
      const deployPath = '/workspace/builder/my-app/my-app-deploy.json';
      detectAppType.mockResolvedValue({ appPath, appType: 'regular' });
      getDeployJsonPath.mockReturnValue(deployPath);
      fs.existsSync.mockReturnValue(true);
      generator.splitDeployJson.mockResolvedValue(mockResult);

      const result = await handleSplitJsonCommand('my-app', {});
      expect(getDeployJsonPath).toHaveBeenCalledWith('my-app', 'regular', true);
      expect(generator.splitDeployJson).toHaveBeenCalledWith(deployPath, appPath);
      expect(result).toEqual(mockResult);
    });

    it('throws when regular app deploy JSON not found', async() => {
      const appPath = '/workspace/builder/my-app';
      const deployPath = '/workspace/builder/my-app/my-app-deploy.json';
      detectAppType.mockResolvedValue({ appPath, appType: 'regular' });
      getDeployJsonPath.mockReturnValue(deployPath);
      fs.existsSync.mockReturnValue(false);

      await expect(handleSplitJsonCommand('my-app', {})).rejects.toThrow(
        /Deployment JSON file not found/
      );
    });

    it('uses custom output directory when provided', async() => {
      const appPath = '/workspace/integration/test-app';
      const deployPath = '/workspace/integration/test-app/test-app-deploy.json';
      const outputDir = '/custom/output';
      detectAppType.mockResolvedValue({ appPath, appType: 'external' });
      getDeployJsonPath.mockReturnValue(deployPath);
      fs.existsSync.mockReturnValue(true);
      generator.splitDeployJson.mockResolvedValue(mockResult);

      const result = await handleSplitJsonCommand('test-app', { output: outputDir });
      expect(generator.splitDeployJson).toHaveBeenCalledWith(deployPath, outputDir);
      expect(result).toEqual(mockResult);
    });
  });
});
