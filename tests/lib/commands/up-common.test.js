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

jest.mock('../../../lib/utils/paths', () => ({
  getBuilderPath: jest.fn((appName) => require('path').join(process.cwd(), 'builder', appName))
}));

const path = require('path');
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
    jest.spyOn(require('fs'), 'existsSync').mockImplementation(() => false);
  });

  afterEach(() => {
    const fs = require('fs');
    if (fs.existsSync.mockRestore) {
      fs.existsSync.mockRestore();
    }
  });

  it('should throw if appName is missing', async() => {
    await expect(ensureAppFromTemplate(null)).rejects.toThrow('Application name is required and must be a string');
    await expect(ensureAppFromTemplate(undefined)).rejects.toThrow('Application name is required and must be a string');
    await expect(ensureAppFromTemplate('')).rejects.toThrow('Application name is required and must be a string');
  });

  it('should throw if appName is not a string', async() => {
    await expect(ensureAppFromTemplate(123)).rejects.toThrow('Application name is required and must be a string');
  });

  it('should return false and not copy when variables.yaml exists', async() => {
    const variablesPath = path.join(cwd, 'builder', 'keycloak', 'variables.yaml');
    require('fs').existsSync.mockImplementation((p) => p === variablesPath);

    const result = await ensureAppFromTemplate('keycloak');

    expect(result).toBe(false);
    expect(copyTemplateFiles).not.toHaveBeenCalled();
    expect(ensureReadmeForApp).toHaveBeenCalledWith('keycloak');
  });

  it('should copy template and return true when variables.yaml does not exist', async() => {
    const appPath = path.join(cwd, 'builder', 'dataplane');
    const variablesPath = path.join(appPath, 'variables.yaml');
    require('fs').existsSync.mockImplementation((p) => p !== variablesPath);
    copyTemplateFiles.mockResolvedValue(['variables.yaml', 'env.template']);

    const result = await ensureAppFromTemplate('dataplane');

    expect(result).toBe(true);
    expect(copyTemplateFiles).toHaveBeenCalledWith('dataplane', appPath);
    expect(ensureReadmeForAppPath).toHaveBeenCalledWith(appPath, 'dataplane');
    expect(ensureReadmeForApp).toHaveBeenCalledWith('dataplane');
  });
});

describe('up-common getEnvOutputPathFolder', () => {
  it('returns directory containing the output .env file', () => {
    const variablesPath = path.join(process.cwd(), 'builder', 'miso-controller', 'variables.yaml');
    // ../../.env from builder/miso-controller => folder is repo root (cwd)
    expect(getEnvOutputPathFolder('../../.env', variablesPath)).toBe(path.resolve(process.cwd()));
    // ../../packages/miso-controller/.env => folder is packages/miso-controller under repo root
    expect(getEnvOutputPathFolder('../../packages/miso-controller/.env', variablesPath)).toBe(
      path.resolve(process.cwd(), 'packages', 'miso-controller')
    );
  });
});

