/**
 * @fileoverview Tests for lib/commands/auth-status-display.js (plan 142.0).
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const {
  displayDataplaneVersionSection,
  displayCliUpgradeRequired
} = require('../../../lib/commands/auth-status-display');

describe('auth-status-display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function combinedOutput() {
    return logger.log.mock.calls.map(call => call[0]).join('\n');
  }

  describe('displayDataplaneVersionSection', () => {
    it('renders OK block when CLI meets minimum', () => {
      displayDataplaneVersionSection({
        connected: true,
        dataplaneVersion: '1.9.5',
        minBuilderCliVersion: '2.45.0',
        cliVersion: '2.45.0',
        compatible: true
      });
      const out = combinedOutput();
      expect(out).toContain('Dataplane version');
      expect(out).toContain('1.9.5');
      expect(out).toContain('Min Builder CLI');
      expect(out).toContain('2.45.0');
      expect(out).toContain('OK');
    });

    it('renders Upgrade required when CLI is too old', () => {
      displayDataplaneVersionSection({
        connected: true,
        dataplaneVersion: '1.9.5',
        minBuilderCliVersion: '2.45.0',
        cliVersion: '2.44.0',
        compatible: false
      });
      expect(combinedOutput()).toMatch(/Upgrade required/);
    });

    it('renders Not enforced when min is missing', () => {
      displayDataplaneVersionSection({
        connected: true,
        dataplaneVersion: '1.9.5',
        minBuilderCliVersion: undefined,
        cliVersion: '2.45.0',
        compatible: true
      });
      expect(combinedOutput()).toMatch(/Not enforced/);
    });

    it('renders nothing when not connected and no cached version', () => {
      displayDataplaneVersionSection({
        connected: false,
        dataplaneVersion: undefined,
        minBuilderCliVersion: undefined,
        cliVersion: '2.45.0',
        compatible: true
      });
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('still renders when offline but cache has values', () => {
      displayDataplaneVersionSection({
        connected: false,
        dataplaneVersion: '1.9.4',
        minBuilderCliVersion: '2.45.0',
        cliVersion: '2.45.0',
        compatible: true
      });
      expect(combinedOutput()).toContain('1.9.4');
    });
  });

  describe('displayCliUpgradeRequired', () => {
    it('emits a blank line then the blocking error + Next actions', () => {
      displayCliUpgradeRequired({ required: '2.45.0', installed: '2.44.0' });
      const out = combinedOutput();
      expect(out).toContain('Next actions');
      expect(out).toContain('npm install -g @aifabrix/builder@2.45.0');
    });
  });
});
