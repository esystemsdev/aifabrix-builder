/**
 * Tests for Dataplane Resolver
 *
 * @fileoverview Tests for dataplane-resolver.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
const { discoverDataplaneUrl } = require('../../../lib/commands/wizard-dataplane');

jest.mock('../../../lib/commands/wizard-dataplane');

describe('Dataplane Resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        { token: 'test-token' }
      );
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