describe('up-common validateEnvOutputPathFolderOrNull', () => {
  const cwd = process.cwd();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, 'existsSync');
    jest.spyOn(fs, 'readFileSync');
    jest.spyOn(fs, 'writeFileSync');
  });

  afterEach(() => {
    fs.existsSync.mockRestore?.();
    fs.readFileSync.mockRestore?.();
    fs.writeFileSync.mockRestore?.();
  });

  it('does nothing when appName is missing or empty', () => {
    validateEnvOutputPathFolderOrNull(null);
    validateEnvOutputPathFolderOrNull(undefined);
    validateEnvOutputPathFolderOrNull('');
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('does nothing when variables.yaml does not exist', () => {
    fs.existsSync.mockReturnValue(false);
    validateEnvOutputPathFolderOrNull('miso-controller');
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('leaves envOutputPath unchanged when target folder exists', () => {
    const variablesPath = path.join(cwd, 'builder', 'miso-controller', 'variables.yaml');
    const repoRoot = path.resolve(process.cwd()); // ../../.env from builder/miso-controller => repo root
    fs.existsSync.mockImplementation((p) => p === variablesPath || p === repoRoot);
    fs.readFileSync.mockReturnValue('build:\n  envOutputPath: ../../.env\nport: 3000');
    validateEnvOutputPathFolderOrNull('miso-controller');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('leaves envOutputPath ../../packages/miso-controller/.env unchanged when packages/miso-controller folder exists', () => {
    const variablesPath = path.join(cwd, 'builder', 'miso-controller', 'variables.yaml');
    const packagesMisoFolder = path.resolve(cwd, 'packages', 'miso-controller');
    const content = 'build:\n  envOutputPath: ../../packages/miso-controller/.env # Copy .env to repo root for local dev\nport: 3000';
    fs.existsSync.mockImplementation((p) => p === variablesPath || p === packagesMisoFolder);
    fs.readFileSync.mockReturnValue(content);
    validateEnvOutputPathFolderOrNull('miso-controller');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('patches envOutputPath to null when target folder does not exist', () => {
    const variablesPath = path.join(cwd, 'builder', 'miso-controller', 'variables.yaml');
    fs.existsSync.mockImplementation((p) => p === variablesPath);
    const content = 'build:\n  envOutputPath: ../../.env  # deploy only\nport: 3000';
    fs.readFileSync.mockReturnValue(content);
    validateEnvOutputPathFolderOrNull('miso-controller');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      variablesPath,
      content.replace(/^(\s*envOutputPath:)\s*.*$/m, '$1 null  # deploy only, no copy'),
      'utf8'
    );
  });

  it('skips when envOutputPath is already null or missing', () => {
    const variablesPath = path.join(cwd, 'builder', 'miso-controller', 'variables.yaml');
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('build:\n  envOutputPath: null\nport: 3000');
    validateEnvOutputPathFolderOrNull('miso-controller');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});

describe('up-common patchEnvOutputPathForDeployOnly', () => {
  const cwd = process.cwd();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, 'existsSync');
    jest.spyOn(fs, 'readFileSync');
    jest.spyOn(fs, 'writeFileSync');
  });

  afterEach(() => {
    fs.existsSync.mockRestore?.();
    fs.readFileSync.mockRestore?.();
    fs.writeFileSync.mockRestore?.();
  });

  it('does NOT patch when target folder exists (e.g. ../../packages/miso-controller/.env)', () => {
    const variablesPath = path.join(cwd, 'builder', 'miso-controller', 'variables.yaml');
    const packagesMisoFolder = path.resolve(cwd, 'packages', 'miso-controller');
    const content = 'build:\n  envOutputPath: ../../packages/miso-controller/.env # Copy .env to repo root for local dev\nport: 3000';
    fs.existsSync.mockImplementation((p) => p === variablesPath || p === packagesMisoFolder);
    fs.readFileSync.mockReturnValue(content);
    patchEnvOutputPathForDeployOnly('miso-controller');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('does NOT patch when repo root folder exists (envOutputPath ../../.env)', () => {
    const variablesPath = path.join(cwd, 'builder', 'miso-controller', 'variables.yaml');
    const repoRoot = path.resolve(process.cwd());
    const content = 'build:\n  envOutputPath: ../../.env\nport: 3000';
    fs.existsSync.mockImplementation((p) => p === variablesPath || p === repoRoot);
    fs.readFileSync.mockReturnValue(content);
    patchEnvOutputPathForDeployOnly('miso-controller');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('patches to null when target folder does not exist', () => {
    const variablesPath = path.join(cwd, 'builder', 'miso-controller', 'variables.yaml');
    fs.existsSync.mockImplementation((p) => p === variablesPath);
    const content = 'build:\n  envOutputPath: ../../packages/miso-controller/.env\nport: 3000';
    fs.readFileSync.mockReturnValue(content);
    patchEnvOutputPathForDeployOnly('miso-controller');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      variablesPath,
      content.replace(/^(\s*envOutputPath:)\s*.*$/m, '$1 null  # deploy only, no copy'),
      'utf8'
    );
  });

  it('patches when envOutputPath points to non-existent packages/miso-controller folder', () => {
    const variablesPath = path.join(cwd, 'builder', 'miso-controller', 'variables.yaml');
    const packagesMisoFolder = path.resolve(cwd, 'packages', 'miso-controller');
    fs.existsSync.mockImplementation((p) => p === variablesPath); // folder does NOT exist
    const content = 'build:\n  envOutputPath: ../../packages/miso-controller/.env # Copy for local dev\nport: 3000';
    fs.readFileSync.mockReturnValue(content);
    patchEnvOutputPathForDeployOnly('miso-controller');
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(fs.writeFileSync.mock.calls[0][1]).toContain('envOutputPath: null  # deploy only, no copy');
  });
});
