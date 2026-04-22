/**
 * Unit tests for checkInfraHealth selective postgres/redis options (lib/infrastructure/services.js).
 *
 * @fileoverview Ensures infra health checks only probe services that are included
 */

jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(0)
}));

jest.mock('../../../lib/utils/infra-containers', () => ({
  checkServiceWithHealthCheck: jest.fn().mockResolvedValue('healthy'),
  checkServiceWithoutHealthCheck: jest.fn().mockResolvedValue('healthy')
}));

const containerUtils = require('../../../lib/utils/infra-containers');
const { checkInfraHealth } = require('../../../lib/infrastructure/services');

describe('checkInfraHealth selective services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty object and skips all probes when postgres and redis are disabled', async() => {
    const result = await checkInfraHealth(0, { postgres: false, redis: false });
    expect(result).toEqual({});
    expect(containerUtils.checkServiceWithHealthCheck).not.toHaveBeenCalled();
    expect(containerUtils.checkServiceWithoutHealthCheck).not.toHaveBeenCalled();
  });

  it('checks only postgres and pgadmin when redis is disabled', async() => {
    await checkInfraHealth(0, { postgres: true, redis: false });
    expect(containerUtils.checkServiceWithHealthCheck).toHaveBeenCalledTimes(1);
    expect(containerUtils.checkServiceWithHealthCheck).toHaveBeenCalledWith('postgres', 0, {});
    expect(containerUtils.checkServiceWithoutHealthCheck).toHaveBeenCalledTimes(1);
    expect(containerUtils.checkServiceWithoutHealthCheck).toHaveBeenCalledWith('pgadmin', 0, {});
  });

  it('checks only redis and redis-commander when postgres is disabled', async() => {
    await checkInfraHealth(0, { postgres: false, redis: true });
    expect(containerUtils.checkServiceWithHealthCheck).toHaveBeenCalledTimes(1);
    expect(containerUtils.checkServiceWithHealthCheck).toHaveBeenCalledWith('redis', 0, {});
    expect(containerUtils.checkServiceWithoutHealthCheck).toHaveBeenCalledTimes(1);
    expect(containerUtils.checkServiceWithoutHealthCheck).toHaveBeenCalledWith('redis-commander', 0, {});
  });

  it('does not check pgadmin when postgres is enabled but pgadmin option is false', async() => {
    await checkInfraHealth(0, { postgres: true, redis: false, pgadmin: false });
    expect(containerUtils.checkServiceWithHealthCheck).toHaveBeenCalledWith('postgres', 0, {});
    expect(containerUtils.checkServiceWithoutHealthCheck).not.toHaveBeenCalled();
  });

  it('does not check redis-commander when redis is enabled but redisCommander option is false', async() => {
    await checkInfraHealth(0, { postgres: false, redis: true, redisCommander: false });
    expect(containerUtils.checkServiceWithHealthCheck).toHaveBeenCalledWith('redis', 0, {});
    expect(containerUtils.checkServiceWithoutHealthCheck).not.toHaveBeenCalled();
  });

  it('checks full default stack when options object is empty', async() => {
    await checkInfraHealth(0, {});
    expect(containerUtils.checkServiceWithHealthCheck).toHaveBeenCalledTimes(2);
    expect(containerUtils.checkServiceWithHealthCheck).toHaveBeenCalledWith('postgres', 0, {});
    expect(containerUtils.checkServiceWithHealthCheck).toHaveBeenCalledWith('redis', 0, {});
    expect(containerUtils.checkServiceWithoutHealthCheck).toHaveBeenCalledTimes(2);
    expect(containerUtils.checkServiceWithoutHealthCheck).toHaveBeenCalledWith('pgadmin', 0, {});
    expect(containerUtils.checkServiceWithoutHealthCheck).toHaveBeenCalledWith('redis-commander', 0, {});
  });

  it('passes strict option to container checks when strict is true', async() => {
    await checkInfraHealth(0, { postgres: true, redis: false, strict: true });
    expect(containerUtils.checkServiceWithHealthCheck).toHaveBeenCalledWith('postgres', 0, { strict: true });
    expect(containerUtils.checkServiceWithoutHealthCheck).toHaveBeenCalledWith('pgadmin', 0, { strict: true });
  });

  it('includes traefik when traefik option is true', async() => {
    await checkInfraHealth(0, { postgres: false, redis: false, traefik: true });
    expect(containerUtils.checkServiceWithHealthCheck).not.toHaveBeenCalled();
    expect(containerUtils.checkServiceWithoutHealthCheck).toHaveBeenCalledTimes(1);
    expect(containerUtils.checkServiceWithoutHealthCheck).toHaveBeenCalledWith('traefik', 0, {});
  });
});
