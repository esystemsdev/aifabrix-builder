/**
 * @fileoverview Tests for infra-compose-service-names.js
 */

'use strict';

const {
  getRestartableInfraServiceNames,
  buildRestartInfraHelpLines,
  RESTARTABLE_INFRA_SERVICES
} = require('../../../lib/constants/infra-compose-service-names');

describe('infra-compose-service-names', () => {
  it('exports stable ordered service names', () => {
    expect(getRestartableInfraServiceNames()).toEqual([
      'postgres',
      'redis',
      'pgadmin',
      'redis-commander',
      'traefik'
    ]);
    expect(RESTARTABLE_INFRA_SERVICES.length).toBe(5);
  });

  it('buildRestartInfraHelpLines includes each name and description', () => {
    const block = buildRestartInfraHelpLines();
    expect(block).toContain('postgres');
    expect(block).toContain('PostgreSQL');
    expect(block).toContain('redis-commander');
    expect(block).toContain('traefik');
  });
});
