/**
 * Marks when `aifabrix setup` is running platform bring-up (suppress noisy token refresh warnings).
 *
 * @fileoverview Setup flow context flag
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

let setupPlatformFlowActive = false;

function beginSetupPlatformFlow() {
  setupPlatformFlowActive = true;
}

function endSetupPlatformFlow() {
  setupPlatformFlowActive = false;
}

function isSetupPlatformFlow() {
  return setupPlatformFlowActive === true;
}

module.exports = {
  beginSetupPlatformFlow,
  endSetupPlatformFlow,
  isSetupPlatformFlow
};
