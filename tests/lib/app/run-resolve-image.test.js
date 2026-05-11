/**
 * Tests for run-resolve-image (local dev vs manifest base resolution).
 */

jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn()
}));

jest.mock('../../../lib/utils/app-run-containers', () => ({
  checkImageExists: jest.fn()
}));

const config = require('../../../lib/core/config');
const { checkImageExists } = require('../../../lib/utils/app-run-containers');
const {
  resolveRunImageWithLocalFallback
} = require('../../../lib/app/run-resolve-image');

describe('run-resolve-image', () => {
  const appCfg = { image: { name: 'miso-controller', tag: 'latest' } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns override when options.image is set', async() => {
    const r = await resolveRunImageWithLocalFallback('miso-controller', appCfg, {
      image: 'other/reg:x'
    });
    expect(r).toEqual({ imageName: 'other/reg', imageTag: 'x' });
    expect(checkImageExists).not.toHaveBeenCalled();
  });

  it('uses base ref only when options.base is true', async() => {
    config.getDeveloperId.mockResolvedValue('2');
    const r = await resolveRunImageWithLocalFallback('miso-controller', appCfg, { base: true });
    expect(r).toEqual({ imageName: 'miso-controller', imageTag: 'latest' });
    expect(checkImageExists).not.toHaveBeenCalled();
  });

  it('uses base when developer id is 0 without probing dev name', async() => {
    config.getDeveloperId.mockResolvedValue('0');
    checkImageExists.mockResolvedValue(true);
    const r = await resolveRunImageWithLocalFallback('miso-controller', appCfg, {});
    expect(r).toEqual({ imageName: 'miso-controller', imageTag: 'latest' });
    expect(checkImageExists).not.toHaveBeenCalled();
  });

  it('prefers dev-scoped image when it exists', async() => {
    config.getDeveloperId.mockResolvedValue('2');
    checkImageExists.mockImplementation(async(name) => name === 'miso-controller-dev2');
    const r = await resolveRunImageWithLocalFallback('miso-controller', appCfg, {});
    expect(r).toEqual({ imageName: 'miso-controller-dev2', imageTag: 'latest' });
  });

  it('falls back to base when dev image missing', async() => {
    config.getDeveloperId.mockResolvedValue('2');
    checkImageExists.mockImplementation(async(name) => name === 'miso-controller');
    const r = await resolveRunImageWithLocalFallback('miso-controller', appCfg, {});
    expect(r).toEqual({ imageName: 'miso-controller', imageTag: 'latest' });
  });

  it('throws when neither dev nor base exists', async() => {
    config.getDeveloperId.mockResolvedValue('2');
    checkImageExists.mockResolvedValue(false);
    await expect(resolveRunImageWithLocalFallback('miso-controller', appCfg, {})).rejects.toThrow(
      /Docker image not found/
    );
  });
});
