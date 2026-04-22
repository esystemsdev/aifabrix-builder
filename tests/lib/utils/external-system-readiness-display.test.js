/**
 * @fileoverview Tests for readiness upload display blocks (minimal + expanded + probe).
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));

const logger = require('../../../lib/utils/logger');
const {
  logUploadReadinessSummary,
  logServerValidationWarnings,
  logProbeRuntimeBlock
} = require('../../../lib/utils/external-system-readiness-display');

function stripAnsi(s) {
  const ESC = String.fromCharCode(27);
  const re = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
  return String(s).replace(re, '');
}

function joined() {
  return logger.log.mock.calls.map(c => stripAnsi(String(c[0]))).join('\n');
}

describe('external-system-readiness-display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prints minimal summary and probe hint', () => {
    logUploadReadinessSummary({
      systemKey: 'hubspot',
      minimal: true,
      willProbe: false,
      publication: {
        uploadId: 'u1',
        generateMcpContract: false,
        system: { key: 'hubspot' },
        datasources: [{ key: 'contacts', status: 'published', isActive: true }]
      },
      manifest: { system: {} }
    });

    const out = joined();
    expect(out).toContain('Upload complete: hubspot');
    expect(out).toContain('Ready: 1');
    expect(out).toContain('Use --probe for runtime verification');
  });

  it('prints server validation warnings when present', () => {
    logServerValidationWarnings({ warnings: ['missing optional field'] });
    expect(joined()).toContain('Server validation:');
    expect(joined()).toContain('Warning: missing optional field');
  });

  it('prints runtime readiness block from probe rows', () => {
    logProbeRuntimeBlock(
      {
        results: [
          { sourceKey: 'contacts', success: true, validationResults: { isValid: true } },
          { sourceKey: 'deals', success: false, error: '401' }
        ]
      },
      'hubspot'
    );

    const out = joined();
    expect(out).toContain('Runtime Readiness:');
    expect(out).toContain('contacts');
    expect(out).toContain('deals');
    expect(out).toContain('Credential Test:');
  });
});

