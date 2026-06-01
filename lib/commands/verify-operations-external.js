/**
 * @fileoverview verify-operations orchestration for external systems (plan 150.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { runOperationsVerifySteps } = require('./verify-operations-steps');
const { persistOperationsForSystem } = require('./verify-operations-persist');
const {
  VERDICT,
  WARNING_CODES,
  actionHint,
  verdictFromPassed,
  computeOperationalReadinessPercent,
  buildOperationsChecksFromSteps
} = require('../lifecycle/product-model');
const { getSystemLifecycleReport } = require('../api/lifecycle.api');
const {
  extractReadinessMetricsFromLifecycleReport
} = require('../lifecycle/operations-readiness-metrics');
const { resolveIntegrationAuth } = require('../external-system/integration-auth-context');
const { runWithVerifyStepProgress } = require('../lifecycle/verify-step-progress');

/**
 * Build grouped details for verbose (-v) output.
 * @param {Record<string, boolean>} checks
 * @returns {Object}
 */
function groupOperationsDetails(checks) {
  return {
    connectivity: {
      credentials: checks.credentials,
      authentication: checks.authentication,
      authorization: checks.authorization
    },
    contracts: {
      openApi: checks.openApi,
      mappings: checks.mappings
    },
    runtime: {
      sync: checks.sync,
      crud: checks.crud,
      execution: checks.execution
    },
    reliability: {
      validation: checks.validation,
      unitTests: checks.unitTests,
      integrationTests: checks.integrationTests,
      e2eTests: checks.e2eTests
    }
  };
}

/**
 * @param {string} systemKey
 * @param {Object} authConfig
 * @param {string} dataplaneUrl
 * @returns {Promise<Array>}
 */
async function fetchCrossPillarWarnings(systemKey, authConfig, dataplaneUrl) {
  try {
    const report = await getSystemLifecycleReport(dataplaneUrl, authConfig, systemKey, {
      summary: true
    });
    const warnings = [];
    if (report.trust?.verdict !== VERDICT.VERIFIED) {
      warnings.push({
        code: WARNING_CODES.TRUST_NOT_VERIFIED,
        message: 'AI trust not verified',
        action: actionHint(systemKey, 'verify-trust'),
        suggestedCommand: 'verify-trust'
      });
    }
    if (report.governance?.verdict !== VERDICT.VERIFIED) {
      warnings.push({
        code: WARNING_CODES.GOVERNANCE_NOT_VERIFIED,
        message: 'Governance not verified',
        action: actionHint(systemKey, 'verify-governance'),
        suggestedCommand: 'verify-governance'
      });
    }
    return warnings;
  } catch {
    return [];
  }
}

/**
 * @param {Object} params
 * @param {string} params.systemKey
 * @param {Object} params.stepResults
 * @param {Record<string, boolean>} params.checks
 * @param {boolean} params.hardFailure
 * @param {Object} params.options
 * @param {number|null} [params.persistedReadinessPercent]
 * @param {Object|null} [params.readinessMetrics]
 */
async function buildOperationsResult({
  systemKey,
  stepResults,
  checks,
  hardFailure,
  options,
  persistedReadinessPercent = null,
  persistedOperationsVerdict = null,
  readinessMetrics = null,
  lifecycleCertification = null
}) {
  const localPercent = computeOperationalReadinessPercent(checks);
  const operationalReadinessPercent =
    typeof persistedReadinessPercent === 'number' ? persistedReadinessPercent : localPercent;
  const verdict =
    typeof persistedOperationsVerdict === 'string' && persistedOperationsVerdict.trim()
      ? persistedOperationsVerdict.trim()
      : verdictFromPassed(!hardFailure);
  const details = groupOperationsDetails(checks);

  let warnings = [];
  try {
    const { authConfig, dataplaneUrl } = await resolveIntegrationAuth(systemKey, options);
    warnings = await fetchCrossPillarWarnings(systemKey, authConfig, dataplaneUrl);
  } catch {
    warnings = [];
  }

  const certification =
    lifecycleCertification && lifecycleCertification.level
      ? {
        level: lifecycleCertification.level,
        status: lifecycleCertification.status || 'NOT_CERTIFIED'
      }
      : {
        level: verdict === VERDICT.VERIFIED ? 'BRONZE' : 'NONE',
        status: verdict === VERDICT.VERIFIED ? 'TECHNICALLY_READY' : 'NOT_CERTIFIED'
      };

  return {
    systemKey,
    command: 'verify-operations',
    verdict,
    operationalReadinessPercent,
    readinessMetrics: readinessMetrics || null,
    certification,
    warnings,
    details,
    stepResults
  };
}

/**
 * @param {string} systemKey
 * @returns {Promise<void>}
 */
async function assertIntegrationExternalSystem(systemKey) {
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(systemKey).catch(() => null);
  if (!appType || appType.baseDir !== 'integration') {
    throw new Error(
      'verify-operations applies to external integration folders only (integration/<systemKey>/).'
    );
  }
}

/**
 * @param {string} systemKey
 * @param {Object} options
 * @param {Object} stepResults
 * @param {boolean} hardFailure
 * @returns {Promise<Object>}
 */
async function loadPersistedOperationsMetrics(systemKey, options, stepResults, hardFailure) {
  const empty = {
    persistedReadinessPercent: null,
    persistedOperationsVerdict: null,
    readinessMetrics: null,
    lifecycleCertification: null
  };
  if (hardFailure || options.persist === false) {
    return empty;
  }

  return runWithVerifyStepProgress(
    'Saving operations results',
    async() => {
      await persistOperationsForSystem(systemKey, options, stepResults);
      try {
        const { authConfig, dataplaneUrl } = await resolveIntegrationAuth(systemKey, options);
        const report = await getSystemLifecycleReport(dataplaneUrl, authConfig, systemKey, {
          details: true
        });
        return {
          persistedReadinessPercent:
            typeof report?.operations?.operationalReadinessPercent === 'number'
              ? report.operations.operationalReadinessPercent
              : null,
          persistedOperationsVerdict:
            typeof report?.operations?.verdict === 'string' ? report.operations.verdict : null,
          readinessMetrics: extractReadinessMetricsFromLifecycleReport(report),
          lifecycleCertification: report?.certification || null
        };
      } catch {
        return empty;
      }
    },
    options
  );
}

/**
 * @async
 * @param {string} systemKey
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function runVerifyOperationsForExternalSystem(systemKey, options = {}) {
  await assertIntegrationExternalSystem(systemKey);

  const { stepResults, hardFailure } = await runOperationsVerifySteps(systemKey, options);
  const checks = buildOperationsChecksFromSteps(stepResults);
  const persisted = await loadPersistedOperationsMetrics(
    systemKey,
    options,
    stepResults,
    hardFailure
  );

  return buildOperationsResult({
    systemKey,
    stepResults,
    checks,
    hardFailure,
    options,
    ...persisted
  });
}

module.exports = {
  runVerifyOperationsForExternalSystem,
  groupOperationsDetails,
  fetchCrossPillarWarnings,
  buildOperationsResult,
  assertIntegrationExternalSystem,
  loadPersistedOperationsMetrics
};
