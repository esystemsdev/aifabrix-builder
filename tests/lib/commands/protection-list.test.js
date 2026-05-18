'use strict';

jest.mock('chalk', () => {
  const mock = (t) => t;
  mock.red = (t) => t;
  mock.gray = (t) => t;
  mock.green = (t) => t;
  mock.yellow = (t) => t;
  mock.bold = (t) => t;
  return mock;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/protection/run-commands', () => ({
  runProtectionValidate: jest.fn(),
  runProtectionUpload: jest.fn(),
  runProtectionList: jest.fn(),
  runProtectionShow: jest.fn(),
  runProtectionDelete: jest.fn()
}));

const { Command } = require('commander');
const { runProtectionList } = require('../../../lib/protection/run-commands');
const { setupProtectionCommands } = require('../../../lib/commands/protection');

describe('protection list command', () => {
  let exitSpy;
  let stdoutSpy;

  beforeAll(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterAll(() => {
    exitSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    runProtectionList.mockResolvedValue(0);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('registers protection list and passes json flag', async() => {
    const program = new Command();
    program.exitOverride();
    setupProtectionCommands(program);
    await program.parseAsync(['node', 'aifabrix', 'protection', 'list', '--json']);
    expect(runProtectionList).toHaveBeenCalledWith(
      expect.objectContaining({ json: true }),
      expect.any(Object)
    );
  });

  it('registers protection list with filter option', async() => {
    const program = new Command();
    program.exitOverride();
    setupProtectionCommands(program);
    await program.parseAsync([
      'node',
      'aifabrix',
      'protection',
      'list',
      '--filter',
      'enabled:eq:true'
    ]);
    expect(runProtectionList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'enabled:eq:true' }),
      expect.any(Object)
    );
  });

  it('registers protection list with pagination options', async() => {
    const program = new Command();
    program.exitOverride();
    setupProtectionCommands(program);
    await program.parseAsync([
      'node',
      'aifabrix',
      'protection',
      'list',
      '--page',
      '2',
      '--page-size',
      '10'
    ]);
    expect(runProtectionList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10 }),
      expect.any(Object)
    );
  });
});
