/**
 * Tests for up-common (ensureAppFromTemplate)
 *
 * @fileoverview Tests for up-common command helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

jest.mock('../../../lib/validation/template', () => ({
  copyTemplateFiles: jest.fn()
}));

jest.mock('../../../lib/app/readme', () => ({
  ensureReadmeForAppPath: jest.fn().mockResolvedValue(undefined),
  ensureReadmeForApp: jest.fn().mockResolvedValue(undefined)
}));

const path = require('path');
const pathsUtil = require('../../../lib/utils/paths');
const configFormat = require('../../../lib/utils/config-format');

jest.mock('../../../lib/utils/paths', () => ({
  getBuilderPath: jest.fn((appName) => require('path').join(process.cwd(), 'builder', appName)),
  resolveApplicationConfigPath: jest.fn()
}));

jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn(),
  writeConfigFile: jest.fn()
}));

const fs = require('fs');
const {
  ensureAppFromTemplate,
  validateEnvOutputPathFolderOrNull,
  patchEnvOutputPathForDeployOnly,
  getEnvOutputPathFolder
} = require('../../../lib/commands/up-common');
const { copyTemplateFiles } = require('../../../lib/validation/template');
const { ensureReadmeForAppPath, ensureReadmeForApp } = require('../../../lib/app/readme');

describe('up-common ensureAppFromTemplate', () => {
  const cwd = process.cwd();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw if appName is missing', async() => {
    await expect(ensureAppFromTemplate(null)).rejects.toThrow('Application name is required and must be a string');
    await expect(ensureAppFromTemplate(undefined)).rejects.toThrow('Application name is required and must be a string');
    await expect(ensureAppFromTemplate('')).rejects.toThrow('Application name is required and must be a string');
  });

  it('should throw if appName is not a string', async() => {
    await expect(ensureAppFromTemplate(123)).rejects.toThrow('Application name is required and must be a string');
  });

  it('should return false and not copy when application config exists', async() => {
    const targetAppPath = path.join(cwd, 'builder', 'keycloak');
    const configPath = path.join(targetAppPath, 'application.yaml');
    pathsUtil.resolveApplicationConfigPath.mockReturnValue(configPath);

    const result = await ensureAppFromTemplate('keycloak');

    expect(result).toBe(false);
    expect(copyTemplateFiles).not.toHaveBeenCalled();
    expect(ensureReadmeForApp).toHaveBeenCalledWith('keycloak');
  });

  it('should copy template and return true when application config does not exist', async() => {
    const appPath = path.join(cwd, 'builder', 'dataplane');
    pathsUtil.resolveApplicationConfigPath.mockImplementation(() => {
      throw new Error('Application config not found');
    });
    copyTemplateFiles.mockResolvedValue(['application.yaml', 'env.template']);

    const result = await ensureAppFromTemplate('dataplane');

    expect(result).toBe(true);
    expect(copyTemplateFiles).toHaveBeenCalledWith('dataplane', appPath);
    expect(ensureReadmeForAppPath).toHaveBeenCalledWith(appPath, 'dataplane');
    expect(ensureReadmeForApp).toHaveBeenCalledWith('dataplane');
  });
});

describe('up-common getEnvOutputPathFolder', () => {
  it('returns directory containing the output .env file', () => {
    const configPath = path.join(process.cwd(), 'builder', 'miso-controller', 'application.yaml');
    // ../../.env from builder/miso-controller => folder is repo root (cwd)
    expect(getEnvOutputPathFolder('../../.env', configPath)).toBe(path.resolve(process.cwd()));
    // ../../packages/miso-controller/.env => folder is packages/miso-controller under repo root
    expect(getEnvOutputPathFolder('../../packages/miso-controller/.env', configPath)).toBe(
      path.resolve(process.cwd(), 'packages', 'miso-controller')
    );
  });
});

describe('up-common validateEnvOutputPathFolderOrNull', () => {
  const cwd = process.cwd();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, 'existsSync');
  });

  afterEach(() => {
    fs.existsSync.mockRestore?.();
  });

  it('does nothing when appName is missing or empty', () => {
    validateEnvOutputPathFolderOrNull(null);
    validateEnvOutputPathFolderOrNull(undefined);
    validateEnvOutputPathFolderOrNull('');
    expect(configFormat.loadConfigFile).not.toHaveBeenCalled();
  });

  it('does nothing when application config does not exist', () => {
    pathsUtil.resolveApplicationConfigPath.mockImplementation(() => {
      throw new Error('not found');
    });
    validateEnvOutputPathFolderOrNull('miso-controller');
    expect(configFormat.loadConfigFile).not.toHaveBeenCalled();
  });

  it('leaves envOutputPath unchanged when target folder exists', () => {
    const configPath = path.join(cwd, 'builder', 'miso-controller', 'application.yaml');
    const repoRoot = path.resolve(process.cwd());
    pathsUtil.resolveApplicationConfigPath.mockReturnValue(configPath);
    configFormat.loadConfigFile.mockReturnValue({ build: { envOutputPath: '../../.env' }, port: 3000 });
    fs.existsSync.mockImplementation((p) => p === repoRoot);
    validateEnvOutputPathFolderOrNull('miso-controller');
    expect(configFormat.writeConfigFile).not.toHaveBeenCalled();
  });

  it('leaves envOutputPath ../../packages/miso-controller/.env unchanged when packages/miso-controller folder exists', () => {
    const configPath = path.join(cwd, 'builder', 'miso-controller', 'application.yaml');
    const packagesMisoFolder = path.resolve(cwd, 'packages', 'miso-controller');
    pathsUtil.resolveApplicationConfigPath.mockReturnValue(configPath);
    configFormat.loadConfigFile.mockReturnValue({
      build: { envOutputPath: '../../packages/miso-controller/.env' },
      port: 3000
    });
    fs.existsSync.mockImplementation((p) => p === packagesMisoFolder);
    validateEnvOutputPathFolderOrNull('miso-controller');
    expect(configFormat.writeConfigFile).not.toHaveBeenCalled();
  });

  it('patches envOutputPath to null when target folder does not exist', () => {
    const configPath = path.join(cwd, 'builder', 'miso-controller', 'application.yaml');
    pathsUtil.resolveApplicationConfigPath.mockReturnValue(configPath);
    configFormat.loadConfigFile.mockReturnValue({ build: { envOutputPath: '../../.env' }, port: 3000 });
    fs.existsSync.mockReturnValue(false);
    validateEnvOutputPathFolderOrNull('miso-controller');
    expect(configFormat.writeConfigFile).toHaveBeenCalledWith(
      configPath,
      expect.objectContaining({ build: expect.objectContaining({ envOutputPath: null }), port: 3000 })
    );
  });

  it('skips when envOutputPath is already null or missing', () => {
    const configPath = path.join(cwd, 'builder', 'miso-controller', 'application.yaml');
    pathsUtil.resolveApplicationConfigPath.mockReturnValue(configPath);
    configFormat.loadConfigFile.mockReturnValue({ build: { envOutputPath: null }, port: 3000 });
    validateEnvOutputPathFolderOrNull('miso-controller');
    expect(configFormat.writeConfigFile).not.toHaveBeenCalled();
  });
});

describe('up-common patchEnvOutputPathForDeployOnly', () => {
  const cwd = process.cwd();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, 'existsSync');
  });

  afterEach(() => {
    fs.existsSync.mockRestore?.();
  });

  it('does NOT patch when target folder exists (e.g. ../../packages/miso-controller/.env)', () => {
    const configPath = path.join(cwd, 'builder', 'miso-controller', 'application.yaml');
    const packagesMisoFolder = path.resolve(cwd, 'packages', 'miso-controller');
    pathsUtil.resolveApplicationConfigPath.mockReturnValue(configPath);
    configFormat.loadConfigFile.mockReturnValue({
      build: { envOutputPath: '../../packages/miso-controller/.env' },
      port: 3000
    });
    fs.existsSync.mockImplementation((p) => p === packagesMisoFolder);
    patchEnvOutputPathForDeployOnly('miso-controller');
    expect(configFormat.writeConfigFile).not.toHaveBeenCalled();
  });

  it('does NOT patch when repo root folder exists (envOutputPath ../../.env)', () => {
    const configPath = path.join(cwd, 'builder', 'miso-controller', 'application.yaml');
    const repoRoot = path.resolve(process.cwd());
    pathsUtil.resolveApplicationConfigPath.mockReturnValue(configPath);
    configFormat.loadConfigFile.mockReturnValue({ build: { envOutputPath: '../../.env' }, port: 3000 });
    fs.existsSync.mockImplementation((p) => p === repoRoot);
    patchEnvOutputPathForDeployOnly('miso-controller');
    expect(configFormat.writeConfigFile).not.toHaveBeenCalled();
  });

  it('patches to null when target folder does not exist', () => {
    const configPath = path.join(cwd, 'builder', 'miso-controller', 'application.yaml');
    pathsUtil.resolveApplicationConfigPath.mockReturnValue(configPath);
    configFormat.loadConfigFile.mockReturnValue({
      build: { envOutputPath: '../../packages/miso-controller/.env' },
      port: 3000
    });
    fs.existsSync.mockReturnValue(false);
    patchEnvOutputPathForDeployOnly('miso-controller');
    expect(configFormat.writeConfigFile).toHaveBeenCalledWith(
      configPath,
      expect.objectContaining({ build: expect.objectContaining({ envOutputPath: null }), port: 3000 })
    );
  });

  it('patches when envOutputPath points to non-existent packages/miso-controller folder', () => {
    const configPath = path.join(cwd, 'builder', 'miso-controller', 'application.yaml');
    pathsUtil.resolveApplicationConfigPath.mockReturnValue(configPath);
    configFormat.loadConfigFile.mockReturnValue({
      build: { envOutputPath: '../../packages/miso-controller/.env' },
      port: 3000
    });
    fs.existsSync.mockReturnValue(false);
    patchEnvOutputPathForDeployOnly('miso-controller');
    expect(configFormat.writeConfigFile).toHaveBeenCalled();
    expect(configFormat.writeConfigFile.mock.calls[0][1].build.envOutputPath).toBe(null);
  });
});
