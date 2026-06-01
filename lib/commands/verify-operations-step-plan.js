/**
 * @fileoverview Step plan for verify-operations (plan 150.0).
 */

'use strict';

const { validateExternalSystemComplete } = require('../validation/validate');
const { testExternalSystem, testExternalSystemIntegration } = require('../external-system/test');
const { runTestE2EForExternalSystem } = require('./test-e2e-external');

/**
 * @param {string} systemKey
 * @param {Object} options
 * @returns {{ beforeSync: Array, afterSync: Array, e2e: Object }}
 */
function buildOperationsVerifyStepPlan(systemKey, options) {
  return {
    beforeSync: [
      {
        key: 'validation',
        run: () => validateExternalSystemComplete(systemKey, { type: 'external' }),
        ok: (result) => result.valid === true
      },
      {
        key: 'unit',
        run: () => testExternalSystem(systemKey, { verbose: false }),
        ok: (result) => result.valid === true
      }
    ],
    afterSync: [
      {
        key: 'integration',
        run: () =>
          testExternalSystemIntegration(systemKey, {
            environment: options.env,
            noSync: true,
            verbose: false,
            debug: options.debug === true
          }),
        ok: (result) => result.success === true
      }
    ],
    e2e: {
      key: 'e2e',
      run: (progress) =>
        runTestE2EForExternalSystem(systemKey, {
          env: options.env,
          noSync: true,
          verbose: false,
          debug: options.debug === true,
          async: options.async !== false,
          authConfig: options.authConfig,
          dataplaneUrl: options.dataplaneUrl,
          silentResolve: options.silentResolve === true,
          quietPollUi: true,
          onDatasourceProgress: progress?.setLabel
            ? ({ key, index, total }) =>
              progress.setLabel(`Running E2E: ${key} (${index + 1}/${total})`)
            : undefined
        }),
      ok: (result) => result.success === true
    }
  };
}

module.exports = {
  buildOperationsVerifyStepPlan
};
