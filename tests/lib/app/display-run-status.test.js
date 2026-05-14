/**
 * @fileoverview displayRunStatus — primary URL uses Traefik public base when infra + front door apply
 */

'use strict';

jest.mock('../../../lib/app/run-container-start', () => ({
  startContainer: jest.fn()
}));

const mockComputeHealthCheckUrl = jest.fn();
jest.mock('../../../lib/utils/health-check', () => ({
  computeHealthCheckUrl: (...args) => mockComputeHealthCheckUrl(...args)
}));

const mockComputeTraefikPublicAppUrl = jest.fn();
jest.mock('../../../lib/utils/health-check-url', () => ({
  ...jest.requireActual('../../../lib/utils/health-check-url'),
  computeTraefikPublicAppUrl: (...args) => mockComputeTraefikPublicAppUrl(...args)
}));

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { displayRunStatus } = require('../../../lib/app/run-helpers');

describe('displayRunStatus', () => {
  const appConfigBase = { developerId: 2, port: 3000 };
  const appWithFrontDoor = {
    ...appConfigBase,
    frontDoorRouting: {
      enabled: true,
      pattern: '/miso/*',
      host: 'dev.example.local',
      tls: true
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockComputeHealthCheckUrl.mockResolvedValue('http://localhost:3200/health');
    mockComputeTraefikPublicAppUrl.mockResolvedValue(null);
  });

  it('prints localhost when Traefik run mode is off', async() => {
    await displayRunStatus('miso-controller', 3200, appConfigBase, null, {});
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('App running at http://localhost:3200'));
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Local direct:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Next actions:'));
    expect(mockComputeTraefikPublicAppUrl).not.toHaveBeenCalled();
  });

  it('prints localhost when traefikEnabled but frontDoorRouting.enabled is false', async() => {
    const app = {
      ...appConfigBase,
      frontDoorRouting: { enabled: false, pattern: '/m/*', host: 'h', tls: true }
    };
    await displayRunStatus('miso-controller', 3200, app, null, { traefikEnabled: true });
    expect(mockComputeTraefikPublicAppUrl).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('App running at http://localhost:3200'));
  });

  it('prints public URL and Local direct when traefikEnabled and front door enabled and public base resolves', async() => {
    mockComputeTraefikPublicAppUrl.mockResolvedValue('https://dev02.builder02.local/miso');
    mockComputeHealthCheckUrl.mockResolvedValue('https://dev02.builder02.local/miso/health');
    await displayRunStatus('miso-controller', 3200, appWithFrontDoor, null, { traefikEnabled: true });
    expect(mockComputeTraefikPublicAppUrl).toHaveBeenCalledWith('miso-controller', 3200, appWithFrontDoor);
    expect(mockComputeHealthCheckUrl).toHaveBeenCalledWith(
      'miso-controller',
      3200,
      appWithFrontDoor,
      expect.objectContaining({ runOptions: { traefikEnabled: true } })
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('App running at https://dev02.builder02.local/miso')
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Local direct: http://localhost:3200'));
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Health check:')
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('https://dev02.builder02.local/miso/health'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Next actions:'));
  });

  it('treats probeViaTraefik like traefikEnabled when front door is on', async() => {
    mockComputeTraefikPublicAppUrl.mockResolvedValue('https://edge.example/app');
    mockComputeHealthCheckUrl.mockResolvedValue('https://edge.example/app/health');
    await displayRunStatus('myapp', 3100, appWithFrontDoor, null, { probeViaTraefik: true });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('App running at https://edge.example/app'));
  });

  it('falls back to localhost when Traefik + front door wanted but public base is null', async() => {
    mockComputeTraefikPublicAppUrl.mockResolvedValue(null);
    await displayRunStatus('plain-app', 3000, appWithFrontDoor, null, { traefikEnabled: true });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('App running at http://localhost:3000'));
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Local direct:'));
  });
});
