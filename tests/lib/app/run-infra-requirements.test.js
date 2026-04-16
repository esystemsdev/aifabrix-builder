/**
 * @fileoverview Tests for getAppInfraRequirements
 */

const { getAppInfraRequirements } = require('../../../lib/app/run-infra-requirements');

describe('run-infra-requirements', () => {
  it('returns null when requires is absent', () => {
    expect(getAppInfraRequirements({ app: { key: 'x' } })).toBeNull();
  });

  it('detects postgres from database flag', () => {
    expect(getAppInfraRequirements({ requires: { database: true, redis: false } })).toEqual({
      needsPostgres: true,
      needsRedis: false
    });
  });

  it('detects postgres from databases array even if database is false', () => {
    expect(
      getAppInfraRequirements({ requires: { database: false, redis: false, databases: [{ name: 'a' }] } })
    ).toEqual({ needsPostgres: true, needsRedis: false });
  });

  it('detects redis', () => {
    expect(getAppInfraRequirements({ requires: { database: false, redis: true } })).toEqual({
      needsPostgres: false,
      needsRedis: true
    });
  });
});
