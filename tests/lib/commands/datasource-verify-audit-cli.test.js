/**
 * @fileoverview Tests for datasource verify-audit CLI
 */

'use strict';

jest.mock('../../../lib/datasource/audit-evidence-extract', () => ({
  loadEnvelopeFromLatestE2eLog: jest.fn()
}));
jest.mock('../../../lib/datasource/audit-evidence-run', () => ({
  runAuditEvidenceVerification: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

const { loadEnvelopeFromLatestE2eLog } = require('../../../lib/datasource/audit-evidence-extract');
const { runAuditEvidenceVerification } = require('../../../lib/datasource/audit-evidence-run');
const logger = require('../../../lib/utils/logger');
const { verifyAuditCommandAction } = require('../../../lib/commands/datasource-verify-audit-cli');

const PASS_VERIFICATION = {
  status: 'passed',
  datasourceKey: 'test-ds',
  correlationId: 'c1',
  executionIds: ['e1'],
  matrix: [{ row: 1, status: 'passed', detail: 'ok' }]
};

describe('datasource-verify-audit-cli', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadEnvelopeFromLatestE2eLog.mockResolvedValue({ datasourceKey: 'test-ds', testRunId: 'c1' });
    runAuditEvidenceVerification.mockResolvedValue({
      verification: PASS_VERIFICATION,
      exitCode: 0
    });
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit.mockRestore();
  });

  it('prints matrix TTY on success', async() => {
    await verifyAuditCommandAction('test-ds', { verbose: true });
    expect(runAuditEvidenceVerification).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('exits 1 when matrix fails', async() => {
    runAuditEvidenceVerification.mockResolvedValue({
      verification: { ...PASS_VERIFICATION, status: 'failed' },
      exitCode: 1
    });
    await verifyAuditCommandAction('test-ds', {});
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('exits 3 when log missing', async() => {
    loadEnvelopeFromLatestE2eLog.mockResolvedValue(null);
    await verifyAuditCommandAction('test-ds', {});
    expect(logger.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(3);
  });
});
