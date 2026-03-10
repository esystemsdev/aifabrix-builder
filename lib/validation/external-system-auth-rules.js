/**
 * External system authentication rules (OAuth2/AAD grantType, authorizationUrl, configuration).
 * Used after schema validation for external system files.
 *
 * @fileoverview OAuth2/AAD and configuration rules for external system configs
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const VALID_GRANT_TYPES = ['client_credentials', 'authorization_code'];

/** Standard auth variable names (credential parameters supplied at runtime). Not allowed in configuration except BASEURL when auth is none. */
const STANDARD_AUTH_VAR_NAMES = new Set([
  'baseurl', 'clientid', 'clientsecret', 'tokenurl', 'apikey', 'username', 'password'
]);

function trimVar(value) {
  return (value !== undefined && value !== null ? String(value).trim() : '');
}

function isOAuth2OrAad(method) {
  const m = (method && String(method).toLowerCase()) || '';
  return m === 'oauth2' || m === 'aad';
}

/**
 * Validates OAuth2/AAD grantType and conditional authorizationUrl for external system files.
 * When method is oauth2 or aad: grantType (if present) must be client_credentials or authorization_code;
 * when effective grant is authorization_code (explicit or default), authorizationUrl is required.
 *
 * @function validateOAuth2GrantTypeAndAuthorizationUrl
 * @param {Object} parsed - Parsed external system object (must have authentication.variables when method is oauth2/aad)
 * @param {string[]} errors - Array to push validation error messages into
 */
function validateOAuth2GrantTypeAndAuthorizationUrl(parsed, errors) {
  const auth = parsed?.authentication;
  const variables = auth?.variables;
  if (!variables || typeof variables !== 'object' || !isOAuth2OrAad(auth.method)) {
    return;
  }

  const grantType = trimVar(variables.grantType);
  if (grantType !== '' && !VALID_GRANT_TYPES.includes(grantType)) {
    errors.push('authentication.variables.grantType must be one of: client_credentials, authorization_code');
    return;
  }

  const effectiveGrant = grantType || 'authorization_code';
  if (effectiveGrant === 'authorization_code' && trimVar(variables.authorizationUrl) === '') {
    errors.push('authentication.variables.authorizationUrl is required when grantType is authorization_code or omitted');
  }
}

/**
 * Validates that the external system configuration array does not contain standard auth variable names.
 * BASEURL, CLIENTID, CLIENTSECRET, TOKENURL, APIKEY, USERNAME, PASSWORD are credential parameters
 * supplied from the selected credential at runtime and must not be in configuration. Exception:
 * BASEURL is only allowed in configuration when authentication.method is 'none'.
 *
 * @param {Object} parsed - Parsed external system object
 * @param {string[]} errors - Array to push validation error messages into
 */
function validateConfigurationNoStandardAuthVariables(parsed, errors) {
  const config = parsed?.configuration;
  if (!Array.isArray(config) || config.length === 0) return;
  const method = (parsed?.authentication?.method && String(parsed.authentication.method).toLowerCase()) || '';
  const authNone = method === 'none';
  const allowedWhenNone = new Set(['baseurl']);
  for (const item of config) {
    const name = (item?.name && String(item.name).trim()) || '';
    if (!name) continue;
    const nameLower = name.toLowerCase();
    if (!STANDARD_AUTH_VAR_NAMES.has(nameLower)) continue;
    if (authNone && allowedWhenNone.has(nameLower)) continue;
    errors.push(
      `configuration must not contain standard auth variable '${name}'. ` +
      'Standard auth variables (BASEURL, CLIENTID, CLIENTSECRET, TOKENURL, APIKEY, USERNAME, PASSWORD) are supplied from the selected credential at runtime. ' +
      'BASEURL is only allowed in configuration when authentication.method is \'none\'.'
    );
  }
}

module.exports = {
  validateOAuth2GrantTypeAndAuthorizationUrl,
  validateConfigurationNoStandardAuthVariables
};
