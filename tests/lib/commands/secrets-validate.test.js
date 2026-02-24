/**
 * Tests for Secrets Validate Command
 *
 * @fileoverview Unit tests for lib/commands/secrets-validate.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');

jest.mock('chalk', () => {
  const m = (s) => s;
  m.green = (s) => s;
  m.red = (s) => s;
  m.yellow = (s) => s;
  return m;
});

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn(() => '/home/.aifabrix')
}));
jest.mock('../../../lib/utils/secrets-validation', () => ({
  validateSecretsFile: jest.fn()
}));
jest.mock('../../../lib/core/secrets-ensure', () => ({
  resolveWriteTarget: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { validateSecretsFile } = require('../../../lib/utils/secrets-validation');
const secretsEnsure = require('../../../lib/core/secrets-ensure');
const { handleSecretsValidate } = require('../../../lib/commands/secrets-validate');

describe('secrets-validate command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates file at pathArg when pathArg is provided', async() => {
    validateSecretsFile.mockReturnValue({
      valid: true,
      errors: [],
      path: '/custom/secrets.yaml'
    });

    const result = await handleSecretsValidate('/custom/secrets.yaml', {});

    expect(validateSecretsFile).toHaveBeenCalledWith('/custom/secrets.yaml', {
      checkNaming: false
    });
    expect(result).toEqual({ valid: true, errors: [] });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('valid'));
  });

  it('passes checkNaming option when options.naming is true', async() => {
    validateSecretsFile.mockReturnValue({
      valid: true,
      errors: [],
      path: '/path/secrets.yaml'
    });

    await handleSecretsValidate('/path/secrets.yaml', { naming: true });

    expect(validateSecretsFile).toHaveBeenCalledWith('/path/secrets.yaml', {
      checkNaming: true
    });
  });

  it('resolves path from resolveWriteTarget when pathArg is not provided (file target)', async() => {
    secretsEnsure.resolveWriteTarget.mockResolvedValue({
      type: 'file',
      filePath: '/resolved/secrets.local.yaml'
    });
    validateSecretsFile.mockReturnValue({
      valid: true,
      errors: [],
      path: '/resolved/secrets.local.yaml'
    });

    const result = await handleSecretsValidate(undefined, {});

    expect(secretsEnsure.resolveWriteTarget).toHaveBeenCalled();
    expect(validateSecretsFile).toHaveBeenCalledWith(
      '/resolved/secrets.local.yaml',
      { checkNaming: false }
    );
    expect(result.valid).toBe(true);
  });

  it('falls back to aifabrix home secrets path when target is not file with filePath', async() => {
    secretsEnsure.resolveWriteTarget.mockResolvedValue({
      type: 'remote',
      serverUrl: 'https://example.com'
    });
    validateSecretsFile.mockReturnValue({
      valid: true,
      errors: [],
      path: '/home/.aifabrix/secrets.local.yaml'
    });

    await handleSecretsValidate(undefined, {});

    expect(validateSecretsFile).toHaveBeenCalledWith(
      path.join('/home/.aifabrix', 'secrets.local.yaml'),
      { checkNaming: false }
    );
  });

  it('returns valid: false and logs errors when validation fails', async() => {
    validateSecretsFile.mockReturnValue({
      valid: false,
      errors: ['Key "x": recommended format is *KeyVault'],
      path: '/path/secrets.yaml'
    });

    const result = await handleSecretsValidate('/path/secrets.yaml', { naming: true });

    expect(result).toEqual({
      valid: false,
      errors: ['Key "x": recommended format is *KeyVault']
    });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Key "x": recommended format is *KeyVault')
    );
  });
});
