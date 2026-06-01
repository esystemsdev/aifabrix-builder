/**
 * @fileoverview Tests for lib/utils/validation-poll-ui.js
 */

'use strict';

const {
  buildValidationPollSpinnerText,
  createValidationPollHandlers
} = require('../../../lib/utils/validation-poll-ui');

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

describe('validation-poll-ui', () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true
    });
  });

  it('buildValidationPollSpinnerText handles missing envelope', () => {
    const deadlineMs = Date.now() + 120000;
    const t = buildValidationPollSpinnerText(null, 0, deadlineMs);
    expect(t).toContain('starting');
    expect(t).toContain('budget');
  });

  it('buildValidationPollSpinnerText uses subject when provided', () => {
    const deadlineMs = Date.now() + 60000;
    const t = buildValidationPollSpinnerText(null, 0, deadlineMs, 'hubspot-contacts');
    expect(t).toContain('Waiting for hubspot-contacts');
  });

  it('buildValidationPollSpinnerText includes completeness, status, poll index', () => {
    const deadlineMs = Date.now() + 60000;
    const t = buildValidationPollSpinnerText(
      { reportCompleteness: 'partial', status: 'running' },
      2,
      deadlineMs
    );
    expect(t).toContain('completeness=partial');
    expect(t).toContain('status=running');
    expect(t).toContain('poll 3');
  });

  it('createValidationPollHandlers finish is safe on non-TTY path', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const ui = createValidationPollHandlers(Date.now() + 5000);
    expect(ui.usesSpinner).toBe(false);
    ui.onPollProgress({ reportCompleteness: 'partial', status: 'x' }, 0, {});
    ui.finish();
  });

  it('createValidationPollHandlers quiet mode is a no-op', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    const ui = createValidationPollHandlers(Date.now() + 5000, { quiet: true });
    expect(ui.usesSpinner).toBe(false);
    ui.onPollProgress({ reportCompleteness: 'partial' }, 0, {});
    ui.finish();
  });
});
