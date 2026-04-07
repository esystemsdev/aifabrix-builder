/**
 * @fileoverview Tests for parameters validate command handler
 */

// Same worker may load jest.mock('fs'); validation walks real env.template files.
jest.unmock('fs');

const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn()
}));

// Deterministic app discovery: spyOn(paths) can fail to affect the export used by
// parameters-validate when load order / other suites differ; use explicit mocks.
jest.mock('../../../lib/utils/paths', () => {
  const actual = jest.requireActual('../../../lib/utils/paths');
  return {
    ...actual,
    listBuilderAppNames: jest.fn(() => []),
    listIntegrationAppNames: jest.fn(() => [])
  };
});

const logger = require('../../../lib/utils/logger');
const pathsUtil = require('../../../lib/utils/paths');
const { handleParametersValidate } = require('../../../lib/commands/parameters-validate');
const { clearInfraParameterCatalogCache } = require('../../../lib/parameters/infra-parameter-catalog');

describe('handleParametersValidate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearInfraParameterCatalogCache();
    pathsUtil.listBuilderAppNames.mockReturnValue([]);
    pathsUtil.listIntegrationAppNames.mockReturnValue([]);
  });

  it('returns valid false when catalog file is missing', async() => {
    const result = await handleParametersValidate({
      catalogPath: path.join(os.tmpdir(), 'missing-infra-parameter-catalog.yaml')
    });
    expect(result.valid).toBe(false);
    expect(logger.log).toHaveBeenCalled();
  });

  it('returns valid true when no builder/integration apps are discovered', async() => {
    const result = await handleParametersValidate({});
    expect(result.valid).toBe(true);
    expect(logger.log).toHaveBeenCalled();
  });

  it('returns valid true when env.template only references catalog-covered keys', async() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-good-'));
    const appDir = path.join(tmp, 'goodapp');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'env.template'),
      [
        'POSTGRES=kv://postgres-passwordKeyVault',
        'REDIS_U=kv://redis-url',
        'REDIS_P=kv://redis-passwordKeyVault',
        ''
      ].join('\n'),
      'utf8'
    );

    pathsUtil.listBuilderAppNames.mockReturnValue(['goodapp']);
    pathsUtil.listIntegrationAppNames.mockReturnValue([]);
    const builderSpy = jest.spyOn(pathsUtil, 'getBuilderPath').mockImplementation((n) => path.join(tmp, n));
    const intPathSpy = jest
      .spyOn(pathsUtil, 'getIntegrationPath')
      .mockImplementation((n) => path.join(tmp, 'integration', n));

    try {
      const result = await handleParametersValidate({});
      expect(result.valid).toBe(true);
      expect(logger.log).toHaveBeenCalled();
    } finally {
      builderSpy.mockRestore();
      intPathSpy.mockRestore();
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore race with parallel tmp cleanup */
      }
    }
  });

  it('returns valid false when env.template references a key not in catalog', async() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-bad-'));
    const appDir = path.join(tmp, 'badapp');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'env.template'),
      'X=kv://uncovered-secret-key-abcdef\n',
      'utf8'
    );

    pathsUtil.listBuilderAppNames.mockReturnValue(['badapp']);
    pathsUtil.listIntegrationAppNames.mockReturnValue([]);
    const builderSpy = jest.spyOn(pathsUtil, 'getBuilderPath').mockImplementation((n) => path.join(tmp, n));
    const intPathSpy = jest
      .spyOn(pathsUtil, 'getIntegrationPath')
      .mockImplementation((n) => path.join(tmp, 'integration', n));

    try {
      const result = await handleParametersValidate({});
      expect(result.valid).toBe(false);
      expect(logger.log).toHaveBeenCalled();
    } finally {
      builderSpy.mockRestore();
      intPathSpy.mockRestore();
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore race with parallel tmp cleanup */
      }
    }
  });
});
