/**
 * Manual CLI smoke: Enterprise AI Certification commands (plan 150.0).
 * Default: read-only `lifecycle --json`. Set MANUAL_CERTIFICATION_VERIFY=1 for verify-* ladder.
 *
 * @fileoverview CLI smoke for lifecycle / verify-operations / verify-trust / verify-governance
 */

'use strict';

const { getManualTestAuth } = require('./require-auth');
const {
  resolveCertificationSystemKey,
  hasLocalIntegration,
  runAifabrixCli,
  parseJsonFromCliOutput
} = require('./certification-helpers');

describe('Manual CLI tests – Enterprise AI Certification (plan 150.0)', () => {
  let dataplaneUrl;
  let authConfig;
  let systemKey;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
    systemKey = await resolveCertificationSystemKey(dataplaneUrl, authConfig);
  });

  it('lifecycle <systemKey> --json prints certification envelope', () => {
    if (!dataplaneUrl || !systemKey) {
      return;
    }
    if (!hasLocalIntegration(systemKey)) {
      return;
    }

    const result = runAifabrixCli(['lifecycle', systemKey, '--json'], { timeoutMs: 120000 });
    expect(result.status).toBe(0);

    const envelope = parseJsonFromCliOutput(result);
    expect(envelope).not.toBeNull();
    expect(envelope.command).toBe('lifecycle');
    expect(envelope.systemKey).toBe(systemKey);
    expect(envelope.certification).toBeDefined();
    expect(envelope.certification.level).toBeDefined();
  });

  it('lifecycle <systemKey> -v --json includes datasource breakdown when available', () => {
    if (!dataplaneUrl || !systemKey) {
      return;
    }
    if (!hasLocalIntegration(systemKey)) {
      return;
    }

    const result = runAifabrixCli(['lifecycle', systemKey, '-v', '--json'], { timeoutMs: 120000 });
    expect(result.status).toBe(0);

    const envelope = parseJsonFromCliOutput(result);
    expect(envelope).not.toBeNull();
    expect(envelope.certification).toBeDefined();
  });

  const verifyEnabled = process.env.MANUAL_CERTIFICATION_VERIFY === '1';

  (verifyEnabled ? it : it.skip)(
    'verify-operations <systemKey> --json (MANUAL_CERTIFICATION_VERIFY=1)',
    () => {
      if (!systemKey || !hasLocalIntegration(systemKey)) {
        return;
      }
      const result = runAifabrixCli(['verify-operations', systemKey, '--json'], {
        timeoutMs: 600000
      });
      expect([0, 1, 2]).toContain(result.status);

      const envelope = parseJsonFromCliOutput(result);
      expect(envelope).not.toBeNull();
      expect(envelope.command).toBe('verify-operations');
      expect(envelope.systemKey).toBe(systemKey);
      expect(
        envelope.operationalReadinessPercent !== undefined || envelope.verdict !== undefined
      ).toBe(true);
    }
  );

  (verifyEnabled ? it : it.skip)(
    'verify-trust <systemKey> --json (MANUAL_CERTIFICATION_VERIFY=1)',
    () => {
      if (!systemKey || !hasLocalIntegration(systemKey)) {
        return;
      }
      const result = runAifabrixCli(['verify-trust', systemKey, '--json'], { timeoutMs: 300000 });
      expect([0, 1, 2]).toContain(result.status);

      const envelope = parseJsonFromCliOutput(result);
      expect(envelope).not.toBeNull();
      expect(envelope.command).toBe('verify-trust');
      expect(envelope.systemKey).toBe(systemKey);
    }
  );

  (verifyEnabled ? it : it.skip)(
    'verify-governance <systemKey> --json (MANUAL_CERTIFICATION_VERIFY=1)',
    () => {
      if (!systemKey || !hasLocalIntegration(systemKey)) {
        return;
      }
      const result = runAifabrixCli(['verify-governance', systemKey, '--json'], {
        timeoutMs: 300000
      });
      expect([0, 1, 2]).toContain(result.status);

      const envelope = parseJsonFromCliOutput(result);
      expect(envelope).not.toBeNull();
      expect(envelope.command).toBe('verify-governance');
      expect(envelope.systemKey).toBe(systemKey);
    }
  );
});
