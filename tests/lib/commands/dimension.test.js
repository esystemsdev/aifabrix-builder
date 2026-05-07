jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = (t) => t;
  mockChalk.gray = (t) => t;
  mockChalk.cyan = (t) => t;
  mockChalk.bold = (t) => t;
  mockChalk.yellow = (t) => t;
  mockChalk.green = (t) => t;
  mockChalk.white = Object.assign((t) => t, { bold: (t) => t });
  return mockChalk;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn()
}));

jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));

jest.mock('../../../lib/core/config', () => ({
  normalizeControllerUrl: jest.fn((url) => (url ? url.replace(/\/$/, '') : url)),
  resolveEnvironment: jest.fn().mockResolvedValue('dev')
}));

jest.mock('../../../lib/resolvers/dimension-file', () => ({
  readDimensionCreateFile: jest.fn()
}));

jest.mock('../../../lib/api/dimensions.api', () => ({
  listDimensions: jest.fn(),
  getDimension: jest.fn(),
  createDimensionIdempotent: jest.fn()
}));

jest.mock('../../../lib/api/dimension-values.api', () => ({
  createDimensionValue: jest.fn()
}));

const { Command } = require('commander');
const logger = require('../../../lib/utils/logger');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const { readDimensionCreateFile } = require('../../../lib/resolvers/dimension-file');
const dimensionsApi = require('../../../lib/api/dimensions.api');
const dimensionValuesApi = require('../../../lib/api/dimension-values.api');
const { setupDimensionCommands } = require('../../../lib/commands/dimension');

let exitSpy;
beforeAll(() => {
  exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});
afterAll(() => {
  if (exitSpy) exitSpy.mockRestore();
});

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  setupDimensionCommands(program);
  return program;
}

describe('dimension command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('http://controller');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 't', controller: 'http://controller' });
  });

  it('create is idempotent: prints exists message when created=false', async() => {
    dimensionsApi.createDimensionIdempotent.mockResolvedValue({
      created: false,
      response: { data: { data: { key: 'customerRegion' } } }
    });
    const program = makeProgram();
    await expect(
      program.parseAsync(['node', 'aifabrix', 'dimension', 'create', '--key', 'customerRegion', '--display-name', 'Customer Region', '--data-type', 'string'])
    ).resolves.toBeDefined();

    expect(dimensionsApi.createDimensionIdempotent).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dimension exists'));
  });

  it('create supports --file input', async() => {
    readDimensionCreateFile.mockReturnValue({
      key: 'customerRegion',
      displayName: 'Customer Region',
      dataType: 'string',
      isRequired: false,
      values: [{ value: 'emea', displayName: 'EMEA' }]
    });
    dimensionsApi.createDimensionIdempotent.mockResolvedValue({
      created: true,
      response: { data: { data: { key: 'customerRegion' } } }
    });
    const program = makeProgram();
    await program.parseAsync(['node', 'aifabrix', 'dimension', 'create', '--file', './dim.json']);
    expect(readDimensionCreateFile).toHaveBeenCalled();
    expect(dimensionsApi.createDimensionIdempotent).toHaveBeenCalled();
    expect(dimensionValuesApi.createDimensionValue).toHaveBeenCalledWith(
      'http://controller',
      expect.any(Object),
      'customerRegion',
      expect.objectContaining({ value: 'emea', displayName: 'EMEA' })
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dimension created'));
  });

  it('fails when not authenticated', async() => {
    getOrRefreshDeviceToken.mockResolvedValue(null);
    const program = makeProgram();
    await expect(program.parseAsync(['node', 'aifabrix', 'dimension', 'list'])).rejects.toThrow(/process\.exit\(1\)/);
    expect(logger.error).toHaveBeenCalled();
  });

  it('list prints a table header row', async() => {
    dimensionsApi.listDimensions.mockResolvedValue({
      data: {
        data: [
          { key: 'customerRegion', displayName: 'Customer Region', dataType: 'string', isRequired: false }
        ]
      }
    });
    const program = makeProgram();
    await program.parseAsync(['node', 'aifabrix', 'dimension', 'list']);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dimensions in dev environment (http://controller)'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Key'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Display'));
  });

  it('get prints header block', async() => {
    dimensionsApi.getDimension.mockResolvedValue({
      data: {
        data: {
          key: 'sensitivity',
          displayName: 'Sensitivity',
          dataType: 'string',
          isRequired: true,
          dimensionValues: [{ value: 'public', displayName: 'Public' }]
        }
      }
    });
    const program = makeProgram();
    await program.parseAsync(['node', 'aifabrix', 'dimension', 'get', 'sensitivity']);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dimension in dev environment (http://controller)'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Key:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('sensitivity'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Values:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('public'));
  });
});

