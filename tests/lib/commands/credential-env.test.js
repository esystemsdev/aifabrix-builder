/**
 * Tests for credential env command
 * @fileoverview Unit tests for commands/credential-env.js
 */

jest.mock('chalk', () => {
  const m = (t) => t;
  m.blue = (t) => t;
  m.green = (t) => t;
  m.yellow = (t) => t;
  return m;
});
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn(), error: jest.fn() }));
jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn((key) => `/workspace/integration/${key}`)
}));
jest.mock('inquirer', () => ({ prompt: jest.fn() }));

const fs = require('fs');
jest.mock('fs');

const logger = require('../../../lib/utils/logger');
const inquirer = require('inquirer');
const {
  runCredentialEnv,
  validateSystemKeyFormat,
  extractKvVarsFromTemplate,
  buildEnvContent
} = require('../../../lib/commands/credential-env');

describe('Credential env command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateSystemKeyFormat', () => {
    it('accepts valid system keys', () => {
      expect(() => validateSystemKeyFormat('hubspot')).not.toThrow();
      expect(() => validateSystemKeyFormat('my-hubspot')).not.toThrow();
      expect(() => validateSystemKeyFormat('hubspot_123')).not.toThrow();
    });
    it('rejects invalid system keys', () => {
      expect(() => validateSystemKeyFormat('')).toThrow('required');
      expect(() => validateSystemKeyFormat('Invalid')).toThrow('lowercase');
      expect(() => validateSystemKeyFormat('UPPERCASE')).toThrow('lowercase');
    });
    it('rejects null and undefined', () => {
      expect(() => validateSystemKeyFormat(null)).toThrow('required');
      expect(() => validateSystemKeyFormat(undefined)).toThrow('required');
    });
  });

  describe('extractKvVarsFromTemplate', () => {
    it('extracts KV_* variables', () => {
      const content = 'KV_HUBSPOT_CLIENTID=\nKV_HUBSPOT_CLIENTSECRET=\nTOKEN_URL=https://api.example.com\n';
      const vars = extractKvVarsFromTemplate(content);
      expect(vars).toHaveLength(2);
      expect(vars[0]).toEqual({ key: 'KV_HUBSPOT_CLIENTID', isSecret: true });
      expect(vars[1]).toEqual({ key: 'KV_HUBSPOT_CLIENTSECRET', isSecret: true });
    });
    it('returns empty for no KV_ vars', () => {
      expect(extractKvVarsFromTemplate('PORT=3000\n')).toEqual([]);
    });
    it('skips commented lines', () => {
      const content = '# KV_HUBSPOT_CLIENTID=optional\nKV_HUBSPOT_CLIENTID=\n';
      const vars = extractKvVarsFromTemplate(content);
      expect(vars).toHaveLength(1);
      expect(vars[0].key).toBe('KV_HUBSPOT_CLIENTID');
    });
    it('returns empty for null or empty content', () => {
      expect(extractKvVarsFromTemplate('')).toEqual([]);
      expect(extractKvVarsFromTemplate(null)).toEqual([]);
    });
  });

  describe('buildEnvContent', () => {
    it('merges prompt values into template', () => {
      const template = 'KV_HUBSPOT_CLIENTID=\nKV_HUBSPOT_CLIENTSECRET=\n';
      const promptValues = { KV_HUBSPOT_CLIENTID: 'cid', KV_HUBSPOT_CLIENTSECRET: 'csec' };
      const result = buildEnvContent(template, promptValues);
      expect(result).toContain('KV_HUBSPOT_CLIENTID=cid');
      expect(result).toContain('KV_HUBSPOT_CLIENTSECRET=csec');
    });
    it('preserves non-KV lines', () => {
      const template = 'KV_FOO=\nTOKEN_URL=https://api.example.com\n';
      const result = buildEnvContent(template, { KV_FOO: 'v1' });
      expect(result).toContain('TOKEN_URL=https://api.example.com');
    });
  });

  describe('runCredentialEnv', () => {
    it('throws when readFileSync fails', async() => {
      fs.existsSync = jest.fn((p) => String(p).includes('env.template'));
      fs.readFileSync = jest.fn(() => {
        throw new Error('Permission denied');
      });
      await expect(runCredentialEnv('hubspot')).rejects.toThrow('Permission denied');
    });

    it('throws when env.template not found', async() => {
      fs.existsSync = jest.fn().mockReturnValue(false);
      await expect(runCredentialEnv('hubspot')).rejects.toThrow('env.template not found');
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('skips prompts when no KV_* vars', async() => {
      fs.existsSync = jest.fn((p) => String(p).includes('env.template'));
      fs.readFileSync = jest.fn().mockReturnValue('PORT=3000\n');
      const result = await runCredentialEnv('hubspot');
      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No KV_*'));
      expect(result).toContain('.env');
    });

    it('handles systemKey with hyphens (my-hubspot -> KV_MY_HUBSPOT_*)', async() => {
      fs.existsSync = jest.fn((p) =>
        String(p).includes('env.template') || String(p).includes('integration/my-hubspot'));
      fs.readFileSync = jest.fn().mockReturnValue('KV_MY_HUBSPOT_CLIENTID=\nKV_MY_HUBSPOT_CLIENTSECRET=\n');
      fs.writeFileSync = jest.fn();
      inquirer.prompt.mockResolvedValue({
        KV_MY_HUBSPOT_CLIENTID: 'cid',
        KV_MY_HUBSPOT_CLIENTSECRET: 'sec'
      });

      await runCredentialEnv('my-hubspot');

      expect(inquirer.prompt).toHaveBeenCalled();
      const promptCalls = inquirer.prompt.mock.calls[0][0];
      expect(promptCalls.some(q => q.name === 'KV_MY_HUBSPOT_CLIENTID')).toBe(true);
      expect(promptCalls.some(q => q.name === 'KV_MY_HUBSPOT_CLIENTSECRET')).toBe(true);
      const written = fs.writeFileSync.mock.calls[0][1];
      expect(written).toContain('KV_MY_HUBSPOT_CLIENTID=cid');
      expect(written).toContain('KV_MY_HUBSPOT_CLIENTSECRET=sec');
    });

    it('prompts and writes .env with KV_* values', async() => {
      fs.existsSync = jest.fn((p) =>
        String(p).includes('env.template') || String(p).includes('integration/hubspot'));
      fs.readFileSync = jest.fn().mockReturnValue('KV_HUBSPOT_CLIENTID=\nKV_HUBSPOT_CLIENTSECRET=\n');
      fs.writeFileSync = jest.fn();
      inquirer.prompt.mockResolvedValue({
        KV_HUBSPOT_CLIENTID: 'cid',
        KV_HUBSPOT_CLIENTSECRET: 'secret'
      });

      const result = await runCredentialEnv('hubspot');

      expect(inquirer.prompt).toHaveBeenCalled();
      const promptCalls = inquirer.prompt.mock.calls[0][0];
      expect(promptCalls.some(q => q.name === 'KV_HUBSPOT_CLIENTID' && q.type === 'password')).toBe(true);
      expect(promptCalls.some(q => q.name === 'KV_HUBSPOT_CLIENTSECRET' && q.type === 'password')).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
      const written = fs.writeFileSync.mock.calls[0][1];
      expect(written).toContain('KV_HUBSPOT_CLIENTID=cid');
      expect(written).toContain('KV_HUBSPOT_CLIENTSECRET=secret');
      expect(fs.writeFileSync.mock.calls[0][2]).toEqual({ mode: 0o600 });
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Wrote'));
    });
  });
});
