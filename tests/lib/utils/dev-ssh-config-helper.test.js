/**
 * @fileoverview Unit tests for dev-ssh-config-helper (SSH config Host upsert, duplicate detection).
 */

const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const {
  getDevSshHostAlias,
  findMatchingHostBlockForUserHost,
  resolveConnectAlias,
  upsertSshHostBlock,
  ensureDevSshConfigBlock
} = require('../../../lib/utils/dev-ssh-config-helper');

describe('dev-ssh-config-helper', () => {
  describe('getDevSshHostAlias', () => {
    it('joins user and host with a dot', () => {
      expect(getDevSshHostAlias('dev01', 'builder02.local')).toBe('dev01.builder02.local');
    });
  });

  describe('findMatchingHostBlockForUserHost', () => {
    it('returns null when no Host blocks', () => {
      expect(findMatchingHostBlockForUserHost('# comment\n', 'h', 'u')).toBeNull();
    });

    it('finds block by HostName and User', () => {
      const cfg = [
        'Host mybuilder',
        '    HostName builder02.local',
        '    User dev01',
        ''
      ].join('\n');
      const m = findMatchingHostBlockForUserHost(cfg, 'builder02.local', 'dev01');
      expect(m).not.toBeNull();
      expect(m.aliases).toContain('mybuilder');
    });

    it('does not match different user', () => {
      const cfg = [
        'Host mybuilder',
        '    HostName builder02.local',
        '    User dev02',
        ''
      ].join('\n');
      expect(findMatchingHostBlockForUserHost(cfg, 'builder02.local', 'dev01')).toBeNull();
    });

    it('does not match when HostName is missing', () => {
      const cfg = ['Host x', '    User dev01', ''].join('\n');
      expect(findMatchingHostBlockForUserHost(cfg, 'builder02.local', 'dev01')).toBeNull();
    });
  });

  describe('resolveConnectAlias', () => {
    it('prefers canonical alias when present on Host line', () => {
      expect(
        resolveConnectAlias({ aliases: ['foo', 'dev01.builder02.local'] }, 'dev01.builder02.local')
      ).toBe('dev01.builder02.local');
    });

    it('falls back to first Host alias', () => {
      expect(resolveConnectAlias({ aliases: ['mybuilder'] }, 'dev01.builder02.local')).toBe('mybuilder');
    });
  });

  describe('upsertSshHostBlock', () => {
    it('appends a new Host block to empty content', () => {
      const out = upsertSshHostBlock('', 'dev01.builder02.local', 'builder02.local', 'dev01');
      expect(out).toContain('Host dev01.builder02.local');
      expect(out).toContain('HostName builder02.local');
      expect(out).toContain('User dev01');
      expect(out).toContain('IdentitiesOnly yes');
    });

    it('replaces an existing block for the same Host alias', () => {
      const before = [
        'Host other',
        '    HostName x',
        '',
        'Host dev01.builder02.local',
        '    HostName old.local',
        '    User dev01',
        '    IdentitiesOnly yes',
        '',
        'Host tail',
        '    HostName t'
      ].join('\n');
      const out = upsertSshHostBlock(before, 'dev01.builder02.local', 'builder02.local', 'dev01');
      expect(out).toContain('HostName builder02.local');
      expect(out).not.toContain('old.local');
      expect(out).toContain('Host other');
      expect(out).toContain('Host tail');
    });

    it('matches Host when alias appears in a multi-name Host line', () => {
      const before = 'Host foo dev01.builder02.local bar\n    HostName old\n    User u\n';
      const out = upsertSshHostBlock(before, 'dev01.builder02.local', 'builder02.local', 'dev01');
      expect(out).not.toContain('HostName old');
      expect(out).toContain('HostName builder02.local');
    });
  });

  describe('ensureDevSshConfigBlock', () => {
    let tmpSshDir;

    beforeEach(async() => {
      tmpSshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aifabrix-ssh-'));
    });

    afterEach(async() => {
      await fs.rm(tmpSshDir, { recursive: true, force: true });
    });

    it('writes a new Host block on first run', async() => {
      const res = await ensureDevSshConfigBlock('dev01', 'builder02.local', tmpSshDir);
      expect(res.ok).toBe(true);
      expect(res.skippedDuplicate).toBeUndefined();
      expect(res.hostAlias).toBe('dev01.builder02.local');
      const text = await fs.readFile(path.join(tmpSshDir, 'config'), 'utf8');
      expect(text).toContain('Host dev01.builder02.local');
      expect((text.match(/^Host /gm) || []).length).toBe(1);
    });

    it('does not add a second block when the same HostName and User already exist', async() => {
      await ensureDevSshConfigBlock('dev01', 'builder02.local', tmpSshDir);
      const before = await fs.readFile(path.join(tmpSshDir, 'config'), 'utf8');
      const res = await ensureDevSshConfigBlock('dev01', 'builder02.local', tmpSshDir);
      expect(res.skippedDuplicate).toBe(true);
      expect(res.hostAlias).toBe('dev01.builder02.local');
      const after = await fs.readFile(path.join(tmpSshDir, 'config'), 'utf8');
      expect(after).toBe(before);
      expect((after.match(/^Host /gm) || []).length).toBe(1);
    });

    it('does not add a block when another Host alias already targets the same user@host', async() => {
      await fs.writeFile(
        path.join(tmpSshDir, 'config'),
        [
          'Host mybuilder',
          '    HostName builder02.local',
          '    User dev01',
          ''
        ].join('\n'),
        'utf8'
      );
      const before = await fs.readFile(path.join(tmpSshDir, 'config'), 'utf8');
      const res = await ensureDevSshConfigBlock('dev01', 'builder02.local', tmpSshDir);
      expect(res.skippedDuplicate).toBe(true);
      expect(res.hostAlias).toBe('mybuilder');
      const after = await fs.readFile(path.join(tmpSshDir, 'config'), 'utf8');
      expect(after).toBe(before);
      expect((after.match(/^Host /gm) || []).length).toBe(1);
    });

    it('still adds a block for the same host with a different user', async() => {
      await fs.writeFile(
        path.join(tmpSshDir, 'config'),
        [
          'Host dev01.builder02.local',
          '    HostName builder02.local',
          '    User dev01',
          ''
        ].join('\n'),
        'utf8'
      );
      const res = await ensureDevSshConfigBlock('dev02', 'builder02.local', tmpSshDir);
      expect(res.skippedDuplicate).toBeUndefined();
      expect(res.hostAlias).toBe('dev02.builder02.local');
      const text = await fs.readFile(path.join(tmpSshDir, 'config'), 'utf8');
      expect((text.match(/^Host /gm) || []).length).toBe(2);
    });
  });
});
