/**
 * @fileoverview Option wiring for datasource capability copy/create → runCapabilityCopy
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/datasource/capability/run-capability-copy', () => ({
  runCapabilityCopy: jest.fn().mockResolvedValue({
    dryRun: true,
    patchOperations: [],
    updatedSections: []
  })
}));

const { runCapabilityCopy } = require('../../../lib/datasource/capability/run-capability-copy');
const { runCopyLikeAction } = require('../../../lib/commands/datasource-capability');

describe('datasource capability runCopyLikeAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes basicExposure false (basic-exposure not exposed on CLI)', async() => {
    await runCopyLikeAction('f.json', {
      from: 'a',
      as: 'b',
      dryRun: true
    });
    expect(runCapabilityCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        basicExposure: false,
        includeTestPayload: false
      })
    );
  });

  it('passes overwrite, dryRun, noBackup', async() => {
    await runCopyLikeAction('f.json', {
      from: 'a',
      as: 'b',
      overwrite: true,
      dryRun: true,
      noBackup: true
    });
    expect(runCapabilityCopy).toHaveBeenCalledWith({
      fileOrKey: 'f.json',
      from: 'a',
      as: 'b',
      dryRun: true,
      overwrite: true,
      noBackup: true,
      basicExposure: false,
      includeTestPayload: false
    });
  });

  it('passes includeTestPayload when --test is set', async() => {
    await runCopyLikeAction('f.json', {
      from: 'a',
      as: 'b',
      dryRun: true,
      test: true
    });
    expect(runCapabilityCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        includeTestPayload: true
      })
    );
  });
});
