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

jest.mock('../../../lib/protection/resolve', () => ({
  resolveProtectionArgument: jest.fn()
}));

jest.mock('../../../lib/protection/run-commands', () => ({
  runProtectionValidate: jest.fn(),
  runProtectionUpload: jest.fn(),
  runProtectionShow: jest.fn(),
  runProtectionDelete: jest.fn()
}));

const { Command } = require('commander');
const { resolveProtectionArgument } = require('../../../lib/protection/resolve');
const { runProtectionValidate } = require('../../../lib/protection/run-commands');
const { setupProtectionCommands } = require('../../../lib/commands/protection');

describe('protection validate command', () => {
  let exitSpy;

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
    resolveProtectionArgument.mockReturnValue({
      datasourceKey: 'hubspot-companies',
      manifestPath: '/work/.protection/hubspot-companies.yaml',
      manifest: { metadata: { key: 'p' }, spec: { datasourceKey: 'hubspot-companies' } }
    });
    runProtectionValidate.mockResolvedValue(0);
  });

  it('registers protection validate and passes warnings-as-errors', async() => {
    const program = new Command();
    program.exitOverride();
    setupProtectionCommands(program);
    await program.parseAsync([
      'node',
      'aifabrix',
      'protection',
      'validate',
      'hubspot-companies',
      '--warnings-as-errors'
    ]);
    expect(runProtectionValidate).toHaveBeenCalledWith(
      'hubspot-companies',
      expect.any(Object),
      expect.objectContaining({ warningsAsErrors: true }),
      expect.any(Object)
    );
  });
});
