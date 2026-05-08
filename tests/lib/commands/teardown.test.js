/**
 * Tests for `lib/commands/teardown.js`.
 *
 * @fileoverview Unit tests for teardown handler
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

jest.mock('fs');
jest.mock('inquirer');
jest.mock('../../../lib/infrastructure');
jest.mock('../../../lib/utils/paths');
jest.mock('../../../lib/utils/logger');

const fs = require('fs');
const inquirer = require('inquirer');
const infra = require('../../../lib/infrastructure');
const pathsUtil = require('../../../lib/utils/paths');
const logger = require('../../../lib/utils/logger');

const {
  handleTeardown,
  cleanAifabrixSystemDir,
  PRESERVE_FILE
} = require('../../../lib/commands/teardown');

describe('lib/commands/teardown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.log = jest.fn();
    pathsUtil.getAifabrixSystemDir = jest.fn().mockReturnValue('/home/test/.aifabrix');
    infra.stopInfraWithVolumes = jest.fn().mockResolvedValue(undefined);
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.readdirSync = jest.fn().mockReturnValue([]);
    fs.rmSync = jest.fn();
    inquirer.prompt = jest.fn().mockResolvedValue({ ok: true });
  });

  describe('cleanAifabrixSystemDir', () => {
    it('returns empty arrays when system dir does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      expect(cleanAifabrixSystemDir()).toEqual({ removed: [], failed: [] });
    });

    it('preserves config.yaml and removes everything else', () => {
      fs.readdirSync.mockReturnValue([
        { name: 'config.yaml', isDirectory: () => false },
        { name: 'secrets.local.yaml', isDirectory: () => false },
        { name: 'admin-secrets.env', isDirectory: () => false },
        { name: 'infra-dev02', isDirectory: () => true }
      ]);
      const { removed, failed } = cleanAifabrixSystemDir();
      expect(removed).toEqual([
        '/home/test/.aifabrix/secrets.local.yaml',
        '/home/test/.aifabrix/admin-secrets.env',
        '/home/test/.aifabrix/infra-dev02'
      ]);
      expect(failed).toEqual([]);
      expect(fs.rmSync).toHaveBeenCalledTimes(3);
    });

    it('records partial failures and continues', () => {
      fs.readdirSync.mockReturnValue([
        { name: 'a.txt', isDirectory: () => false },
        { name: 'b.txt', isDirectory: () => false }
      ]);
      let callCount = 0;
      fs.rmSync.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) throw new Error('EBUSY');
      });
      const { removed, failed } = cleanAifabrixSystemDir();
      expect(removed).toEqual(['/home/test/.aifabrix/b.txt']);
      expect(failed).toEqual(['/home/test/.aifabrix/a.txt']);
    });

    it('exposes the preserved file constant', () => {
      expect(PRESERVE_FILE).toBe('config.yaml');
    });
  });

  describe('handleTeardown', () => {
    it('aborts when the user declines the prompt', async() => {
      inquirer.prompt.mockResolvedValue({ ok: false });
      await handleTeardown({});
      expect(infra.stopInfraWithVolumes).not.toHaveBeenCalled();
      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it('skips the prompt when --yes is passed', async() => {
      fs.readdirSync.mockReturnValue([
        { name: 'secrets.local.yaml', isDirectory: () => false }
      ]);
      await handleTeardown({ yes: true });
      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(infra.stopInfraWithVolumes).toHaveBeenCalled();
      expect(fs.rmSync).toHaveBeenCalled();
    });

    it('continues cleaning even when stopInfraWithVolumes throws', async() => {
      infra.stopInfraWithVolumes.mockRejectedValue(new Error('already down'));
      fs.readdirSync.mockReturnValue([
        { name: 'token.json', isDirectory: () => false }
      ]);
      await handleTeardown({ yes: true });
      expect(fs.rmSync).toHaveBeenCalledWith(
        '/home/test/.aifabrix/token.json',
        expect.objectContaining({ recursive: true, force: true })
      );
    });
  });
});
