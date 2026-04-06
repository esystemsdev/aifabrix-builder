/**
 * @fileoverview Tests for parameters validate command handler
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const pathsUtil = require('../../../lib/utils/paths');
const { handleParametersValidate } = require('../../../lib/commands/parameters-validate');
const { clearInfraParameterCatalogCache } = require('../../../lib/parameters/infra-parameter-catalog');

describe('handleParametersValidate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearInfraParameterCatalogCache();
  });

  it('returns valid false when catalog file is missing', async() => {
    const result = await handleParametersValidate({
      catalogPath: path.join(os.tmpdir(), 'missing-infra-parameter-catalog.yaml')
    });
    expect(result.valid).toBe(false);
    expect(logger.log).toHaveBeenCalled();
  });

  it('returns valid true when no builder/integration apps are discovered', async() => {
    const listSpy = jest.spyOn(pathsUtil, 'listBuilderAppNames').mockReturnValue([]);
    const intListSpy = jest.spyOn(pathsUtil, 'listIntegrationAppNames').mockReturnValue([]);
    try {
      const result = await handleParametersValidate({});
      expect(result.valid).toBe(true);
      expect(logger.log).toHaveBeenCalled();
    } finally {
      listSpy.mockRestore();
      intListSpy.mockRestore();
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

    const listSpy = jest.spyOn(pathsUtil, 'listBuilderAppNames').mockReturnValue(['badapp']);
    const intListSpy = jest.spyOn(pathsUtil, 'listIntegrationAppNames').mockReturnValue([]);
    const builderSpy = jest.spyOn(pathsUtil, 'getBuilderPath').mockImplementation((n) => path.join(tmp, n));
    const intPathSpy = jest
      .spyOn(pathsUtil, 'getIntegrationPath')
      .mockImplementation((n) => path.join(tmp, 'integration', n));

    try {
      const result = await handleParametersValidate({});
      expect(result.valid).toBe(false);
      expect(logger.log).toHaveBeenCalled();
    } finally {
      listSpy.mockRestore();
      intListSpy.mockRestore();
      builderSpy.mockRestore();
      intPathSpy.mockRestore();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
