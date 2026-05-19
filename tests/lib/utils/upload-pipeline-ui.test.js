'use strict';

jest.mock('ora', () => {
  const stop = jest.fn();
  const start = jest.fn(() => ({ stop, text: '' }));
  return jest.fn(() => ({ start, stop }));
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const ora = require('ora');
const logger = require('../../../lib/utils/logger');
const {
  buildUploadPipelineSpinnerLabel,
  runWithUploadPipelineSpinner
} = require('../../../lib/utils/upload-pipeline-ui');

describe('upload-pipeline-ui', () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY;
    jest.clearAllMocks();
  });

  it('buildUploadPipelineSpinnerLabel includes system key', () => {
    expect(buildUploadPipelineSpinnerLabel('test-e2e-hubspot')).toContain('test-e2e-hubspot');
  });

  it('logs progress line when not TTY', async() => {
    process.stdout.isTTY = false;
    const work = jest.fn().mockResolvedValue({ ok: true });
    await runWithUploadPipelineSpinner(work, { systemKey: 'test-e2e-hubspot' });
    const line = String(logger.log.mock.calls[0][0]);
    expect(line).toContain('Publishing test-e2e-hubspot to dataplane');
    expect(ora).not.toHaveBeenCalled();
    expect(work).toHaveBeenCalled();
  });

  it('uses ora with label text on TTY (no separate blank spinner)', async() => {
    process.stdout.isTTY = true;
    await runWithUploadPipelineSpinner(jest.fn().mockResolvedValue(undefined), {
      systemKey: 'test-e2e-hubspot'
    });
    expect(logger.log).not.toHaveBeenCalled();
    expect(ora).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Publishing test-e2e-hubspot to dataplane')
      })
    );
  });

  it('skips output when json', async() => {
    process.stdout.isTTY = true;
    await runWithUploadPipelineSpinner(jest.fn().mockResolvedValue(undefined), {
      systemKey: 'hubspot',
      json: true
    });
    expect(logger.log).not.toHaveBeenCalled();
    expect(ora).not.toHaveBeenCalled();
  });
});
