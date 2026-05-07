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
  normalizeControllerUrl: jest.fn((url) => (url ? url.replace(/\/$/, '') : url))
}));

jest.mock('../../../lib/api/dimension-values.api', () => ({
  listDimensionValues: jest.fn(),
  createDimensionValue: jest.fn(),
  deleteDimensionValue: jest.fn()
}));

const { Command } = require('commander');
const logger = require('../../../lib/utils/logger');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const api = require('../../../lib/api/dimension-values.api');
const { setupDimensionValueCommands } = require('../../../lib/commands/dimension-value');

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
  setupDimensionValueCommands(program);
  return program;
}

describe('dimension-value command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('http://controller');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 't', controller: 'http://controller' });
  });

  it('create calls API and prints success', async() => {
    api.createDimensionValue.mockResolvedValue({ data: { data: { value: 'confidential' } } });
    const program = makeProgram();
    await program.parseAsync([
      'node',
      'aifabrix',
      'dimension-value',
      'create',
      'dataClassification',
      '--value',
      'confidential'
    ]);
    expect(api.createDimensionValue).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dimension value created'));
  });

  it('list prints dimension header', async() => {
    api.listDimensionValues.mockResolvedValue({ data: { data: [] } });
    const program = makeProgram();
    await program.parseAsync(['node', 'aifabrix', 'dimension-value', 'list', 'dataClassification']);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dimension:'));
  });

  it('delete calls API and prints success', async() => {
    api.deleteDimensionValue.mockResolvedValue({ success: true });
    const program = makeProgram();
    await program.parseAsync(['node', 'aifabrix', 'dimension-value', 'delete', 'clx1']);
    expect(api.deleteDimensionValue).toHaveBeenCalledWith('http://controller', expect.any(Object), 'clx1');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dimension value deleted'));
  });

  it('fails when not authenticated', async() => {
    getOrRefreshDeviceToken.mockResolvedValue(null);
    const program = makeProgram();
    await expect(
      program.parseAsync(['node', 'aifabrix', 'dimension-value', 'list', 'dataClassification'])
    ).rejects.toThrow(/process\.exit\(1\)/);
    expect(logger.error).toHaveBeenCalled();
  });
});

