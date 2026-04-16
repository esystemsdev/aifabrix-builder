/**
 * @fileoverview Unit tests for cli-test-layout-chalk (layout.md semantics).
 */

'use strict';

const chalk = require('chalk');
const {
  successGlyph,
  formatBlockingError,
  formatIssue,
  formatNextActions,
  formatDocsLine,
  formatProgress,
  formatBulletSection,
  formatStatusKeyValue,
  aggregateStatusWord,
  formatSuccessLine,
  formatSuccessParagraph,
  failureGlyph
} = require('../../../lib/utils/cli-test-layout-chalk');

describe('cli-test-layout-chalk', () => {
  it('successGlyph returns green check', () => {
    const s = successGlyph();
    expect(s).toContain('✔');
    if (chalk.level > 0) {
      expect(s).not.toBe('✔');
    }
  });

  it('formatBlockingError prefixes with failure glyph', () => {
    const s = formatBlockingError('Permission denied');
    expect(s).toContain('✖');
    expect(s).toContain('Permission denied');
  });

  it('formatIssue adds optional Hint line', () => {
    const noHint = formatIssue('Missing mapping');
    expect(noHint).toContain('✖');
    expect(noHint).toContain('Missing mapping');
    expect(noHint).not.toContain('Hint:');

    const withHint = formatIssue('Missing mapping', 'Fix in JSON');
    expect(withHint).toContain('Hint:');
    expect(withHint).toContain('Fix in JSON');
  });

  it('formatNextActions lists cyan bullets', () => {
    const s = formatNextActions(['Run validate', 'Deploy']);
    expect(s).toContain('Next actions:');
    expect(s).toContain('Run validate');
    expect(s).toContain('Deploy');
  });

  it('formatDocsLine adds colon to label', () => {
    expect(formatDocsLine('Docs', 'https://example.com')).toContain('Docs:');
    expect(formatDocsLine('Docs:', 'https://example.com')).toContain('https://example.com');
  });

  it('formatProgress uses hourglass', () => {
    expect(formatProgress('Running')).toContain('⏳');
    expect(formatProgress('Running')).toContain('Running');
  });

  it('formatBulletSection defaults cyan bullets', () => {
    const s = formatBulletSection('Impact:', ['a', 'b']);
    expect(s).toContain('Impact:');
    expect(s).toContain('a');
  });

  it('formatBulletSection supports red bullets', () => {
    const s = formatBulletSection('Impact:', ['x'], { bullet: 'red' });
    expect(s).toContain('x');
  });

  it('aggregateStatusWord and formatStatusKeyValue', () => {
    expect(aggregateStatusWord('ok')).toBe('OK');
    expect(formatStatusKeyValue('ok', '✔')).toContain('OK');
    expect(formatStatusKeyValue('fail', '✖')).toContain('FAIL');
  });

  it('formatSuccessLine and formatSuccessParagraph include check', () => {
    expect(formatSuccessLine('Done')).toContain('✔');
    expect(formatSuccessParagraph('Done')).toContain('\n✔');
  });

  it('failureGlyph is red cross', () => {
    expect(failureGlyph()).toContain('✖');
  });
});
