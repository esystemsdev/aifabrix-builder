/**
 * @fileoverview Tests for datasource load/export CLI helpers (plan 144)
 */

'use strict';

const {
  computeLoadExitCode,
  computeExportExitCode
} = require('../../../lib/commands/datasource-load-export-cli');

describe('datasource-load-export-cli', () => {
  describe('computeLoadExitCode', () => {
    it('returns 0 for dry-run', () => {
      expect(computeLoadExitCode({ dryRun: true, totals: { failedCount: 5 } })).toBe(0);
    });

    it('returns 1 when batches failed', () => {
      expect(computeLoadExitCode({ dryRun: false, totals: { failedCount: 2 } })).toBe(1);
    });

    it('returns 0 on full success', () => {
      expect(computeLoadExitCode({ dryRun: false, totals: { failedCount: 0 } })).toBe(0);
    });
  });

  describe('computeExportExitCode', () => {
    it('returns 1 in strict mode with zero rows', () => {
      expect(computeExportExitCode({ recordCount: 0 }, { strict: true })).toBe(1);
    });

    it('returns 0 when strict but rows exist', () => {
      expect(computeExportExitCode({ recordCount: 3 }, { strict: true })).toBe(0);
    });
  });
});
