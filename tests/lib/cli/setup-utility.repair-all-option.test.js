/**
 * Tests for repair CLI registration and --all wiring.
 *
 * @fileoverview Unit tests for repair command options in setup-utility
 */

'use strict';

jest.mock('../../../lib/commands/repair', () => ({
  repairExternalIntegration: jest.fn()
}));
jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn(), error: jest.fn() }));
jest.mock('../../../lib/utils/cli-utils', () => ({
  handleCommandError: jest.fn(),
  logOfflinePathWhenType: jest.fn()
}));
jest.mock('../../../lib/core/config', () => ({
  getFormat: jest.fn()
}));

const { Command } = require('commander');

const { setupUtilityCommands } = require('../../../lib/cli/setup-utility');
const { repairExternalIntegration } = require('../../../lib/commands/repair');
const { detectAppType } = require('../../../lib/utils/paths');
const config = require('../../../lib/core/config');

describe('lib/cli/setup-utility repair --all', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    detectAppType.mockResolvedValue({ appPath: '/tmp/integration/test' });
    config.getFormat.mockResolvedValue('yaml');
    repairExternalIntegration.mockResolvedValue({ updated: false, changes: [], backupPaths: [] });
  });

  it('wires --all to enable all repair actions', async() => {
    const program = new Command();
    program.exitOverride();
    setupUtilityCommands(program);

    await program.parseAsync(['node', 'aifabrix', 'repair', 'test-e2e-hubspot', '--all']);

    expect(repairExternalIntegration).toHaveBeenCalledWith(
      'test-e2e-hubspot',
      expect.objectContaining({
        doc: true,
        rbac: true,
        expose: true,
        sync: true,
        api: true,
        test: true
      })
    );
  });
});

