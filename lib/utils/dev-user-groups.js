/**
 * Allowed dev user groups for Builder Server user APIs (must match server DTOs).
 * @fileoverview
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const ALLOWED_DEV_GROUPS = Object.freeze([
  'admin',
  'secret-manager',
  'developer',
  'docker'
]);

/**
 * Parse --groups CLI value into normalized lowercase tokens.
 * Uses commas and/or whitespace so PowerShell (which often turns `a,b,c` into
 * separate argv tokens later joined as `a b c`) still works.
 * @param {string|string[]} raw - e.g. "admin, developer,docker" or ["admin","developer"]
 * @returns {string[]}
 */
function parseDevGroupsOption(raw) {
  if (raw === null || raw === undefined) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw
      .map(s => String(s).trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof raw !== 'string') {
    return [];
  }
  return raw
    .split(/[\s,]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Ensure every group is allowed; throws with an actionable message if not.
 * @param {string[]} groups - Normalized group names
 * @throws {Error} When an unknown group is present
 * @returns {string[]} Same array reference
 */
function validateDevGroups(groups) {
  if (!Array.isArray(groups)) {
    throw new Error('groups must be an array');
  }
  const invalid = groups.filter(g => !ALLOWED_DEV_GROUPS.includes(g));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid group(s): ${invalid.join(', ')}. Each value must be one of: ${ALLOWED_DEV_GROUPS.join(', ')}`
    );
  }
  return groups;
}

/**
 * When the Builder Server rejects `groups` with an enum message that omits `docker`,
 * but the CLI sent `docker`, append a short hint (the server must be upgraded).
 * Mutates err.message when applicable.
 * @param {Error} err - API error
 * @param {string[]|undefined} requestedGroups - groups sent in the request body
 * @returns {Error}
 */
function augmentDevUserGroupsServerError(err, requestedGroups) {
  if (!err || typeof err.message !== 'string') {
    return err;
  }
  if (!Array.isArray(requestedGroups) || !requestedGroups.includes('docker')) {
    return err;
  }
  const msg = err.message;
  const looksLikeGroupEnum =
    /each value in groups must be one of/i.test(msg) ||
    (/groups/i.test(msg) && /must be one of the following values/i.test(msg));
  if (!looksLikeGroupEnum) {
    return err;
  }
  if (msg.toLowerCase().includes('docker')) {
    return err;
  }
  err.message = `${msg} The Builder Server that handled this request does not accept the \`docker\` group yet; update that service (user DTO enum), or omit docker from --groups until it is deployed.`;
  return err;
}

module.exports = {
  ALLOWED_DEV_GROUPS,
  parseDevGroupsOption,
  validateDevGroups,
  augmentDevUserGroupsServerError
};
