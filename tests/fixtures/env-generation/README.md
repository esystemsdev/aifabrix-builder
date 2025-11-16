# Environment Generation Test Fixtures

This folder contains test fixtures used by `env-generation.test.js`.

## Files

- **env-config.yaml**: Base environment configuration (copied from `lib/schema/env-config.yaml`)
- **env.template**: Environment template file used in tests
- **variables.yaml**: Application variables configuration
- **config.yaml**: User config file that simulates `~/.aifabrix/config.yaml` for testing overrides

## Usage

These fixtures are used to test:
- Environment variable generation for `local` and `docker` contexts
- Config.yaml overrides (both `environments.local` and `aifabrix-localhost`)
- Port offset calculations based on `developer-id`
- Host interpolation from env-config.yaml

## Test Scenarios

1. **Local environment with build.localPort**: Tests port calculation when `build.localPort` is set
2. **Local environment with port only**: Tests port calculation when only `port` is set
3. **Docker environment**: Tests port calculation for docker context
4. **Config.yaml overrides**: Tests that `environments.local` and `environments.docker` overrides work
5. **aifabrix-localhost override**: Tests that `aifabrix-localhost` overrides localhost values

