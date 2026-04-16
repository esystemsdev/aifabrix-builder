/**
 * @fileoverview Help text blocks for app-level CLI commands.
 */

'use strict';

const TEST_HELP_AFTER = `
Examples:
  # External system (integration/<systemKey>/) — local validation
  $ aifabrix test hubspot
  $ aifabrix test hubspot -v
  $ aifabrix test hubspot -d

  # Builder app (builder/<app>/) — runs in container
  $ aifabrix test myapp -e dev
  $ aifabrix test myapp -e tst

Notes:
  - To run unit test for one datasource, use:
      aifabrix datasource test <datasourceKey>
  - To run integration test, use:
      aifabrix test-integration <app>
  - Option --sync is not supported here (local validation only); use upload or dataplane test commands with --sync.
`;

const TEST_INTEGRATION_HELP_AFTER = `
Examples:
  # External system (integration/<systemKey>/) — integration health across datasources via dataplane
  $ aifabrix test-integration hubspot
  $ aifabrix test-integration hubspot -v
  $ aifabrix test-integration hubspot -d

  # Builder app (builder/<app>/) — runs in container
  $ aifabrix test-integration myapp -e dev
  $ aifabrix test-integration myapp -e tst

Notes:
  - To run integration test for one datasource, use:
      aifabrix datasource test-integration <datasourceKey>
  - To run E2E test, use:
      aifabrix test-e2e <app>
  - Optional --sync publishes local files to the dataplane first (external integration under integration/<systemKey>/ only).
`;

const TEST_E2E_HELP_AFTER = `
Examples:
  # External system (integration/<systemKey>/) — E2E across datasources via dataplane
  $ aifabrix test-e2e hubspot
  $ aifabrix test-e2e hubspot -v
  $ aifabrix test-e2e hubspot -d

  # Builder app (builder/<app>/) — runs in container
  $ aifabrix test-e2e myapp -e dev
  $ aifabrix test-e2e myapp -e tst

Notes:
  - To run E2E for one datasource, use:
      aifabrix datasource test-e2e <datasourceKey>
  - Optional --sync publishes local files to the dataplane first (external integration only).
`;

module.exports = {
  TEST_HELP_AFTER,
  TEST_INTEGRATION_HELP_AFTER,
  TEST_E2E_HELP_AFTER
};

