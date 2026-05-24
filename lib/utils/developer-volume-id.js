/**
 * Developer ID suffix variants for Docker volume names (`dev6` vs `dev06`).
 *
 * @fileoverview Volume name suffix normalization for multi-dev Docker
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {string|number} developerId
 * @returns {string[]}
 */
function collectDeveloperVolumeIdSuffixes(developerId) {
  const raw = String(developerId).trim();
  const idNum = parseInt(raw, 10);
  if (Number.isNaN(idNum) || idNum === 0) {
    return ['0'];
  }
  const suffixes = new Set([String(idNum), raw]);
  if (raw.length === 1) {
    suffixes.add(raw.padStart(2, '0'));
  }
  if (String(idNum).length === 1) {
    suffixes.add(String(idNum).padStart(2, '0'));
  }
  return [...suffixes];
}

module.exports = {
  collectDeveloperVolumeIdSuffixes
};
