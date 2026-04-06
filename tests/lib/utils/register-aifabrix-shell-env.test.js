/**
 * @fileoverview Tests for register-aifabrix-shell-env.js
 */

'use strict';

const fs = require('node:fs').promises;
const os = require('os');
const path = require('path');

const {
  registerAifabrixShellEnvFromConfig,
  buildPosixShellEnvBody,
  buildProfileBlock,
  shSingleQuoted,
  psSetUserEnvStatement,
  ensureProfileShellBlock,
  BLOCK_BEGIN,
  BLOCK_END
} = require('../../../lib/utils/register-aifabrix-shell-env');

describe('register-aifabrix-shell-env', () => {
  describe('shSingleQuoted', () => {
    it('wraps path in single quotes', () => {
      expect(shSingleQuoted('/tmp/work')).toBe('\'/tmp/work\'');
    });

    it('escapes embedded single quotes', () => {
      expect(shSingleQuoted('/tmp/o\'neil')).toBe('\'/tmp/o\'\\\'\'neil\'');
    });
  });

  describe('buildPosixShellEnvBody', () => {
    it('exports only set variables', () => {
      const body = buildPosixShellEnvBody('/h', '/w');
      expect(body).toContain('export AIFABRIX_HOME=');
      expect(body).toContain('export AIFABRIX_WORK=');
      expect(body).toContain('/h');
      expect(body).toContain('/w');
    });

    it('omits exports when values are null', () => {
      const body = buildPosixShellEnvBody(null, null);
      expect(body).not.toContain('export AIFABRIX_HOME');
      expect(body).not.toContain('export AIFABRIX_WORK');
    });
  });

  describe('psSetUserEnvStatement', () => {
    it('sets user env when value present', () => {
      const s = psSetUserEnvStatement('AIFABRIX_HOME', 'C:\\af');
      expect(s).toContain('SetEnvironmentVariable');
      expect(s).toContain('AIFABRIX_HOME');
      expect(s).toContain('C:\\af');
    });

    it('removes user env when value null', () => {
      const s = psSetUserEnvStatement('AIFABRIX_WORK', null);
      expect(s).toContain('$null');
      expect(s).toContain('AIFABRIX_WORK');
    });

    it('escapes single quotes in paths for PowerShell', () => {
      const s = psSetUserEnvStatement('AIFABRIX_HOME', 'C:\\user\\o\'neil');
      expect(s).toContain('\'\'');
    });
  });

  describe('buildProfileBlock', () => {
    it('includes markers and source line', () => {
      const b = buildProfileBlock('/cfg/aifabrix-shell-env.sh');
      expect(b).toContain(BLOCK_BEGIN);
      expect(b).toContain(BLOCK_END);
      expect(b).toContain('[ -f \'/cfg/aifabrix-shell-env.sh\' ]');
    });
  });

  describe('ensureProfileShellBlock', () => {
    it('appends block when profile missing', async() => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'af-prof-'));
      const profile = path.join(dir, 'rc');
      const envFile = path.join(dir, 'aifabrix-shell-env.sh');
      await ensureProfileShellBlock(envFile, { profilePath: profile, homedir: dir });
      const content = await fs.readFile(profile, 'utf8');
      expect(content).toContain(BLOCK_BEGIN);
      expect(content).toContain(envFile);
    });

    it('replaces existing block when path changes', async() => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'af-prof2-'));
      const profile = path.join(dir, 'rc');
      const oldEnv = path.join(dir, 'old.sh');
      const newEnv = path.join(dir, 'new.sh');
      const snippetOld = buildProfileBlock(oldEnv);
      await fs.writeFile(profile, `prior\n${snippetOld}`, 'utf8');
      await ensureProfileShellBlock(newEnv, { profilePath: profile, homedir: dir });
      const content = await fs.readFile(profile, 'utf8');
      expect(content).toContain(newEnv);
      expect(content).not.toContain(oldEnv);
    });
  });

  describe('registerAifabrixShellEnvFromConfig', () => {
    it('calls execFile on Windows with PowerShell', async() => {
      const execFile = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });
      const getConfig = jest.fn().mockResolvedValue({
        'aifabrix-home': '/x/home',
        'aifabrix-work': '/x/work'
      });
      await registerAifabrixShellEnvFromConfig(getConfig, {
        platform: 'win32',
        execFile
      });
      expect(execFile).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining(['-Command']),
        expect.objectContaining({ windowsHide: true })
      );
      const psArgs = execFile.mock.calls[0][1];
      const script = psArgs[psArgs.indexOf('-Command') + 1];
      expect(script).toContain('AIFABRIX_HOME');
      expect(script).toContain('AIFABRIX_WORK');
    });

    it('writes shell env file on POSIX', async() => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'af-reg-'));
      const profile = path.join(dir, '.bashrc');
      const getConfig = jest.fn().mockResolvedValue({
        'aifabrix-home': '/data/.aifabrix',
        'aifabrix-work': '/data/workspace'
      });
      await registerAifabrixShellEnvFromConfig(getConfig, {
        platform: 'linux',
        getConfigDirForPaths: () => dir,
        profilePath: profile,
        homedir: dir
      });
      const shPath = path.join(dir, 'aifabrix-shell-env.sh');
      const body = await fs.readFile(shPath, 'utf8');
      expect(body).toContain('AIFABRIX_HOME');
      expect(body).toContain('AIFABRIX_WORK');
      const prof = await fs.readFile(profile, 'utf8');
      expect(prof).toContain(BLOCK_BEGIN);
    });
  });
});
