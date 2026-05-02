/**
 * @fileoverview Sync `certification` on *-system.json|yaml from dataplane active certificate(s).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getIntegrationPath } = require('../utils/paths');
const { discoverIntegrationFiles } = require('../commands/repair-internal');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');
const { unwrapApiData } = require('../utils/external-system-readiness-core');
const { getActiveIntegrationCertificate } = require('../api/certificates.api');
const {
  buildCertificationFromArtifact,
  pickArtifactForCertificationMerge
} = require('./merge-certification-from-artifact');

/**
 * @param {string} systemKey
 * @returns {{ systemFilePath: string }|null}
 */
function resolvePrimarySystemFilePath(systemKey) {
  const appPath = getIntegrationPath(systemKey);
  const { systemFiles } = discoverIntegrationFiles(appPath);
  if (!systemFiles || systemFiles.length === 0) return null;
  return { systemFilePath: path.join(appPath, systemFiles[0]) };
}

/**
 * @async
 * @param {Object} ctx
 * @returns {Promise<Array<import('../api/types/certificates.types').CertificateArtifactResponse>>}
 */
async function collectActiveArtifacts(ctx) {
  const { dataplaneUrl, authConfig, systemKey, datasourceKeys } = ctx;
  const out = [];
  for (const dk of datasourceKeys || []) {
    if (!dk || typeof dk !== 'string') continue;
    try {
      const res = await getActiveIntegrationCertificate(dataplaneUrl, authConfig, systemKey, dk);
      if (res && res.success === false) continue;
      const art = unwrapApiData(res);
      if (art && typeof art === 'object') out.push(art);
    } catch {
      /* skip datasource */
    }
  }
  return out;
}

/**
 * @param {string} systemFilePath
 * @returns {Object|null}
 */
function readSystemObject(systemFilePath) {
  try {
    return loadConfigFile(systemFilePath);
  } catch (e) {
    logger.log(chalk.yellow(`⚠ Certification sync: could not read system file: ${e.message}`));
    return null;
  }
}

/**
 * @param {string} systemFilePath
 * @param {Object} systemObj
 * @param {Object} nextCert
 * @returns {{ ok: true } | { ok: false }}
 */
function tryWriteSystemCertification(systemFilePath, systemObj, nextCert) {
  try {
    writeConfigFile(systemFilePath, { ...systemObj, certification: nextCert });
    return { ok: true };
  } catch (e) {
    logger.log(chalk.yellow(`⚠ Certification sync: could not write system file: ${e.message}`));
    return { ok: false };
  }
}

/**
 * @param {Object|null} chosen
 * @param {'no_active'|'no_public_key'} detail
 * @param {string|null} [issuanceFailureHint] - From last DatasourceTestRun.certificateIssuance when status failed
 */
function logSkippedCertification(chosen, detail, issuanceFailureHint) {
  if (detail === 'no_active' || !chosen) {
    const hint = issuanceFailureHint && String(issuanceFailureHint).trim();
    const certNotPassed =
      hint &&
      (hint.includes('CERTIFICATION_NOT_PASSED') ||
        hint.toLowerCase().includes('certification did not pass'));
    if (certNotPassed) {
      logger.log(
        chalk.yellow(
          '⚠ Certification not written: no active integration certificate because certification did not pass on the dataplane issuance validation pass.'
        )
      );
      logger.log(
        chalk.gray(
          '  E2E can be green for every datasource while auto-issue still fails: issuance re-validates the whole system before signing.'
        )
      );
    } else {
      logger.log(
        chalk.yellow(
          '⚠ Certification not written: dataplane has no active trusted certificate for this system/datasource scope yet. ' +
            'Fix auto-issue or signing (see hint), or run unified validation then upload or run cert sync again.'
        )
      );
    }
    if (hint) {
      logger.log(chalk.gray(`  Auto-issue detail: ${hint}`));
    }
    return;
  }
  logger.log(
    chalk.yellow(
      '⚠ Certification not written: active certificate has no publicKey and your system file has none to merge. ' +
        'The dataplane must return publicKey (or add certification.publicKey locally once) to satisfy the schema.'
    )
  );
}

