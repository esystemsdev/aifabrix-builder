/**
 * @fileoverview Secondary wizard prompts (credential retry, platform, config review)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const inquirer = require('inquirer');
const yaml = require('js-yaml');

let hasAutocompletePrompt = false;
try {
  const AutocompletePrompt = require('inquirer-autocomplete-prompt');
  inquirer.registerPrompt('autocomplete', AutocompletePrompt);
  hasAutocompletePrompt = true;
} catch {
  // Fallback: use 'list' if plugin not installed (no search, pageSize 10)
}

/**
 * Re-prompt for credential ID/key when validation failed (e.g. not found on dataplane).
 * Empty input means skip.
 * @async
 * @param {string} [previousError] - Error message from dataplane (e.g. "Credential not found")
 * @returns {Promise<Object>} { credentialIdOrKey: string } or { skip: true } if user leaves empty
 */
async function promptForCredentialIdOrKeyRetry(previousError) {
  const msg = previousError
    ? `Credential not found or invalid (${String(previousError).slice(0, 60)}). Enter ID/key or leave empty to skip:`
    : 'Enter credential ID or key (or leave empty to skip):';
  const { credentialIdOrKey } = await inquirer.prompt([
    { type: 'input', name: 'credentialIdOrKey', message: msg, default: '' }
  ]);
  const trimmed = (credentialIdOrKey && credentialIdOrKey.trim()) || '';
  return trimmed ? { credentialIdOrKey: trimmed } : { skip: true };
}

/**
 * Prompt for known platform selection
 * @async
 * @param {Array<{key: string, displayName?: string}>} [platforms] - List of available platforms
 * @returns {Promise<string>} Selected platform key
 */
async function promptForKnownPlatform(platforms = []) {
  const defaultPlatforms = [
    { name: 'HubSpot', value: 'hubspot' },
    { name: 'Salesforce', value: 'salesforce' },
    { name: 'Zendesk', value: 'zendesk' },
    { name: 'Slack', value: 'slack' },
    { name: 'Microsoft 365', value: 'microsoft365' }
  ];
  const choices = platforms.length > 0
    ? platforms.map(p => ({ name: p.displayName || p.key, value: p.key }))
    : defaultPlatforms;
  const { platform } = await inquirer.prompt([
    { type: 'list', name: 'platform', message: 'Select a platform:', choices, pageSize: 10 }
  ]);
  return platform;
}

/**
 * Format entity for display in list
 * @param {Object} e - Entity { name, pathCount? }
 * @returns {string} Display string
 */
function _formatEntityChoice(e) {
  if (!e || typeof e.name !== 'string') return 'unknown';
  return e.pathCount !== undefined && e.pathCount !== null ? `${e.name} (${e.pathCount} paths)` : e.name;
}

/**
 * Prompt to select an entity from discover-entities list (searchable when plugin available)
 * @async
 * @param {Array<{name: string, pathCount?: number, schemaMatch?: boolean}>} entities - From discover-entities
 * @returns {Promise<string>} Selected entity name
 */
async function promptForEntitySelection(entities = []) {
  if (!Array.isArray(entities) || entities.length === 0) {
    throw new Error('At least one entity is required');
  }
  const choices = entities.map(e => ({
    name: _formatEntityChoice(e),
    value: e.name
  }));

  const promptConfig = {
    type: hasAutocompletePrompt ? 'autocomplete' : 'list',
    name: 'entityName',
    message: 'Select entity for datasource generation:',
    choices,
    pageSize: 10
  };

  if (hasAutocompletePrompt) {
    promptConfig.source = (answers, input) => {
      const q = (input || '').toLowerCase();
      const filtered = entities.filter(e => (e.name || '').toLowerCase().includes(q));
      return Promise.resolve(
        filtered.map(e => ({ name: _formatEntityChoice(e), value: e.name }))
      );
    };
  }

  const { entityName } = await inquirer.prompt([promptConfig]);
  return entityName;
}

/** @param {*} o - Value to stringify */
const _s = (o) => (o === null || o === undefined || o === '' ? '—' : String(o));

/**
 * Humanize app key for display name (must stay in sync with prepareWizardContext in lib/generator/wizard.js).
 * @param {string} appKey - Application key (e.g. hubspot-demo)
 * @returns {string} Display name (e.g. Hubspot Demo)
 */
