/**
 * Tests for External System Env Helpers Module
 *
 * @fileoverview Unit tests for lib/utils/external-system-env-helpers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  extractOAuth2EnvVars,
  extractApiKeyEnvVars,
  extractBasicAuthEnvVars,
  extractAuthEnvVars,
  generateEnvTemplate
} = require('../../../lib/utils/external-system-env-helpers');

describe('External System Env Helpers Module', () => {
  describe('extractOAuth2EnvVars', () => {
    it('should extract OAuth2 clientId and clientSecret', () => {
      const oauth2 = {
        clientId: '{{OAUTH_CLIENT_ID}}',
        clientSecret: '{{OAUTH_CLIENT_SECRET}}'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractOAuth2EnvVars(oauth2, systemKey, lines);

      expect(lines).toEqual([
        'OAUTH_CLIENT_ID=kv://secrets/hubspot/client-id',
        'OAUTH_CLIENT_SECRET=kv://secrets/hubspot/client-secret'
      ]);
    });

    it('should only extract clientId if clientSecret is missing', () => {
      const oauth2 = {
        clientId: '{{OAUTH_CLIENT_ID}}'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractOAuth2EnvVars(oauth2, systemKey, lines);

      expect(lines).toEqual([
        'OAUTH_CLIENT_ID=kv://secrets/hubspot/client-id'
      ]);
    });

    it('should only extract clientSecret if clientId is missing', () => {
      const oauth2 = {
        clientSecret: '{{OAUTH_CLIENT_SECRET}}'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractOAuth2EnvVars(oauth2, systemKey, lines);

      expect(lines).toEqual([
        'OAUTH_CLIENT_SECRET=kv://secrets/hubspot/client-secret'
      ]);
    });

    it('should not extract if values do not contain {{', () => {
      const oauth2 = {
        clientId: 'plain-value',
        clientSecret: 'another-value'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractOAuth2EnvVars(oauth2, systemKey, lines);

      expect(lines).toEqual([]);
    });

    it('should handle whitespace in template variables', () => {
      const oauth2 = {
        clientId: '{{ OAUTH_CLIENT_ID }}',
        clientSecret: '{{OAUTH_CLIENT_SECRET  }}'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractOAuth2EnvVars(oauth2, systemKey, lines);

      expect(lines).toEqual([
        'OAUTH_CLIENT_ID=kv://secrets/hubspot/client-id',
        'OAUTH_CLIENT_SECRET=kv://secrets/hubspot/client-secret'
      ]);
    });
  });

  describe('extractApiKeyEnvVars', () => {
    it('should extract API key', () => {
      const apikey = {
        key: '{{API_KEY}}'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractApiKeyEnvVars(apikey, systemKey, lines);

      expect(lines).toEqual([
        'API_KEY=kv://secrets/hubspot/api-key'
      ]);
    });

    it('should not extract if key does not contain {{', () => {
      const apikey = {
        key: 'plain-api-key'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractApiKeyEnvVars(apikey, systemKey, lines);

      expect(lines).toEqual([]);
    });

    it('should not extract if key is missing', () => {
      const apikey = {};
      const systemKey = 'hubspot';
      const lines = [];

      extractApiKeyEnvVars(apikey, systemKey, lines);

      expect(lines).toEqual([]);
    });
  });

  describe('extractBasicAuthEnvVars', () => {
    it('should extract username and password', () => {
      const basic = {
        username: '{{BASIC_USERNAME}}',
        password: '{{BASIC_PASSWORD}}'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractBasicAuthEnvVars(basic, systemKey, lines);

      expect(lines).toEqual([
        'BASIC_USERNAME=kv://secrets/hubspot/username',
        'BASIC_PASSWORD=kv://secrets/hubspot/password'
      ]);
    });

    it('should only extract username if password is missing', () => {
      const basic = {
        username: '{{BASIC_USERNAME}}'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractBasicAuthEnvVars(basic, systemKey, lines);

      expect(lines).toEqual([
        'BASIC_USERNAME=kv://secrets/hubspot/username'
      ]);
    });

    it('should only extract password if username is missing', () => {
      const basic = {
        password: '{{BASIC_PASSWORD}}'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractBasicAuthEnvVars(basic, systemKey, lines);

      expect(lines).toEqual([
        'BASIC_PASSWORD=kv://secrets/hubspot/password'
      ]);
    });

    it('should not extract if values do not contain {{', () => {
      const basic = {
        username: 'plain-username',
        password: 'plain-password'
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractBasicAuthEnvVars(basic, systemKey, lines);

      expect(lines).toEqual([]);
    });
  });

  describe('extractAuthEnvVars', () => {
    it('should extract OAuth2 env vars', () => {
      const auth = {
        type: 'oauth2',
        oauth2: {
          clientId: '{{OAUTH_CLIENT_ID}}',
          clientSecret: '{{OAUTH_CLIENT_SECRET}}'
        }
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractAuthEnvVars(auth, systemKey, lines);

      expect(lines).toEqual([
        'OAUTH_CLIENT_ID=kv://secrets/hubspot/client-id',
        'OAUTH_CLIENT_SECRET=kv://secrets/hubspot/client-secret'
      ]);
    });

    it('should extract API key env vars', () => {
      const auth = {
        type: 'apikey',
        apikey: {
          key: '{{API_KEY}}'
        }
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractAuthEnvVars(auth, systemKey, lines);

      expect(lines).toEqual([
        'API_KEY=kv://secrets/hubspot/api-key'
      ]);
    });

    it('should extract Basic Auth env vars', () => {
      const auth = {
        type: 'basic',
        basic: {
          username: '{{BASIC_USERNAME}}',
          password: '{{BASIC_PASSWORD}}'
        }
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractAuthEnvVars(auth, systemKey, lines);

      expect(lines).toEqual([
        'BASIC_USERNAME=kv://secrets/hubspot/username',
        'BASIC_PASSWORD=kv://secrets/hubspot/password'
      ]);
    });

    it('should not extract if auth type is unknown', () => {
      const auth = {
        type: 'unknown',
        oauth2: {
          clientId: '{{OAUTH_CLIENT_ID}}'
        }
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractAuthEnvVars(auth, systemKey, lines);

      expect(lines).toEqual([]);
    });

    it('should not extract if auth config is missing', () => {
      const auth = {
        type: 'oauth2'
        // oauth2 is missing
      };
      const systemKey = 'hubspot';
      const lines = [];

      extractAuthEnvVars(auth, systemKey, lines);

      expect(lines).toEqual([]);
    });
  });

  describe('generateEnvTemplate', () => {
    it('should generate env template with OAuth2', () => {
      const application = {
        key: 'hubspot',
        authentication: {
          type: 'oauth2',
          oauth2: {
            clientId: '{{OAUTH_CLIENT_ID}}',
            clientSecret: '{{OAUTH_CLIENT_SECRET}}'
          }
        }
      };

      const result = generateEnvTemplate(application);

      expect(result).toContain('# Environment variables for external system');
      expect(result).toContain('# System: hubspot');
      expect(result).toContain('OAUTH_CLIENT_ID=kv://secrets/hubspot/client-id');
      expect(result).toContain('OAUTH_CLIENT_SECRET=kv://secrets/hubspot/client-secret');
    });

    it('should generate env template with API key', () => {
      const application = {
        key: 'hubspot',
        authentication: {
          type: 'apikey',
          apikey: {
            key: '{{API_KEY}}'
          }
        }
      };

      const result = generateEnvTemplate(application);

      expect(result).toContain('API_KEY=kv://secrets/hubspot/api-key');
    });

    it('should generate env template with Basic Auth', () => {
      const application = {
        key: 'hubspot',
        authentication: {
          type: 'basic',
          basic: {
            username: '{{BASIC_USERNAME}}',
            password: '{{BASIC_PASSWORD}}'
          }
        }
      };

      const result = generateEnvTemplate(application);

      expect(result).toContain('BASIC_USERNAME=kv://secrets/hubspot/username');
      expect(result).toContain('BASIC_PASSWORD=kv://secrets/hubspot/password');
    });

    it('should generate header-only template when no authentication', () => {
      const application = {
        key: 'hubspot'
        // No authentication
      };

      const result = generateEnvTemplate(application);

      expect(result).toContain('# Environment variables for external system');
      expect(result).toContain('# System: hubspot');
      expect(result.split('\n').length).toBe(3); // Header + empty line + end
    });

    it('should handle unknown system key', () => {
      const application = {
        // No key
        authentication: {
          type: 'apikey',
          apikey: {
            key: '{{API_KEY}}'
          }
        }
      };

      const result = generateEnvTemplate(application);

      expect(result).toContain('# System: unknown');
      expect(result).toContain('API_KEY=kv://secrets/undefined/api-key');
    });

    it('should handle multiple auth types in sequence', () => {
      const application = {
        key: 'hubspot',
        authentication: {
          type: 'oauth2',
          oauth2: {
            clientId: '{{OAUTH_CLIENT_ID}}'
          },
          apikey: {
            key: '{{API_KEY}}'
          }
        }
      };

      const result = generateEnvTemplate(application);

      // Should only extract OAuth2 since type is oauth2
      expect(result).toContain('OAUTH_CLIENT_ID=kv://secrets/hubspot/client-id');
      expect(result).not.toContain('API_KEY');
    });
  });
});

