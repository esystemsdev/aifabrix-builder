/**
 * @fileoverview Tests for lib/utils/platform-controller-url.js
 */

'use strict';

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/paths');
jest.mock('../../../lib/utils/config-format');
jest.mock('../../../lib/utils/url-declarative-public-base');

const config = require('../../../lib/core/config');
const pathsUtil = require('../../../lib/utils/paths');
const { loadConfigFile } = require('../../../lib/utils/config-format');
const { computePublicUrlBaseString } = require('../../../lib/utils/url-declarative-public-base');
const {
  resolvePlatformControllerUrl,
  computeAppBaseUrl
} = require('../../../lib/utils/platform-controller-url');

describe('lib/utils/platform-controller-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getDeveloperId.mockResolvedValue('0');
    config.getConfig.mockResolvedValue({ traefik: false, tlsEnabled: false });
    config.getRemoteServer.mockResolvedValue(null);
    pathsUtil.getBuilderPath.mockReturnValue('/work/builder/miso-controller');
    pathsUtil.resolveApplicationConfigPath.mockReturnValue('/work/builder/miso-controller/application.yaml');
    loadConfigFile.mockReturnValue({
      port: 3000,
      frontDoorRouting: { enabled: true, pattern: '/miso/*', host: '${DEV_USERNAME}.${REMOTE_HOST}', tls: true }
    });
    computePublicUrlBaseString.mockReturnValue('http://localhost:3000');
  });

  it('resolvePlatformControllerUrl uses miso-controller application config', async() => {
    const url = await resolvePlatformControllerUrl();
    expect(pathsUtil.getBuilderPath).toHaveBeenCalledWith('miso-controller');
    expect(url).toBe('http://localhost:3000');
  });

  it('appends front-door path when Traefik routing is active', async() => {
    config.getConfig.mockResolvedValue({ traefik: true, tlsEnabled: false });
    computePublicUrlBaseString.mockReturnValue('https://dev01.builder.local');
    const url = await computeAppBaseUrl('miso-controller');
    expect(url).toContain('/miso');
  });

  it('[EDGE] uses developer-scoped localhost port when dev id is 6 and Traefik off', async() => {
    config.getDeveloperId.mockResolvedValue('6');
    computePublicUrlBaseString.mockReturnValue('http://localhost:3600');
    const url = await resolvePlatformControllerUrl();
    expect(computePublicUrlBaseString).toHaveBeenCalledWith(
      expect.objectContaining({ developerIdNum: 6, listenPort: 3000 })
    );
    expect(url).toBe('http://localhost:3600');
  });
});
