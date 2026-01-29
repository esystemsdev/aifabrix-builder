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

const path = require('path');
const { ensureAppFromTemplate } = require('../../../lib/commands/up-common');
const { copyTemplateFiles } = require('../../../lib/validation/template');

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
  });

  it('should copy template and return true when variables.yaml does not exist', async() => {
    const appPath = path.join(cwd, 'builder', 'dataplane');
    const variablesPath = path.join(appPath, 'variables.yaml');
    require('fs').existsSync.mockImplementation((p) => p !== variablesPath);
    copyTemplateFiles.mockResolvedValue(['variables.yaml', 'env.template']);

    const result = await ensureAppFromTemplate('dataplane');

    expect(result).toBe(true);
    expect(copyTemplateFiles).toHaveBeenCalledWith('dataplane', appPath);
  });
});
