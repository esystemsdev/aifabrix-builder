/**
 * Tests for `lib/cli/setup-platform.js` (commander registration).
 *
 * Verifies that the `setup` and `teardown` commands attach to a Commander
 * program with the expected names, descriptions, and `--yes` option.
 *
 * @fileoverview Unit tests for setup-platform CLI registration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

jest.mock('../../../lib/commands/setup');
jest.mock('../../../lib/commands/teardown');

const { Command } = require('commander');

const { setupPlatformCommands, registerSetup, registerTeardown } = require('../../../lib/cli/setup-platform');
const { handleSetup } = require('../../../lib/commands/setup');
const { handleTeardown } = require('../../../lib/commands/teardown');

describe('lib/cli/setup-platform', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    handleSetup.mockResolvedValue(undefined);
    handleTeardown.mockResolvedValue(undefined);
  });

  it('registerSetup attaches a "setup" command with --yes', () => {
    const program = new Command();
    program.exitOverride();
    registerSetup(program);
    const cmd = program.commands.find(c => c.name() === 'setup');
    expect(cmd).toBeDefined();
    expect(cmd.description()).toMatch(/install or refresh the full ai fabrix platform/i);
    const yes = cmd.options.find(o => o.long === '--yes');
    expect(yes).toBeDefined();
  });

  it('registerTeardown attaches a "teardown" command with --yes', () => {
    const program = new Command();
    program.exitOverride();
    registerTeardown(program);
    const cmd = program.commands.find(c => c.name() === 'teardown');
    expect(cmd).toBeDefined();
    expect(cmd.description()).toMatch(/tear down/i);
    const yes = cmd.options.find(o => o.long === '--yes');
    expect(yes).toBeDefined();
  });

  it('setupPlatformCommands registers both commands', () => {
    const program = new Command();
    program.exitOverride();
    setupPlatformCommands(program);
    const names = program.commands.map(c => c.name());
    expect(names).toEqual(expect.arrayContaining(['setup', 'teardown']));
  });

  it('invokes handleSetup with parsed options', async() => {
    const program = new Command();
    program.exitOverride();
    registerSetup(program);
    await program.parseAsync(['node', 'aifabrix', 'setup', '--yes']);
    expect(handleSetup).toHaveBeenCalledWith(expect.objectContaining({ yes: true }));
  });

  it('invokes handleTeardown with parsed options', async() => {
    const program = new Command();
    program.exitOverride();
    registerTeardown(program);
    await program.parseAsync(['node', 'aifabrix', 'teardown', '-y']);
    expect(handleTeardown).toHaveBeenCalledWith(expect.objectContaining({ yes: true }));
  });
});
