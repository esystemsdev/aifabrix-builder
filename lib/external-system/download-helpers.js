/**
 * External System Download Helpers
 *
 * Helper functions for external system download file generation
 *
 * @fileoverview Download helper utilities for external system download
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Generates variables.yaml content for downloaded system
 * @param {string} systemKey - System key
 * @param {Object} application - External system configuration
 * @param {Array} dataSources - Array of datasource configurations
 * @returns {Object} Variables YAML object
 */
function generateVariablesYaml(systemKey, application, dataSources) {
  const systemFileName = `${systemKey}-deploy.json`;
  const datasourceFiles = dataSources.map(ds => {
    // Extract entity key from datasource key or use entityKey
    const entityKey = ds.entityKey || ds.key.split('-').pop();
    return `${systemKey}-deploy-${entityKey}.json`;
  });

  return {
    name: systemKey,
    displayName: application.displayName || systemKey,
    description: application.description || `External system integration for ${systemKey}`,
    externalIntegration: {
      schemaBasePath: './',
      systems: [systemFileName],
      dataSources: datasourceFiles,
      autopublish: false,
      version: application.version || '1.0.0'
    }
  };
}

/**
 * Generates README.md with setup instructions
 * @param {string} systemKey - System key
 * @param {Object} application - External system configuration
 * @param {Array} dataSources - Array of datasource configurations
 * @returns {string} README.md content
 */
function generateReadme(systemKey, application, dataSources) {
  const displayName = application.displayName || systemKey;
  const description = application.description || `External system integration for ${systemKey}`;
  const systemType = application.type || 'unknown';

  const lines = [
    `# ${displayName}`,
    '',
    description,
    '',
    '## System Information',
    '',
    `- **System Key**: \`${systemKey}\``,
    `- **System Type**: \`${systemType}\``,
    `- **Datasources**: ${dataSources.length}`,
    '',
    '## Files',
    '',
    '- `variables.yaml` - Application configuration with externalIntegration block',
    `- \`${systemKey}-deploy.json\` - External system definition`
  ];

  dataSources.forEach(ds => {
    const entityKey = ds.entityKey || ds.key.split('-').pop();
    lines.push(`- \`${systemKey}-deploy-${entityKey}.json\` - Datasource: ${ds.displayName || ds.key}`);
  });

  lines.push(
    '- `env.template` - Environment variables template',
    '',
    '## Setup Instructions',
    '',
    '1. Review and update configuration files as needed',
    '2. Set up environment variables in `env.template`',
    '3. Run unit tests: `aifabrix test ${systemKey}`',
    '4. Run integration tests: `aifabrix test-integration ${systemKey}`',
    '5. Deploy: `aifabrix deploy ${systemKey} --environment dev`',
    '',
    '## Testing',
    '',
    '### Unit Tests',
    'Run local validation without API calls:',
    '```bash',
    `aifabrix test ${systemKey}`,
    '```',
    '',
    '### Integration Tests',
    'Run integration tests via dataplane:',
    '```bash',
    `aifabrix test-integration ${systemKey} --environment dev`,
    '```',
    '',
    '## Deployment',
    '',
    'Deploy to dataplane via miso-controller:',
    '```bash',
    `aifabrix deploy ${systemKey} --environment dev`,
    '```'
  );

  return lines.join('\n');
}

module.exports = {
  generateVariablesYaml,
  generateReadme
};

