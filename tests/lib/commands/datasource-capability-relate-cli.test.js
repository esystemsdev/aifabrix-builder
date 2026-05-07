/**
 * @fileoverview datasource capability relate CLI negatives (exit + blocking error)
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/datasource/capability/run-capability-relate', () => ({
  runCapabilityRelate: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { runCapabilityRelate } = require('../../../lib/datasource/capability/run-capability-relate');
const { Command } = require('commander');
const { setupCapabilityRelateCommand } = require('../../../lib/commands/datasource-capability-relate-cli');

describe('datasource capability relate CLI', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exit = jest.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it('exits 1 and prints blocking error when relate fails (semantic/schema)', async() => {
    runCapabilityRelate.mockRejectedValueOnce(new Error('Semantic validation failed: bad join'));

    const cap = new Command('capability');
    cap.exitOverride(); // prevent commander from calling process.exit itself
    setupCapabilityRelateCommand(cap);
    await cap.parseAsync([
      'node',
      'capability',
      'relate',
      'file.json',
      '--relation-name',
      'company',
      '--to',
      'target-ds',
      '--field',
      'companyId',
      '--dry-run'
    ]);

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('capability relate failed:'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Semantic validation failed'));
  });
});

