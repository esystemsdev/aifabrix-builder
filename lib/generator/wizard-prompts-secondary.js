/**
 * @fileoverview Secondary wizard prompts (credential retry, platform, config review)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const inquirer = require('inquirer');
const yaml = require('js-yaml');

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
    { type: 'list', name: 'platform', message: 'Select a platform:', choices }
  ]);
  return platform;
}

/**
 * Prompt for configuration review and editing
 * @async
 * @param {Object} systemConfig - System configuration
 * @param {Object[]} datasourceConfigs - Array of datasource configurations
 * @returns {Promise<Object>} Object with review decision and optionally edited configs
 */
async function promptForConfigReview(systemConfig, datasourceConfigs) {
  // eslint-disable-next-line no-console
  console.log('\n📋 Generated Configuration:\nSystem Configuration:');
  // eslint-disable-next-line no-console
  console.log(yaml.dump(systemConfig, { lineWidth: -1 }));
  // eslint-disable-next-line no-console
  console.log('Datasource Configurations:');
  datasourceConfigs.forEach((ds, index) => {
    // eslint-disable-next-line no-console
    console.log(`\nDatasource ${index + 1}:\n${yaml.dump(ds, { lineWidth: -1 })}`);
  });
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
  promptForConfigReview
};
