/**
 * @fileoverview Build protection manifest objects for `protection create`.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { requireProtectionPreset } = require('./protection-preset-registry');

const PROTECTION_KEY_RE = /^[a-z0-9][a-z0-9-]*$/;
const DIMENSION_KEY_RE = /^[a-zA-Z][a-zA-Z0-9-_]*$/;

/**
 * @param {string} raw
 * @returns {string}
 */
function requireDatasourceKey(raw) {
  const k = String(raw || '').trim();
  if (!k) {
    throw new Error('Datasource key is required');
  }
  if (!PROTECTION_KEY_RE.test(k)) {
    throw new Error(
      `Datasource key must match ${PROTECTION_KEY_RE}: got "${k}"`
    );
  }
  return k;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function requireDimensionKey(raw) {
  const k = String(raw || '').trim();
  if (!k) {
    throw new Error('--dimension-key is required for protection create');
  }
  if (!DIMENSION_KEY_RE.test(k)) {
    throw new Error(
      'Dimension key must start with a letter and contain letters, numbers, hyphens, underscores only.'
    );
  }
  return k;
}

/**
 * @param {string} raw
 * @param {string} fallback
 * @returns {string}
 */
function protectionMetadataKey(raw, fallback) {
  const k = String(raw || '').trim();
  if (k) {
    if (!PROTECTION_KEY_RE.test(k)) {
      throw new Error(`--protection-key must match ${PROTECTION_KEY_RE}: got "${k}"`);
    }
    return k;
  }
  return fallback;
}

/**
 * @param {Object} vars
 * @param {string} vars.datasourceKey
 * @param {string} vars.dimensionKey
 * @param {string} [vars.protectionKey]
 * @param {string} [vars.displayName]
 * @param {string} [vars.ruleKey]
 * @param {Object} vars.principal
 * @param {string} vars.valueExpression
 * @param {Object} [vars.when]
 * @returns {Object}
 */
function buildProtectionManifest(vars) {
  const datasourceKey = requireDatasourceKey(vars.datasourceKey);
  const dimensionKey = requireDimensionKey(vars.dimensionKey);
  const presetPart = vars.type ? `-${vars.type}` : '';
  const protectionKey = protectionMetadataKey(
    vars.protectionKey,
    `${datasourceKey}-${dimensionKey}${presetPart}-access`
  );
  const ruleKey = String(vars.ruleKey || '').trim() || `${dimensionKey}${presetPart || '-access'}`;
  const rule = {
    key: ruleKey,
    principal: vars.principal,
    grants: [{ dimensionKey, valueExpression: vars.valueExpression }]
  };
  if (vars.when) {
    rule.when = JSON.parse(JSON.stringify(vars.when));
  }
  return {
    apiVersion: 'dataplane.aifabrix.ai/v1',
    kind: 'Protection',
    metadata: {
      key: protectionKey,
      displayName: String(vars.displayName || '').trim() || `${datasourceKey} — ${dimensionKey}`
    },
    spec: {
      enabled: vars.enabled !== false,
      datasourceKey,
      mode: 'replaceForSource',
      rules: [rule]
    }
  };
}

/**
 * @param {Object} datasource
 * @param {string} field
 * @returns {boolean}
 */
function hasMetadataField(datasource, field) {
  const props = datasource?.metadataSchema?.properties;
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return true;
  }
  return Object.prototype.hasOwnProperty.call(props, field);
}

/**
 * @param {Object} datasource
 * @param {string} name
 * @returns {Object|null}
 */
function findForeignKey(datasource, name) {
  const fks = Array.isArray(datasource?.foreignKeys) ? datasource.foreignKeys : [];
  return fks.find((fk) => fk && fk.name === name) || null;
}

/**
 * @param {Object} datasource
 * @param {string} field
 */
function assertMetadataField(datasource, field) {
  if (!hasMetadataField(datasource, field)) {
    throw new Error(`Preset field not found in datasource metadataSchema.properties: ${field}`);
  }
}

/**
 * @param {Object} preset
 * @param {Object} dimension
 */
function assertDimensionValueType(preset, dimension) {
  const valueType = String(dimension?.valueType || '').trim();
  if (preset.staticOnly && valueType === 'dynamic') {
    throw new Error(`Protection type "${preset.type}" requires a static or both dimension.`);
  }
  if (preset.dynamicOnly && valueType === 'static') {
    throw new Error(`Protection type "${preset.type}" requires a dynamic or both dimension.`);
  }
}

/**
 * @param {Object} vars
 * @param {Object} preset
 * @returns {{ principal: Object, valueExpression: string, when: Object|undefined }}
 */
