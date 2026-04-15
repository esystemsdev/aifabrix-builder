/**
 * @fileoverview Tests for external-system-readiness-core
 */

const {
  unwrapPublicationResult,
  classifyDatasourceTierA,
  summarizeDatasourceTiersA,
  aggregateVerdictFromCounts,
  classifyDatasourceTierB,
  extractIdentitySummary,
  resolveCredentialTestEndpointDisplay,
  formatDataplaneFetchReason,
  buildNextActionsTierA
} = require('../../../lib/utils/external-system-readiness-core');

describe('external-system-readiness-core', () => {
  describe('unwrapPublicationResult', () => {
    it('unwraps { success, data } envelope', () => {
      const pub = {
        uploadId: 'u1',
        datasources: [],
        system: { key: 'x' },
        generateMcpContract: true
      };
      expect(unwrapPublicationResult({ success: true, data: pub })).toEqual(pub);
    });

    it('returns null when shape invalid', () => {
      expect(unwrapPublicationResult({ success: true, data: { foo: 1 } })).toBeNull();
    });
  });

  describe('classifyDatasourceTierA', () => {
    it('marks published active with MCP as ready', () => {
      expect(
        classifyDatasourceTierA(
          { key: 'a', status: 'published', isActive: true, mcpContract: {} },
          true
        )
      ).toBe('ready');
    });

    it('partial when MCP expected but missing', () => {
      expect(
        classifyDatasourceTierA({ key: 'a', status: 'published', isActive: true }, true)
      ).toBe('partial');
    });

    it('failed when inactive', () => {
      expect(
        classifyDatasourceTierA({ key: 'a', status: 'published', isActive: false, mcpContract: {} }, true)
      ).toBe('failed');
    });
  });

  describe('aggregateVerdictFromCounts', () => {
    it('READY when all ready', () => {
      expect(aggregateVerdictFromCounts({ ready: 2, partial: 0, failed: 0 })).toBe('READY');
    });

    it('FAILED when all failed', () => {
      expect(aggregateVerdictFromCounts({ ready: 0, partial: 0, failed: 2 })).toBe('FAILED');
    });

    it('PARTIAL when mixed', () => {
      expect(aggregateVerdictFromCounts({ ready: 1, partial: 1, failed: 0 })).toBe('PARTIAL');
    });
  });

  describe('classifyDatasourceTierB', () => {
    it('failed when success false', () => {
      expect(classifyDatasourceTierB({ success: false, sourceKey: 'x' })).toBe('failed');
    });

    it('ready when valid', () => {
      expect(
        classifyDatasourceTierB({
          success: true,
          sourceKey: 'x',
          validationResults: { isValid: true }
        })
      ).toBe('ready');
    });
  });

  describe('extractIdentitySummary', () => {
    it('defaults when missing', () => {
      const s = extractIdentitySummary({});
      expect(s.mode).toBe('system');
      expect(s.attribution).toBe('disabled');
    });
  });

  describe('resolveCredentialTestEndpointDisplay', () => {
    it('joins baseUrl and path', () => {
      const url = resolveCredentialTestEndpointDisplay({
        authentication: {
          method: 'apikey',
          variables: { baseUrl: 'https://api.example.com', testEndpoint: '/v1/health' }
        }
      });
      expect(url).toBe('https://api.example.com/v1/health');
    });
  });

  describe('formatDataplaneFetchReason', () => {
    it('detects connection refused', () => {
      const r = formatDataplaneFetchReason(new Error('connect ECONNREFUSED'), 'http://localhost:3111');
      expect(r).toContain('connection refused');
    });
  });

  describe('buildNextActionsTierA', () => {
    it('suggests test-e2e for failed', () => {
      const lines = buildNextActionsTierA(
        'hubspot',
        { rows: [{ key: 'engagements', tier: 'failed' }] },
        true
      );
      expect(lines.some(l => l.includes('test-e2e'))).toBe(true);
    });
  });
});
