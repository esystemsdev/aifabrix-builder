/**
 * @fileoverview Deterministic preset registry for `aifabrix protection create --type`.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const ProtectionPresetRegistry = Object.freeze({
  'country-sales': Object.freeze({
    type: 'country-sales',
    dimensionKey: 'country',
    principalTemplate: 'Sales {{value}} Users',
    valueTemplate: '{{value}}'
  }),
  'department-manager': Object.freeze({
    type: 'department-manager',
    dimensionKey: 'department',
    principalType: 'user',
    principalField: 'metadata.managerEmail',
    valueField: 'department',
    valueTemplate: '{{metadata.department}}',
    requiresField: 'department',
    when: Object.freeze({ groups: Object.freeze({ requireAny: Object.freeze(['Manager']) }) })
  }),
  'customer-team': Object.freeze({
    type: 'customer-team',
    dimensionKey: 'customer',
    principalTemplate: 'Customer {{metadata.customer}} Team',
    valueField: 'customer',
    valueTemplate: '{{metadata.customer}}',
    requiresField: 'customer'
  }),
  'project-team': Object.freeze({
    type: 'project-team',
    dimensionKey: 'project',
    principalTemplate: 'Project {{metadata.project}} Team',
    valueField: 'project',
    valueTemplate: '{{metadata.project}}',
    requiresField: 'project'
  }),
  'static-region': Object.freeze({
    type: 'static-region',
    dimensionKey: 'region',
    principalTemplate: '{{metadata.regionDisplayName}} Users',
    valueField: 'region',
    valueTemplate: '{{metadata.region}}',
    requiresField: 'region',
    staticOnly: true
  }),
  'owner-direct': Object.freeze({
    type: 'owner-direct',
    dimensionKey: 'owner',
    principalType: 'user',
    principalField: 'metadata.ownerEmail',
    valueField: 'owner',
    valueTemplate: '{{metadata.owner}}',
    requiresField: 'owner'
  })
});

/**
 * @returns {string[]}
 */
function listProtectionPresetTypes() {
  return Object.keys(ProtectionPresetRegistry);
}

/**
 * @param {string|undefined} type
 * @returns {Object|null}
 */
function getProtectionPreset(type) {
  const key = String(type || '').trim();
  return key ? ProtectionPresetRegistry[key] || null : null;
}

/**
 * @param {string|undefined} type
 * @returns {Object|null}
 */
function requireProtectionPreset(type) {
  const preset = getProtectionPreset(type);
  if (preset || !String(type || '').trim()) {
    return preset;
  }
  throw new Error(
    `Unknown protection type "${type}". Supported types: ${listProtectionPresetTypes().join(', ')}`
  );
}

module.exports = {
  ProtectionPresetRegistry,
  getProtectionPreset,
  listProtectionPresetTypes,
  requireProtectionPreset
};
