/**
 * @fileoverview Tests for datasource-load-export-ui.js
 */

'use strict';

const {
  formatElapsedMs,
  buildDatasourceLoadExportSpinnerLabel
} = require('../../../lib/utils/datasource-load-export-ui');

describe('datasource-load-export-ui', () => {
  describe('formatElapsedMs', () => {
    it('formats sub-second durations in ms', () => {
      expect(formatElapsedMs(250)).toBe('250 ms');
    });

    it('formats seconds with one decimal under 10s', () => {
      expect(formatElapsedMs(1500)).toBe('1.5 s');
    });

    it('formats minutes and seconds', () => {
      expect(formatElapsedMs(125000)).toBe('2 m 5 s');
    });
  });

  describe('buildDatasourceLoadExportSpinnerLabel', () => {
    it('uses load label by default', () => {
      expect(buildDatasourceLoadExportSpinnerLabel('load', 'my-ds')).toContain('Loading records');
    });

    it('uses export label', () => {
      expect(buildDatasourceLoadExportSpinnerLabel('export', 'my-ds')).toContain('Exporting records');
    });
  });
});