function humanizeAppKey(appKey) {
  if (!appKey || typeof appKey !== 'string') return appKey || '';
  return appKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/** @param {Object} sys - systemSummary */
function _formatSystem(sys) {
  return [
    '\nSystem',
    `  Key:            ${_s(sys.key)}`,
    `  Display name:   ${_s(sys.displayName)}`,
    `  Type:           ${_s(sys.type)}`,
    `  Base URL:       ${_s(sys.baseUrl)}`,
    `  Auth:           ${_s(sys.authenticationType)}`,
    `  Endpoints:      ${_s(sys.endpointCount)}`
  ];
}

/** @param {Object} ds - datasourceSummary */
function _formatDatasource(ds) {
  return [
    '\nDatasource',
    `  Key:            ${_s(ds.key)}`,
    `  Entity:         ${_s(ds.entity)}`,
    `  Resource type:  ${_s(ds.resourceType)}`,
    `  CIP steps:      ${_s(ds.cipStepCount)}`,
    `  Field mappings: ${_s(ds.fieldMappingCount)}`,
    `  Exposed:        ${_s(ds.exposedProfileCount)} profiles`
  ];
}

/** @param {Object} fm - fieldMappingsSummary */
function _formatFieldMappings(fm) {
  const mapped = Array.isArray(fm.mappedFields) ? fm.mappedFields : [];
  const unmapped = Array.isArray(fm.unmappedFields) ? fm.unmappedFields : [];
  const mappedStr = mapped.length > 0
    ? `${mapped.length} (${mapped.slice(0, 5).join(', ')}${mapped.length > 5 ? ', ...' : ''})`
    : _s(fm.mappingCount);
  const unmappedStr = unmapped.length > 0
    ? `${unmapped.length} (${unmapped.slice(0, 3).join(', ')}${unmapped.length > 3 ? ', ...' : ''})`
    : '0';
  return ['\nField Mappings', `  Mapped:   ${mappedStr}`, `  Unmapped: ${unmappedStr}`];
}

/**
 * Derive a preview summary from systemConfig and datasourceConfigs when the dataplane
 * preview API does not return summaries. Ensures a compact summary is always shown.
 * When appKey is provided, system key/displayName and datasource keys are overridden
 * to match what prepareWizardContext will write (so the preview matches saved files).
 * @param {Object} systemConfig - System configuration
 * @param {Object[]} datasourceConfigs - Array of datasource configurations
 * @param {string} [appKey] - Optional app key; when set, overrides system key/displayName and rewrites datasource keys
 * @returns {Object} Preview object compatible with formatPreviewSummary
 */
function _buildDatasourceSummary(ds) {
  let fieldMappingCount = 0;
  const attrs = ds.fieldMappings?.attributes ?? ds.attributes ?? {};
  if (typeof attrs === 'object' && !Array.isArray(attrs)) {
    fieldMappingCount = Object.keys(attrs).length;
  }
  const exposedCount = ds.exposed?.attributes?.length ?? 0;
  return {
    key: ds.key,
    entity: ds.entityType ?? ds.entity ?? ds.resourceType ?? ds.key?.split('-').pop(),
    resourceType: ds.resourceType,
    cipStepCount: null,
    fieldMappingCount: fieldMappingCount || null,
    exposedProfileCount: exposedCount || null
  };
}

function _buildSystemSummary(sys) {
  const baseUrl = sys.openapi?.servers?.[0]?.url ?? sys.baseUrl ?? sys.openapi?.baseUrl ??
    sys.authentication?.variables?.baseUrl ?? null;
  const authType = sys.authentication?.type ?? sys.authentication?.method ?? sys.authenticationType ?? null;
  const endpointCount = sys.openapi?.endpoints?.length ??
    (sys.openapi?.operations ? Object.keys(sys.openapi.operations || {}).length : null);
  return {
    key: sys.key,
    displayName: sys.displayName,
    type: sys.type,
    baseUrl,
    authenticationType: authType,
    endpointCount
  };
}

function _buildFieldMappingsSummary(ds0) {
  const attrs0 = ds0.fieldMappings?.attributes ?? ds0.attributes ?? {};
  const mappedFields = (typeof attrs0 === 'object' && !Array.isArray(attrs0)) ? Object.keys(attrs0) : [];
  return mappedFields.length > 0 ? { mappingCount: mappedFields.length, mappedFields, unmappedFields: [] } : null;
}

function derivePreviewFromConfig(systemConfig, datasourceConfigs, appKey) {
  const sys = systemConfig || {};
  const dsList = Array.isArray(datasourceConfigs) ? datasourceConfigs : (datasourceConfigs ? [datasourceConfigs] : []);

  const result = {
    systemSummary: _buildSystemSummary(sys),
    fieldMappingsSummary: _buildFieldMappingsSummary(dsList[0] || {})
  };
  let datasourceSummaries = dsList.map(_buildDatasourceSummary);

  if (appKey && typeof appKey === 'string') {
    result.systemSummary.key = appKey;
    result.systemSummary.displayName = humanizeAppKey(appKey);
    const originalSystemKey = sys.key || appKey;
    const originalPrefix = `${originalSystemKey}-`;
    datasourceSummaries = datasourceSummaries.map((summary, i) => {
      const ds = dsList[i] || {};
      const dsKey = ds.key || '';
      const newKey = dsKey && dsKey.startsWith(originalPrefix)
        ? `${appKey}-${dsKey.substring(originalPrefix.length)}`
        : `${appKey}-${ds.entityType || ds.entityKey || (dsKey && dsKey.split('-').pop()) || 'default'}`;
      return { ...summary, key: newKey };
    });
  }

  if (datasourceSummaries.length === 1) {
    result.datasourceSummary = datasourceSummaries[0];
  } else if (datasourceSummaries.length > 1) {
    result.datasourceSummaries = datasourceSummaries;
  }
  return result;
}

/**
 * Format a preview summary for display (WizardPreviewResponse from dataplane)
 * @param {Object} preview - Preview data from GET /api/v1/wizard/preview/{sessionId}
 * @returns {string} Formatted summary text
 */
function formatPreviewSummary(preview) {
  const hasVal = (v) => v !== null && v !== undefined;
  const parts = ['\n📋 Configuration Preview (what will be created)', '─'.repeat(60)];

  if (preview.systemSummary) parts.push(..._formatSystem(preview.systemSummary));
  if (preview.datasourceSummaries && preview.datasourceSummaries.length > 0) {
    preview.datasourceSummaries.forEach((ds, i) => {
      const lines = _formatDatasource(ds);
      const label = preview.datasourceSummaries.length > 1 ? `Datasource ${i + 1}` : 'Datasource';
      parts.push(...lines.map((line, j) => (j === 0 ? line.replace('Datasource', label) : line)));
    });
  } else if (preview.datasourceSummary) {
    parts.push(..._formatDatasource(preview.datasourceSummary));
  }
  if (preview.cipPipelineSummary) {
    const cip = preview.cipPipelineSummary;
    parts.push('\nCIP Pipeline', `  Steps:          ${_s(cip.stepCount)}`, `  Est. execution: ${_s(cip.estimatedExecutionTime) || '—'}`);
  }
  if (preview.fieldMappingsSummary) parts.push(..._formatFieldMappings(preview.fieldMappingsSummary));
  if (hasVal(preview.estimatedRecords) || hasVal(preview.estimatedSyncTime)) {
    parts.push('\nEstimates', `  Records:  ${_s(preview.estimatedRecords)}`, `  Sync:     ${_s(preview.estimatedSyncTime)}`);
  }
  parts.push('\n' + '─'.repeat(60));
  return parts.join('\n');
}

/**
 * Prompt for configuration review and editing
 * When preview is provided, displays a compact summary; otherwise dumps full YAML.
 * @async
 * @param {Object} opts - Options
 * @param {Object|null} [opts.preview] - Preview data from getPreview (null = fallback to YAML)
 * @param {Object} opts.systemConfig - System configuration
 * @param {Object[]} opts.datasourceConfigs - Array of datasource configurations
 * @param {string} [opts.appKey] - App key; when set and using fallback preview, overrides system key/displayName and datasource keys
 * @returns {Promise<Object>} Object with action ('accept'|'cancel') and optionally edited configs
 */
async function promptForConfigReview({ preview, systemConfig, datasourceConfigs, appKey }) {
  const hasSummary = preview && (preview.systemSummary || preview.datasourceSummary || (preview.datasourceSummaries && preview.datasourceSummaries.length > 0));
  const summaryToShow = hasSummary ? preview : derivePreviewFromConfig(systemConfig, datasourceConfigs, appKey);
  const canShowSummary = summaryToShow.systemSummary || summaryToShow.datasourceSummary ||
    (summaryToShow.datasourceSummaries && summaryToShow.datasourceSummaries.length > 0);

  if (canShowSummary) {
    // eslint-disable-next-line no-console
    console.log(formatPreviewSummary(summaryToShow));
  } else {
    // eslint-disable-next-line no-console
    console.log('\n📋 Generated Configuration:\nSystem Configuration:');
    // eslint-disable-next-line no-console
    console.log(yaml.dump(systemConfig, { lineWidth: -1 }));
    // eslint-disable-next-line no-console
    console.log('Datasource Configurations:');
    (datasourceConfigs || []).forEach((ds, index) => {
      // eslint-disable-next-line no-console
      console.log(`\nDatasource ${index + 1}:\n${yaml.dump(ds, { lineWidth: -1 })}`);
    });
  }
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Accept and save', value: 'accept' },
        { name: 'Cancel', value: 'cancel' }
      ]
    }
  ]);
  return action === 'cancel' ? { action: 'cancel' } : { action: 'accept' };
}

module.exports = {
  promptForCredentialIdOrKeyRetry,
  promptForKnownPlatform,
  promptForEntitySelection,
  promptForConfigReview,
  derivePreviewFromConfig,
  formatPreviewSummary,
  humanizeAppKey
};
