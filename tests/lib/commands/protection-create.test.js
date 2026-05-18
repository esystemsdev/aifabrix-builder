'use strict';

jest.mock('chalk', () => {
  const mock = (t) => t;
  mock.red = (t) => t;
  mock.gray = (t) => t;
  mock.green = (t) => t;
  mock.yellow = (t) => t;
  mock.bold = (t) => t;
  mock.cyan = (t) => t;
  mock.blue = (t) => t;
  mock.magenta = (t) => t;
  mock.dim = (t) => t;
  return mock;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/protection/run-protection-create', () => ({
  runProtectionCreate: jest.fn()
}));

const { Command } = require('commander');
const { runProtectionCreate } = require('../../../lib/protection/run-protection-create');
const { setupProtectionCommands } = require('../../../lib/commands/protection');

function captureHelp(command) {
  let output = '';
  command.configureOutput({
    writeOut: (text) => {
      output += text;
    }
  });
  command.outputHelp();
  return output;
}

describe('protection create command', () => {
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
    runProtectionCreate.mockResolvedValue(0);
  });

  it('registers create and passes type without dimension-key', async() => {
    const program = new Command();
    program.exitOverride();
    setupProtectionCommands(program);
    await program.parseAsync([
      'node',
      'aifabrix',
      'protection',
      'create',
      'hubspot-companies',
      '--type',
      'country-sales'
    ]);
    expect(runProtectionCreate).toHaveBeenCalledWith(
      'hubspot-companies',
      expect.objectContaining({ type: 'country-sales' }),
      expect.any(Object)
    );
  });

  it('passes optional dimension-key and field overrides', async() => {
    const program = new Command();
    program.exitOverride();
    setupProtectionCommands(program);
    await program.parseAsync([
      'node',
      'aifabrix',
      'protection',
      'create',
      'hubspot-companies',
      '--type',
      'country-sales',
      '--dimension-key',
      'country',
      '--field',
      'countryCode'
    ]);
    expect(runProtectionCreate).toHaveBeenCalledWith(
      'hubspot-companies',
      expect.objectContaining({ type: 'country-sales', dimensionKey: 'country', field: 'countryCode' }),
      expect.any(Object)
    );
  });

  it('shows standard examples in parent help', () => {
    const program = new Command();
    setupProtectionCommands(program);
    const protection = program.commands.find((cmd) => cmd.name() === 'protection');
    const help = captureHelp(protection);
    expect(help).toContain('Examples:');
    expect(help).toContain('aifabrix protection create hubspot-companies --type country-sales');
    expect(help).toContain('Per-command help:  aifabrix protection <command> --help');
  });

  it('shows standard examples in create help', () => {
    const program = new Command();
    setupProtectionCommands(program);
    const protection = program.commands.find((cmd) => cmd.name() === 'protection');
    const create = protection.commands.find((cmd) => cmd.name() === 'create');
    const help = captureHelp(create);
    expect(help).toContain('Examples:');
    expect(help).toContain('aifabrix protection create hubspot-companies --type country-sales');
    expect(help).toContain('Preset types:');
  });
});
