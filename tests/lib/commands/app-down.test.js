/**
 * Tests for app-down command (runDownAppWithImageRemoval)
 * @fileoverview Unit tests for lib/commands/app-down.js
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({ getDeveloperId: jest.fn().mockResolvedValue(0) }));
jest.mock('../../../lib/utils/app-run-containers', () => ({ getContainerName: jest.fn((app) => `aifabrix-${app}`) }));
jest.mock('../../../lib/app/down', () => ({ downApp: jest.fn().mockResolvedValue(undefined) }));

const { exec } = require('child_process');
jest.mock('child_process', () => ({ exec: jest.fn() }));

const appDownCmd = require('../../../lib/commands/app-down');

describe('app-down command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('../../../lib/core/config').getDeveloperId.mockResolvedValue(0);
    require('../../../lib/app/down').downApp.mockResolvedValue(undefined);
  });

  describe('getContainerImageId', () => {
    it('returns null when exec fails (e.g. container not found)', async() => {
      exec.mockImplementation((command, options, callback) => {
        const cb = typeof options === 'function' ? options : callback;
        if (typeof cb === 'function') setImmediate(() => cb(new Error('No such container'), '', ''));
        return {};
      });
      const id = await appDownCmd.getContainerImageId('aifabrix-myapp');
      expect(id).toBeNull();
    });
  });

  describe('removeImageIfUnused', () => {
    it('logs success when rmi succeeds', async() => {
      exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === 'function') cb = opts;
        setImmediate(() => cb(null, '', ''));
        return {};
      });
      await appDownCmd.removeImageIfUnused('sha256:abc');
      expect(require('../../../lib/utils/logger').log).toHaveBeenCalledWith(expect.stringContaining('removed'));
    });

    it('handles "in use" error gracefully', async() => {
      exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === 'function') cb = opts;
        setImmediate(() => cb(new Error('image is being used'), '', ''));
        return {};
      });
      await appDownCmd.removeImageIfUnused('sha256:abc');
      expect(require('../../../lib/utils/logger').log).toHaveBeenCalledWith(expect.stringContaining('in use'));
    });
  });

  describe('runDownAppWithImageRemoval', () => {
    it('calls downApp then removes image when image ID was found', async() => {
      const down = require('../../../lib/app/down');
      let callCount = 0;
      exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === 'function') cb = opts;
        callCount++;
        if (cmd.includes('inspect')) {
          setImmediate(() => cb(null, 'sha256:img1\n', ''));
        } else {
          setImmediate(() => cb(null, '', ''));
        }
        return {};
      });

      await appDownCmd.runDownAppWithImageRemoval('myapp', {});

      expect(down.downApp).toHaveBeenCalledWith('myapp', {});
      expect(exec).toHaveBeenCalled();
    });
  });
});
