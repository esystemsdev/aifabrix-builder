/**
 * @fileoverview Tests for datasource-validation-cli.js (unified validation exit + integration finalize).
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const {
  unifiedCliResultFromIntegrationReturn,
  finalizeAfterIntegrationDisplay,
  finalizeUnifiedValidationResult
} = require('../../../lib/commands/datasource-validation-cli');

describe('datasource-validation-cli', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('unifiedCliResultFromIntegrationReturn', () => {
    it('maps runMeta and datasourceTestRun into unified result shape', () => {
      const r = unifiedCliResultFromIntegrationReturn({
        datasourceTestRun: { status: 'ok' },
        runMeta: {
          apiError: { error: 'x' },
          pollTimedOut: true,
          incompleteNoAsync: true
        }
      });
      expect(r.envelope).toEqual({ status: 'ok' });
      expect(r.apiError).toEqual({ error: 'x' });
      expect(r.pollTimedOut).toBe(true);
      expect(r.incompleteNoAsync).toBe(true);
    });

    it('defaults meta fields when runMeta missing', () => {
      const r = unifiedCliResultFromIntegrationReturn({ datasourceTestRun: null });
      expect(r.envelope).toBeNull();
      expect(r.apiError).toBeNull();
      expect(r.pollTimedOut).toBe(false);
      expect(r.incompleteNoAsync).toBe(false);
    });
  });

  describe('finalizeAfterIntegrationDisplay', () => {
    it('returns 0 or 1 when no datasourceTestRun envelope', () => {
      expect(finalizeAfterIntegrationDisplay({ success: true })).toBe(0);
      expect(finalizeAfterIntegrationDisplay({ success: false })).toBe(1);
    });

    it('returns exit code from envelope status', () => {
      expect(finalizeAfterIntegrationDisplay({ success: true, datasourceTestRun: { status: 'ok' } })).toBe(0);
      expect(finalizeAfterIntegrationDisplay({ success: true, datasourceTestRun: { status: 'fail' } })).toBe(1);
    });

    it('requireCert without certificate logs and returns 2', () => {
      const code = finalizeAfterIntegrationDisplay(
        { success: true, datasourceTestRun: { status: 'ok' } },
        { requireCert: true }
      );
      expect(code).toBe(2);
      expect(logger.error).toHaveBeenCalled();
    });

    it('warningsAsErrors upgrades warn to exit 1', () => {
      expect(
        finalizeAfterIntegrationDisplay(
          { success: true, datasourceTestRun: { status: 'warn' } },
          { warningsAsErrors: true }
        )
      ).toBe(1);
    });
  });

  describe('finalizeUnifiedValidationResult', () => {
    it('returns 3 and logs when apiError present', () => {
      const code = finalizeUnifiedValidationResult(
        {
          apiError: { formattedError: 'bad', status: 502 },
          pollTimedOut: false,
          incompleteNoAsync: false,
          envelope: null
        },
        { json: true }
      );
      expect(code).toBe(3);
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns poll timeout code when pollTimedOut', () => {
      const code = finalizeUnifiedValidationResult(
        {
          apiError: null,
          pollTimedOut: true,
          incompleteNoAsync: false,
          envelope: { status: 'ok' }
        },
        { json: true }
      );
      expect(code).toBe(3);
      expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/timeout/));
    });

    it('returns 3 when incompleteNoAsync', () => {
      const code = finalizeUnifiedValidationResult(
        {
          apiError: null,
          pollTimedOut: false,
          incompleteNoAsync: true,
          envelope: null
        },
        { json: true }
      );
      expect(code).toBe(3);
    });

    it('prints JSON and returns 0 for ok envelope with json flag', () => {
      const env = { status: 'ok', datasourceKey: 'k' };
      const code = finalizeUnifiedValidationResult(
        {
          apiError: null,
          pollTimedOut: false,
          incompleteNoAsync: false,
          envelope: env
        },
        { json: true }
      );
      expect(code).toBe(0);
      expect(logger.log).toHaveBeenCalledWith(JSON.stringify(env));
    });

    it('returns 1 when status warn and warningsAsErrors', () => {
      const code = finalizeUnifiedValidationResult(
        {
          apiError: null,
          pollTimedOut: false,
          incompleteNoAsync: false,
          envelope: { status: 'warn' }
        },
        { json: true, warningsAsErrors: true }
      );
      expect(code).toBe(1);
    });

    it('returns 2 when requireCert and certificate missing', () => {
      const code = finalizeUnifiedValidationResult(
        {
          apiError: null,
          pollTimedOut: false,
          incompleteNoAsync: false,
          envelope: { status: 'ok' }
        },
        { json: true, requireCert: true }
      );
      expect(code).toBe(2);
      expect(logger.error).toHaveBeenCalled();
    });

    it('strictCapabilityScope bumps exit to 1 when multiple capability rows', () => {
      const code = finalizeUnifiedValidationResult(
        {
          apiError: null,
          pollTimedOut: false,
          incompleteNoAsync: false,
          envelope: {
            status: 'ok',
            capabilities: [{ key: 'read' }, { key: 'write' }]
          }
        },
        {
          json: true,
          requestedCapabilityKey: 'read',
          strictCapabilityScope: true
        }
      );
      expect(code).toBe(1);
    });

    it('strictCapabilityScope does not bump when single capability row', () => {
      const code = finalizeUnifiedValidationResult(
        {
          apiError: null,
          pollTimedOut: false,
          incompleteNoAsync: false,
          envelope: {
            status: 'ok',
            capabilities: [{ key: 'read' }]
          }
        },
        {
          json: true,
          requestedCapabilityKey: 'read',
          strictCapabilityScope: true
        }
      );
      expect(code).toBe(0);
    });
  });
});
