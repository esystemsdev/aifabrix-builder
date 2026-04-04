/**
 * @fileoverview checkDockerAvailability error formatting
 */

jest.mock('../../../lib/utils/ensure-dev-certs-for-remote-docker', () => ({
  ensureDevCertsIfNeededForRemoteDocker: jest.fn().mockResolvedValue(undefined)
}));

const dockerUtils = require('../../../lib/utils/docker');
jest.mock('../../../lib/utils/docker', () => ({
  ensureDockerAndCompose: jest.fn()
}));

const { checkDockerAvailability } = require('../../../lib/infrastructure/helpers');

describe('checkDockerAvailability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('when Compose is missing, error omits remote docker-endpoint / dev pin paragraph', async() => {
    const composeMsg =
      'Docker Compose is not available. Tried: "docker compose", "docker-compose", "podman compose". ' +
      'On Ubuntu/Debian with Docker Engine: sudo apt-get install -y docker-compose-plugin && docker compose version. ' +
      'Or set AIFABRIX_COMPOSE_CMD to your compose command prefix (e.g. docker compose).';
    dockerUtils.ensureDockerAndCompose.mockRejectedValue(new Error(composeMsg));

    try {
      await checkDockerAvailability();
      expect.fail('should throw');
    } catch (err) {
      expect(err.message).toMatch(/Docker Compose check failed/);
      expect(err.message).not.toMatch(/dev init --pin/);
    }
  });

  it('when AIFABRIX_COMPOSE_CMD is invalid, error is focused on that', async() => {
    dockerUtils.ensureDockerAndCompose.mockRejectedValue(
      new Error('AIFABRIX_COMPOSE_CMD="nope" is set but failed (tried "version" and "--version"): x')
    );

    try {
      await checkDockerAvailability();
      expect.fail('should throw');
    } catch (err) {
      expect(err.message).toMatch(/AIFABRIX_COMPOSE_CMD failed/);
      expect(err.message).not.toMatch(/dev init --pin/);
    }
  });

  it('for other failures, includes remote docker-endpoint hint', async() => {
    dockerUtils.ensureDockerAndCompose.mockRejectedValue(new Error('docker: command not found'));

    await expect(checkDockerAvailability()).rejects.toThrow(/docker-endpoint/);
  });
});