function resolveStandardPresetSpec(vars, preset) {
  const field = String(vars.field || preset.valueField || preset.dimensionKey).trim();
  assertMetadataField(vars.datasource, field);
  const principal = vars.principalExpression
    ? { type: 'group', expression: String(vars.principalExpression).trim() }
    : principalFromPreset(vars, preset);
  const valueExpression =
    String(vars.valueExpression || '').trim() || preset.valueTemplate || `{{metadata.${field}}}`;
  return { principal, valueExpression, when: preset.when };
}

/**
 * @param {Object} vars
 * @param {Object} preset
 * @returns {Object}
 */
function principalFromPreset(vars, preset) {
  if (preset.type === 'static-region') {
    const displayField = hasMetadataField(vars.datasource, 'regionDisplayName') ? 'regionDisplayName' : 'region';
    return { type: 'group', expression: `{{metadata.${displayField}}} Users` };
  }
  if (preset.principalType === 'user') {
    assertMetadataField(vars.datasource, String(preset.principalField).replace(/^metadata\./, ''));
    return { type: 'user', field: preset.principalField };
  }
  return { type: 'group', expression: preset.principalTemplate };
}

/**
 * @param {Object} vars
 * @param {Object} preset
 * @returns {{ principal: Object, valueExpression: string }}
 */
function resolveCountrySalesSpec(vars, preset) {
  const dimensionKey = vars.dimensionKey;
  const fkName = String(vars.fkName || dimensionKey).trim();
  const explicitField = String(vars.field || '').trim();
  const fk = explicitField ? null : findForeignKey(vars.datasource, fkName);
  if (vars.fkName && !fk) {
    throw new Error(`Preset FK not found in datasource foreignKeys[].name: ${fkName}`);
  }
  if (fk) {
    return {
      principal: { type: 'group', expression: `Sales {{fk.${fkName}.metadata.iso3}} Users` },
      valueExpression: String(vars.valueExpression || '').trim() || `{{fk.${fkName}.metadata.iso2}}`
    };
  }
  const field = explicitField || preset.dimensionKey;
  assertMetadataField(vars.datasource, field);
  return {
    principal: { type: 'group', expression: `Sales {{metadata.${field}}} Users` },
    valueExpression: String(vars.valueExpression || '').trim() || `{{metadata.${field}}}`
  };
}

/**
 * @param {Object} vars
 * @returns {Object}
 */
function buildPresetProtectionManifest(vars) {
  const preset = requireProtectionPreset(vars.type);
  if (!preset) {
    return buildDynamicFkProtectionManifest(vars);
  }
  const dimensionKey = requireDimensionKey(vars.dimensionKey || preset.dimensionKey);
  assertDimensionValueType(preset, vars.dimension);
  const resolved = preset.type === 'country-sales'
    ? resolveCountrySalesSpec({ ...vars, dimensionKey }, preset)
    : resolveStandardPresetSpec({ ...vars, dimensionKey }, preset);
  return buildProtectionManifest({
    ...vars,
    type: preset.type,
    dimensionKey,
    principal: resolved.principal,
    valueExpression: resolved.valueExpression,
    when: resolved.when
  });
}

/**
 * Build v1 "country-from-FK" style manifest (dynamic dimension from one-hop FK metadata).
 *
 * @param {Object} vars
 * @param {string} vars.datasourceKey
 * @param {string} vars.dimensionKey
 * @param {string} [vars.fkName] - defaults to dimensionKey
 * @param {string} [vars.protectionKey]
 * @param {string} [vars.displayName]
 * @param {string} [vars.ruleKey]
 * @param {string} [vars.principalExpression]
 * @param {string} [vars.valueExpression]
 * @returns {Object}
 */
function buildDynamicFkProtectionManifest(vars) {
  const datasourceKey = requireDatasourceKey(vars.datasourceKey);
  const dimensionKey = requireDimensionKey(vars.dimensionKey);
  const fkName = String(vars.fkName || dimensionKey).trim() || dimensionKey;
  const principalExpression =
    String(vars.principalExpression || '').trim() ||
    `Sales {{fk.${fkName}.metadata.iso3}} Users`;
  const valueExpression =
    String(vars.valueExpression || '').trim() ||
    `{{fk.${fkName}.metadata.iso2}}`;
  return buildProtectionManifest({
    ...vars,
    datasourceKey,
    dimensionKey,
    ruleKey: vars.ruleKey || `${dimensionKey}-from-fk-users`,
    displayName: vars.displayName || `${datasourceKey} — ${dimensionKey} (FK projection)`,
    principal: { type: 'group', expression: principalExpression },
    valueExpression
  });
}

module.exports = {
  buildPresetProtectionManifest,
  buildDynamicFkProtectionManifest,
  buildProtectionManifest,
  requireDatasourceKey,
  requireDimensionKey
};
