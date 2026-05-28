/**
 * Tests for Dataplane Resolver
 *
 * @fileoverview Tests for dataplane-resolver.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
const { discoverDataplaneUrl } = require('../../../lib/commands/wizard-dataplane');
const config = require('../../../lib/core/config');

jest.mock('../../../lib/commands/wizard-dataplane');
jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn()
}));

describe('Dataplane Resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AIFABRIX_DEPLOYMENT_AUTH;
    delete process.env.DP;
    delete process.env.DATAPLANE_URL;
  });

  describe('resolveDataplaneUrl', () => {
    it('should discover dataplane URL from controller', async() => {
      discoverDataplaneUrl.mockResolvedValue('https://discovered-dataplane.example.com');

      const result = await resolveDataplaneUrl(
        'https://controller.example.com',
        'dev',
        { token: 'test-token' }
      );

      expect(result).toBe('https://discovered-dataplane.example.com');
      expect(discoverDataplaneUrl).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        { token: 'test-token' },
        {}
      );
    });

    it('should use DP from env for any auth mode', async() => {
      process.env.DP = 'http://localhost:3611';

      const result = await resolveDataplaneUrl(
        'https://controller.example.com',
        'dev',
        { type: 'client-token', token: 't' }
      );

      expect(result).toBe('http://localhost:3611');
      expect(discoverDataplaneUrl).not.toHaveBeenCalled();
    });

    it('should align stale localhost controller URL to DATAPLANE_PUBLIC_PORT formula', async() => {
      discoverDataplaneUrl.mockResolvedValue('http://localhost:3601');
      config.getDeveloperId.mockResolvedValue('6');

      const result = await resolveDataplaneUrl(
        'http://localhost:3600',
        'dev',
        { token: 'test-token' }
      );

      expect(result).toBe('http://localhost:3611');
    });

    it('should keep controller URL when it already matches developer host port', async() => {
      discoverDataplaneUrl.mockResolvedValue('http://localhost:3611');
      config.getDeveloperId.mockResolvedValue('6');

      const result = await resolveDataplaneUrl(
        'http://localhost:3600',
        'dev',
        { token: 'test-token' }
      );

      expect(result).toBe('http://localhost:3611');
    });

    it('should re-throw errors from discovery', async() => {
      const error = new Error('Could not discover dataplane URL');
      discoverDataplaneUrl.mockRejectedValue(error);

      await expect(resolveDataplaneUrl(
        'https://controller.example.com',
        'dev',
        { token: 'test-token' }
      )).rejects.toThrow('Could not discover dataplane URL');
    });
  });
});
