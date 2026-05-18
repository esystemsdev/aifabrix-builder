/**
 * @fileoverview Protection manifest directory under apps materialization parent.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const { getAppsMaterializationParent } = require('../utils/paths');

/**
 * @returns {string} Absolute path to `{work}/.protection/`
 */
function getProtectionRoot() {
  return path.join(getAppsMaterializationParent(), '.protection');
}

module.exports = {
  getProtectionRoot
};
