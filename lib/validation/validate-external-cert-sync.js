/**
 * @fileoverview Optional certification sync after external validate (keeps validate.js under max-lines).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/**
 * @param {string} appName
 * @param {Object} options
 * @param {function(string, Object): Promise<Object>} validateExternalSystemComplete
 */
async function runExternalValidateWithOptionalCertSync(appName, options, validateExternalSystemComplete) {
  const result = await validateExternalSystemComplete(appName, options);
  if (result.valid && options.certSync === true) {
    const { trySyncCertificationFromDataplaneForExternalApp } = require('../certification/sync-after-external-command');
    await trySyncCertificationFromDataplaneForExternalApp(appName, 'validate');
  }
  return result;
}

module.exports = { runExternalValidateWithOptionalCertSync };
