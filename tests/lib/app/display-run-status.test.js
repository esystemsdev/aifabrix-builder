/**
 * @fileoverview displayRunStatus — primary URL uses Traefik public base when enabled
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
  const appConfig = { developerId: 2, port: 3000 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockComputeHealthCheckUrl.mockResolvedValue('http://localhost:3200/health');
    mockComputeTraefikPublicAppUrl.mockResolvedValue(null);
  });

  it('prints localhost when Traefik mode is off', async() => {
    await displayRunStatus('miso-controller', 3200, appConfig, null, {});
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('App running at http://localhost:3200'));
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Local direct:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Next actions:'));
    expect(mockComputeTraefikPublicAppUrl).not.toHaveBeenCalled();
  });

  it('prints public URL and Local direct when traefikEnabled and public base resolves', async() => {
    mockComputeTraefikPublicAppUrl.mockResolvedValue('https://dev02.builder02.local/miso');
    mockComputeHealthCheckUrl.mockResolvedValue('https://dev02.builder02.local/miso/health');
    await displayRunStatus('miso-controller', 3200, appConfig, null, { traefikEnabled: true });
    expect(mockComputeTraefikPublicAppUrl).toHaveBeenCalledWith('miso-controller', 3200, appConfig);
    expect(mockComputeHealthCheckUrl).toHaveBeenCalledWith(
      'miso-controller',
      3200,
      appConfig,
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

  it('treats probeViaTraefik like traefikEnabled for primary URL', async() => {
    mockComputeTraefikPublicAppUrl.mockResolvedValue('https://edge.example/app');
    mockComputeHealthCheckUrl.mockResolvedValue('https://edge.example/app/health');
    await displayRunStatus('myapp', 3100, appConfig, null, { probeViaTraefik: true });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('App running at https://edge.example/app'));
  });

  it('falls back to localhost when Traefik wanted but public base is null', async() => {
    mockComputeTraefikPublicAppUrl.mockResolvedValue(null);
    await displayRunStatus('plain-app', 3000, appConfig, null, { traefikEnabled: true });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('App running at http://localhost:3000'));
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Local direct:'));
  });
});
