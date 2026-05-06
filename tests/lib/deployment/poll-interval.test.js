/**
 * @fileoverview Tests for poll-interval helper
 */

const {
  resolvePollIntervalMs,
  isFastPollingDeploymentType,
  FAST_POLL_MS,
  STANDARD_POLL_MS
} = require('../../../lib/deployment/poll-interval');

describe('poll-interval', () => {
  it('uses fast interval for local and database deployment types', () => {
    expect(isFastPollingDeploymentType('local')).toBe(true);
    expect(isFastPollingDeploymentType('database')).toBe(true);
    expect(isFastPollingDeploymentType('LOCAL')).toBe(true);
    expect(resolvePollIntervalMs('database', undefined)).toBe(FAST_POLL_MS);
    expect(resolvePollIntervalMs('local', undefined)).toBe(FAST_POLL_MS);
  });

  it('uses standard interval for azure modes', () => {
    expect(isFastPollingDeploymentType('azure')).toBe(false);
    expect(isFastPollingDeploymentType('azure-mock')).toBe(false);
    expect(resolvePollIntervalMs('azure', undefined)).toBe(STANDARD_POLL_MS);
    expect(resolvePollIntervalMs('azure-mock', undefined)).toBe(STANDARD_POLL_MS);
  });

  it('honors explicit positive poll interval', () => {
    expect(resolvePollIntervalMs('database', 750)).toBe(750);
    expect(resolvePollIntervalMs('azure', '3000')).toBe(3000);
  });
});
