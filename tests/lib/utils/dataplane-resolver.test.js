/**
 * Tests for Dataplane Resolver
 *
 * @fileoverview Tests for dataplane-resolver.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
const { discoverDataplaneUrl } = require('../../../lib/commands/wizard-dataplane');
const { computeAppBaseUrl } = require('../../../lib/utils/platform-controller-url');

jest.mock('../../../lib/commands/wizard-dataplane');
jest.mock('../../../lib/utils/platform-controller-url', () => ({
  computeAppBaseUrl: jest.fn()
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

    it('should use DP from env when AIFABRIX_DEPLOYMENT_AUTH=client-credentials', async() => {
      process.env.AIFABRIX_DEPLOYMENT_AUTH = 'client-credentials';
      process.env.DP = 'http://localhost:3611';

      const result = await resolveDataplaneUrl(
        'https://controller.example.com',
        'dev',
        { type: 'client-token', token: 't' }
      );

      expect(result).toBe('http://localhost:3611');
      expect(discoverDataplaneUrl).not.toHaveBeenCalled();
    });

    it('should align stale localhost controller URL to builder dataplane port', async() => {
      discoverDataplaneUrl.mockResolvedValue('http://localhost:3601');
      computeAppBaseUrl.mockResolvedValue('http://localhost:3611');

      const result = await resolveDataplaneUrl(
        'http://localhost:3600',
        'dev',
        { token: 'test-token' }
      );

      expect(result).toBe('http://localhost:3611');
      expect(computeAppBaseUrl).toHaveBeenCalledWith('dataplane');
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
