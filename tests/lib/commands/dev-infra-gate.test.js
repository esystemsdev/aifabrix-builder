/**
 * @fileoverview Tests for dev-infra-gate
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

jest.mock('../../../lib/infrastructure');

const logger = require('../../../lib/utils/logger');
const infra = require('../../../lib/infrastructure');
const { assertDevInfraUp, DEV_INFRA_DOWN_MESSAGE } = require('../../../lib/commands/dev-infra-gate');

describe('dev-infra-gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw when postgres is not healthy', async() => {
    infra.checkInfraHealth.mockResolvedValue({ postgres: 'stopped', redis: 'healthy' });
    await expect(assertDevInfraUp()).rejects.toThrow(DEV_INFRA_DOWN_MESSAGE);
    expect(infra.checkInfraHealth).toHaveBeenCalledWith(undefined, { strict: true });
  });

  it('should log success when healthy and not quietSuccess', async() => {
    infra.checkInfraHealth.mockResolvedValue({ postgres: 'healthy', redis: 'healthy' });
    await assertDevInfraUp();
    expect(logger.log).toHaveBeenCalled();
  });

  it('should not log success when quietSuccess', async() => {
    infra.checkInfraHealth.mockResolvedValue({ postgres: 'healthy', redis: 'healthy' });
    await assertDevInfraUp({ quietSuccess: true });
    expect(logger.log).not.toHaveBeenCalled();
  });
});