/**
 * Read system file, merge **certification** from dataplane, write back. Does not modify other top-level keys.
 * @async
 * @param {Object} params
 * @param {string} params.systemKey
 * @param {string} params.dataplaneUrl
 * @param {Object} params.authConfig
 * @param {string[]} params.datasourceKeys
 * @returns {Promise<{ written: boolean, reason?: string }>}
 */
async function syncSystemCertificationFromDataplane(params) {
  const { systemKey, dataplaneUrl, authConfig, datasourceKeys, issuanceFailureHint } = params;
  const resolved = resolvePrimarySystemFilePath(systemKey);
  if (!resolved) return { written: false, reason: 'no_system_file' };
  const hasBearerLike =
    authConfig &&
    typeof authConfig === 'object' &&
    ((typeof authConfig.token === 'string' && authConfig.token.trim()) ||
      (typeof authConfig.apiKey === 'string' && authConfig.apiKey.trim()));
  if (!dataplaneUrl || !authConfig || !hasBearerLike) {
    return { written: false, reason: 'no_auth' };
  }

  const systemObj = readSystemObject(resolved.systemFilePath);
  if (!systemObj || typeof systemObj !== 'object') {
    return { written: false, reason: 'invalid_system' };
  }

  const existing = systemObj.certification;
  const artifacts = await collectActiveArtifacts({
    dataplaneUrl,
    authConfig,
    systemKey,
    datasourceKeys
  });
  const chosen = pickArtifactForCertificationMerge(artifacts);
  const nextCert = buildCertificationFromArtifact(chosen, existing);
  if (!nextCert) {
    const detail = chosen ? 'no_public_key' : 'no_active';
    logSkippedCertification(chosen, detail, issuanceFailureHint);
    return { written: false, reason: 'incomplete_certification', detail };
  }

  const writeResult = tryWriteSystemCertification(resolved.systemFilePath, systemObj, nextCert);
  if (!writeResult.ok) return { written: false, reason: 'write_error' };
  return { written: true };
}

/**
 * Non-throwing entry for upload/deploy: failures are warnings only.
 * @async
 * @param {Object} params
 * @param {string} [params.label] - e.g. "upload"
 * @param {boolean} [params.noCertSync]
 * @returns {Promise<void>}
 */
function logCertificationSyncNotWritten(r, label) {
  const prefix = label ? ` (${label})` : '';
  const map = {
    no_system_file: `No *-system* file found under integration folder for this key${prefix}.`,
    no_auth: `No Bearer token for dataplane${prefix}; run aifabrix login.`,
    invalid_system: `Could not read or parse the primary system file${prefix}.`,
    incomplete_certification: 'Could not build certification (see message above).',
    write_error: 'Write to system file failed (see message above).'
  };
  const msg = (r && r.reason && map[r.reason]) || `Certification block not updated${prefix}.`;
  logger.log(chalk.yellow(`⚠ ${msg}`));
}

async function maybeSyncSystemCertificationFromDataplane(params) {
  const { label, noCertSync, systemKey, dataplaneUrl, authConfig, datasourceKeys, issuanceFailureHint } = params;
  if (noCertSync === true) return;
  try {
    const r = await syncSystemCertificationFromDataplane({
      systemKey,
      dataplaneUrl,
      authConfig,
      datasourceKeys,
      issuanceFailureHint
    });
    if (r.written) {
      logger.log(
        chalk.gray(`Updated certification block from dataplane${label ? ` (${label})` : ''} in system file.`)
      );
    } else if (r.reason) {
      logCertificationSyncNotWritten(r, label);
    }
  } catch (e) {
    logger.log(chalk.yellow(`⚠ Certification sync skipped: ${e.message}`));
  }
}

module.exports = {
  syncSystemCertificationFromDataplane,
  maybeSyncSystemCertificationFromDataplane,
  resolvePrimarySystemFilePath,
  collectActiveArtifacts
};
