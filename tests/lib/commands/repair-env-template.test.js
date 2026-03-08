/**
 * Tests for repair-env-template (buildEffectiveConfiguration, repairEnvTemplate).
 *
 * @fileoverview Unit tests for lib/commands/repair-env-template.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fsActual = require('fs');

jest.mock('../../../lib/utils/credential-secrets-env', () => ({
  systemKeyToKvPrefix: jest.requireActual('../../../lib/utils/credential-secrets-env').systemKeyToKvPrefix,
  kvEnvKeyToPath: jest.requireActual('../../../lib/utils/credential-secrets-env').kvEnvKeyToPath,
  securityKeyToVar: jest.requireActual('../../../lib/utils/credential-secrets-env').securityKeyToVar
}));

const {
  buildEffectiveConfiguration,
  repairEnvTemplate
} = require('../../../lib/commands/repair-env-template');

describe('repair-env-template', () => {
  describe('buildEffectiveConfiguration', () => {
    it('returns empty array when systemKey is empty', () => {
      const systemParsed = {
        key: '',
        authentication: { security: { clientId: 'kv://x/clientid' } }
      };
      expect(buildEffectiveConfiguration(systemParsed, '')).toEqual([]);
    });

    it('builds from authentication.security when no configuration', () => {
      const systemParsed = {
        key: 'hubspot',
        authentication: {
          method: 'oauth2',
          security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
        },
        configuration: []
      };
      const effective = buildEffectiveConfiguration(systemParsed, 'hubspot');
      expect(effective).toHaveLength(2);
      expect(effective.map(e => e.name)).toContain('KV_HUBSPOT_CLIENTID');
      expect(effective.map(e => e.name)).toContain('KV_HUBSPOT_CLIENTSECRET');
      expect(effective.find(e => e.name === 'KV_HUBSPOT_CLIENTID').value).toBe('hubspot/clientid');
      expect(effective.find(e => e.name === 'KV_HUBSPOT_CLIENTSECRET').value).toBe('hubspot/clientsecret');
    });

    it('includes non-keyvault configuration entries as-is', () => {
      const systemParsed = {
        key: 'hubspot',
        configuration: [
          { name: 'HUBSPOT_API_VERSION', value: 'v3', location: 'variable' },
          { name: 'MAX_PAGE_SIZE', value: '100', location: 'variable' }
        ]
      };
      const effective = buildEffectiveConfiguration(systemParsed, 'hubspot');
      expect(effective).toHaveLength(2);
      expect(effective.find(e => e.name === 'HUBSPOT_API_VERSION')).toEqual({
        name: 'HUBSPOT_API_VERSION',
        value: 'v3',
        location: 'variable'
      });
      expect(effective.find(e => e.name === 'MAX_PAGE_SIZE')).toEqual({
        name: 'MAX_PAGE_SIZE',
        value: '100',
        location: 'variable'
      });
    });

    it('normalizes keyvault config entry to KV_* and path-style value', () => {
      const systemParsed = {
        key: 'hubspot',
        configuration: [
          {
            name: 'KV_HUBSPOT_CLIENT_ID',
            value: 'hubspot-clientidKeyVault',
            location: 'keyvault'
          }
        ]
      };
      const effective = buildEffectiveConfiguration(systemParsed, 'hubspot');
      expect(effective).toHaveLength(1);
      expect(effective[0].name).toBe('KV_HUBSPOT_CLIENTID');
      expect(effective[0].value).toBe('hubspot/clientid');
      expect(effective[0].location).toBe('keyvault');
    });

    it('adds auth.security entries when not already in configuration', () => {
      const systemParsed = {
        key: 'hubspot',
        authentication: {
          security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
        },
        configuration: [
          { name: 'HUBSPOT_API_VERSION', value: 'v3', location: 'variable' }
        ]
      };
      const effective = buildEffectiveConfiguration(systemParsed, 'hubspot');
      expect(effective.length).toBeGreaterThanOrEqual(3);
      expect(effective.map(e => e.name)).toContain('HUBSPOT_API_VERSION');
      expect(effective.map(e => e.name)).toContain('KV_HUBSPOT_CLIENTID');
      expect(effective.map(e => e.name)).toContain('KV_HUBSPOT_CLIENTSECRET');
    });

    it('does not duplicate auth key when already in configuration', () => {
      const systemParsed = {
        key: 'hubspot',
        authentication: {
          security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
        },
        configuration: [
          { name: 'KV_HUBSPOT_CLIENTID', value: 'hubspot/clientid', location: 'keyvault' }
        ]
      };
      const effective = buildEffectiveConfiguration(systemParsed, 'hubspot');
      const clientIds = effective.filter(e => e.name === 'KV_HUBSPOT_CLIENTID');
      expect(clientIds).toHaveLength(1);
      expect(effective.map(e => e.name)).toContain('KV_HUBSPOT_CLIENTSECRET');
    });

    it('handles systemKey with hyphen (prefix MY_APP)', () => {
      const systemParsed = {
        key: 'my-hubspot',
        authentication: { security: { apiKey: 'kv://my-hubspot/apikey' } },
        configuration: []
      };
      const effective = buildEffectiveConfiguration(systemParsed, 'my-hubspot');
      expect(effective).toHaveLength(1);
      expect(effective[0].name).toBe('KV_MY_HUBSPOT_APIKEY');
      expect(effective[0].value).toBe('my/hubspot/apikey');
    });
  });

  describe('repairEnvTemplate', () => {
    const appPath = path.join(process.cwd(), 'integration', 'test-repair-env');
    let existsSyncSpy;
    let readFileSyncSpy;
    let writeFileSyncSpy;

    beforeEach(() => {
      jest.clearAllMocks();
      existsSyncSpy = jest.spyOn(fsActual, 'existsSync');
      readFileSyncSpy = jest.spyOn(fsActual, 'readFileSync');
      writeFileSyncSpy = jest.spyOn(fsActual, 'writeFileSync').mockImplementation(() => {});
    });

    afterEach(() => {
      existsSyncSpy?.mockRestore();
      readFileSyncSpy?.mockRestore();
      writeFileSyncSpy?.mockRestore();
    });

    it('returns false when no effective config and file missing', () => {
      existsSyncSpy.mockReturnValue(false);
      const systemParsed = { key: 'hubspot', configuration: [] };
      const changes = [];
      const result = repairEnvTemplate(appPath, systemParsed, 'hubspot', false, changes);
      expect(result).toBe(false);
      expect(changes).toHaveLength(0);
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
    });

    it('creates env.template when missing and effective config present', () => {
      const envPath = path.join(appPath, 'env.template');
      existsSyncSpy.mockImplementation(p => p !== envPath);
      const systemParsed = {
        key: 'hubspot',
        authentication: {
          security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
        },
        configuration: []
      };
      const changes = [];
      const result = repairEnvTemplate(appPath, systemParsed, 'hubspot', false, changes);
      expect(result).toBe(true);
      expect(changes).toContain('Created env.template from system configuration');
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        envPath,
        expect.stringContaining('KV_HUBSPOT_CLIENTID=kv://hubspot/clientid'),
        expect.any(Object)
      );
    });

    it('does not write when dryRun and file missing', () => {
      const envPath = path.join(appPath, 'env.template');
      existsSyncSpy.mockImplementation(p => p !== envPath);
      const systemParsed = {
        key: 'hubspot',
        authentication: { security: { clientId: 'kv://hubspot/clientid' } },
        configuration: []
      };
      const changes = [];
      const result = repairEnvTemplate(appPath, systemParsed, 'hubspot', true, changes);
      expect(result).toBe(true);
      expect(changes).toContain('Created env.template from system configuration');
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
    });

    it('repairs and pushes change when content differs', () => {
      const envPath = path.join(appPath, 'env.template');
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockImplementation(p => (p === envPath ? 'KV_HUBSPOT_CLIENTID=kv://wrong\n' : ''));
      const systemParsed = {
        key: 'hubspot',
        authentication: {
          security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
        },
        configuration: []
      };
      const changes = [];
      const result = repairEnvTemplate(appPath, systemParsed, 'hubspot', false, changes);
      expect(result).toBe(true);
      expect(changes).toContain('Repaired env.template (KV_* names and path-style kv:// values)');
      const written = writeFileSyncSpy.mock.calls.find(c => c[0] === envPath);
      expect(written[1]).toContain('KV_HUBSPOT_CLIENTID=kv://hubspot/clientid');
      expect(written[1]).toContain('KV_HUBSPOT_CLIENTSECRET=kv://hubspot/clientsecret');
    });

    it('returns false when file exists and content already correct', () => {
      const envPath = path.join(appPath, 'env.template');
      const correctContent = 'KV_HUBSPOT_CLIENTID=kv://hubspot/clientid\nKV_HUBSPOT_CLIENTSECRET=kv://hubspot/clientsecret\n';
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockImplementation(p => (p === envPath ? correctContent : ''));
      const systemParsed = {
        key: 'hubspot',
        authentication: {
          security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
        },
        configuration: []
      };
      const changes = [];
      const result = repairEnvTemplate(appPath, systemParsed, 'hubspot', false, changes);
      expect(result).toBe(false);
      expect(changes).toHaveLength(0);
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
    });

    it('does not write when dryRun and content would change', () => {
      const envPath = path.join(appPath, 'env.template');
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockImplementation(p => (p === envPath ? 'OLD=value\n' : ''));
      const systemParsed = {
        key: 'hubspot',
        authentication: { security: { clientId: 'kv://hubspot/clientid' } },
        configuration: []
      };
      const changes = [];
      const result = repairEnvTemplate(appPath, systemParsed, 'hubspot', true, changes);
      expect(result).toBe(true);
      expect(changes).toContain('Repaired env.template (KV_* names and path-style kv:// values)');
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
    });

    it('preserves existing MISO_CONTROLLER_URL when repairing (only add when missing)', () => {
      const envPath = path.join(appPath, 'env.template');
      const existingContent = 'KV_HUBSPOT_CLIENTID=kv://hubspot/clientid\nKV_HUBSPOT_CLIENTSECRET=kv://hubspot/clientsecret\nMISO_CONTROLLER_URL=http://my-controller:3010\n';
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockImplementation(p => (p === envPath ? existingContent : ''));
      const systemParsed = {
        key: 'hubspot',
        authentication: {
          security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
        },
        configuration: [
          { name: 'MISO_CONTROLLER_URL', value: 'http://${MISO_HOST}:${MISO_PORT}', location: 'variable' }
        ]
      };
      const changes = [];
      const result = repairEnvTemplate(appPath, systemParsed, 'hubspot', false, changes);
      expect(result).toBe(false);
      expect(changes).toHaveLength(0);
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
      expect(existingContent).toContain('MISO_CONTROLLER_URL=http://my-controller:3010');
    });

    it('preserves existing MISO_CONTROLLER_URL when repairing and other keys change', () => {
      const envPath = path.join(appPath, 'env.template');
      const existingContent = 'KV_HUBSPOT_CLIENTID=kv://wrong\nKV_HUBSPOT_CLIENTSECRET=kv://hubspot/clientsecret\nMISO_CONTROLLER_URL=http://my-controller:3010\n';
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockImplementation(p => (p === envPath ? existingContent : ''));
      const systemParsed = {
        key: 'hubspot',
        authentication: {
          security: { clientId: 'kv://hubspot/clientid', clientSecret: 'kv://hubspot/clientsecret' }
        },
        configuration: [
          { name: 'MISO_CONTROLLER_URL', value: 'http://${MISO_HOST}:${MISO_PORT}', location: 'variable' }
        ]
      };
      const changes = [];
      const result = repairEnvTemplate(appPath, systemParsed, 'hubspot', false, changes);
      expect(result).toBe(true);
      const written = writeFileSyncSpy.mock.calls.find(c => c[0] === envPath);
      expect(written).toBeDefined();
      expect(written[1]).toContain('KV_HUBSPOT_CLIENTID=kv://hubspot/clientid');
      expect(written[1]).toContain('MISO_CONTROLLER_URL=http://my-controller:3010');
      expect(written[1]).not.toContain('MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');
    });
  });
});
