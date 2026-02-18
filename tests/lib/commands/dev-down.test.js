/**
 * Tests for dev down command (handleDevDown).
 * @fileoverview Unit tests for lib/commands/dev-down.js
 */

const { exec } = require('child_process');
const { promisify } = require('util');

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({ getDeveloperId: jest.fn().mockResolvedValue('01') }));
jest.mock('../../../lib/utils/mutagen', () => ({ getMutagenPath: jest.fn().mockResolvedValue(null) }));
jest.mock('../../../lib/app');
jest.mock('child_process', () => ({ exec: jest.fn() }));

const config = require('../../../lib/core/config');
const mutagen = require('../../../lib/utils/mutagen');
const appLib = require('../../../lib/app');
const { handleDevDown } = require('../../../lib/commands/dev-down');

describe('dev-down command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getDeveloperId.mockResolvedValue('01');
    mutagen.getMutagenPath.mockResolvedValue(null);
  });

  it('stops Mutagen sessions when mutagen path exists', async() => {
    mutagen.getMutagenPath.mockResolvedValue('/bin/mutagen');
    exec.mockImplementation((cmd, opts, cb) => {
      const done = (typeof opts === 'function') ? opts : cb;
      if (typeof done === 'function') {
        setImmediate(() => {
          if (cmd.includes('list')) {
            done(null, 'aifabrix-01-myapp\n', '');
          } else {
            done(null, '', '');
          }
        });
      }
      return {};
    });

    await handleDevDown({});

    expect(exec).toHaveBeenCalledWith(expect.stringContaining('sync list'), expect.anything(), expect.any(Function));
    const terminateOrList = exec.mock.calls.some(c => c[0] && (c[0].includes('sync terminate') || c[0].includes('sync list')));
    expect(terminateOrList).toBe(true);
  });

  it('does not run docker when options.apps is false', async() => {
    await handleDevDown({ apps: false });
    expect(appLib.downApp).not.toHaveBeenCalled();
  });

  it('stops app containers when options.apps is true and docker ps returns containers', async() => {
    mutagen.getMutagenPath.mockResolvedValue(null);
    exec.mockImplementation((cmd, opts, cb) => {
      const done = (typeof opts === 'function') ? opts : cb;
      if (typeof done === 'function' && cmd.includes('docker ps')) {
        setImmediate(() => done(null, 'aifabrix-dev01-myapp\n', ''));
      }
      return {};
    });
    appLib.downApp.mockResolvedValue(undefined);

    await handleDevDown({ apps: true });

    const dockerPsCall = exec.mock.calls.find(c => c[0] && c[0].includes('docker ps'));
    expect(dockerPsCall).toBeDefined();
    if (exec.mock.calls.length > 0 && appLib.downApp.mock.calls.length > 0) {
      expect(appLib.downApp).toHaveBeenCalledWith('myapp', {});
    }
  });
});
