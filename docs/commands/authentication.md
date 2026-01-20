# Authentication Commands

← [Back to Commands Index](README.md) | [Back to Quick Start](../quick-start.md)

Commands for authenticating with Miso Controller and managing authentication tokens.

---

## aifabrix login

Authenticate with Miso Controller.

**What:** Logs in to the controller and stores authentication token for subsequent operations. Supports multiple tokens per environment (device login tokens vs client credentials tokens).

**When:** First time using the CLI, when token expires, or when switching controllers/environments.

**Usage:**
```bash
# Login with defaults (controller URL adjusted by developer ID, method: device)
aifabrix login

# Login with custom controller URL (overrides developer ID-based default)
aifabrix login --controller https://controller.aifabrix.ai

# Login with developer ID-based default (automatic)
# Developer ID 0: uses http://localhost:3000
# Developer ID 1: uses http://localhost:3100
# Developer ID 2: uses http://localhost:3200
aifabrix login

# Credentials login with app (reads from secrets.local.yaml)
aifabrix login --controller http://localhost:3010 --method credentials --app keycloak

# Credentials login with explicit credentials
aifabrix login --controller http://localhost:3010 --method credentials --app keycloak --client-id $CLIENT_ID --client-secret $CLIENT_SECRET

# Device code flow with environment
aifabrix login --controller http://localhost:3010 --method device --environment miso

# Device code flow with online-only token (no refresh token, session-based)
aifabrix login --controller http://localhost:3010 --method device --environment miso --online

# Device code flow with custom scope
aifabrix login --controller http://localhost:3010 --method device --environment miso --scope "openid profile email"
```

**Options:**
- `-c, --controller <url>` - Controller URL (default: calculated based on developer ID using formula `http://localhost:${3000 + (developerId * 100)}`)
  - Developer ID 0: `http://localhost:3000` (default)
  - Developer ID 1: `http://localhost:3100`
  - Developer ID 2: `http://localhost:3200`
  - Developer ID 3: `http://localhost:3300`
  - etc.
- `-m, --method <method>` - Authentication method: `device` or `credentials` (default: `device`)
- `-a, --app <app>` - Application name (required for credentials method, reads from secrets.local.yaml using pattern `<app-name>-client-idKeyVault`)
- `--client-id <id>` - Client ID for credentials method (optional, overrides secrets.local.yaml)
- `--client-secret <secret>` - Client Secret for credentials method (optional, overrides secrets.local.yaml)
- `-e, --environment <env>` - Environment key (updates root-level environment in config.yaml, e.g., miso, dev, tst, pro)
- `--online` - Request online-only token without `offline_access` scope (device flow only, excludes from default scope)
- `--scope <scopes>` - Custom OAuth2 scope string (device flow only, default: `"openid profile email offline_access"`)

**Authentication Methods:**

1. **ClientId + ClientSecret (Credentials)**
   - Use `--method credentials` with `--app` flag (required)
   - Reads credentials from `~/.aifabrix/secrets.local.yaml` using pattern:
     - `<app-name>-client-idKeyVault` for client ID
     - `<app-name>-client-secretKeyVault` for client secret
   - If credentials not found in secrets.local.yaml, prompts interactively
   - Can override with `--client-id` and `--client-secret` flags
   - Token is saved per app and environment in config.yaml
   - Useful for application-specific deployments

2. **Device Code Flow (Environment)**
   - Default method is `device` (no need to specify `--method device`)
   - Use optional `--environment` flag to specify environment key (e.g., miso, dev, tst, pro)
   - Authenticate with only an environment key
   - **Offline Tokens (Default)**: By default, `offline_access` scope is included for long-lived refresh tokens
   - **Online-Only Tokens**: Use `--online` flag to exclude `offline_access` scope for session-based tokens
   - **Custom Scopes**: Use `--scope` option to specify custom OAuth2 scopes (default: `"openid profile email offline_access"`)
   - **Note**: `--online` and `--scope` options are only available for device flow (ignored for credentials method)
   - No client credentials required
   - Useful for initial setup before application registration
   - Follows OAuth2 Device Code Flow (RFC 8628)
   - Token is saved at root level in config.yaml, keyed by controller URL (universal per controller)
   - Includes refresh token for automatic token renewal on 401 errors (unless `--online` is used)

**Output (Credentials):**
```yaml
🔐 Logging in to Miso Controller...

Controller URL: http://localhost:3010
Environment: miso

✅ Successfully logged in!
Controller: http://localhost:3010
Environment: miso
App: keycloak
Token stored securely in ~/.aifabrix/config.yaml
```

**Output (Device Code):**
```yaml
🔐 Logging in to Miso Controller...

Controller URL: http://localhost:3010
Environment: miso

✅ Successfully logged in!
Controller: http://localhost:3010
Environment: miso
Token stored securely in ~/.aifabrix/config.yaml
```

**Device Code Flow Example:**

With flags:
```bash
aifabrix login --controller http://localhost:3010 --method device --environment dev
```

Interactive (prompts for environment):
```bash
aifabrix login --controller http://localhost:3010 --method device
# Prompts: Environment key (e.g., miso, dev, tst, pro): dev
```

**Credentials Login Example:**

Reads from secrets.local.yaml:
```bash
aifabrix login --controller http://localhost:3010 --method credentials --app keycloak --environment miso
```

This reads:
- `keycloak-client-idKeyVault` from `~/.aifabrix/secrets.local.yaml`
- `keycloak-client-secretKeyVault` from `~/.aifabrix/secrets.local.yaml`

And saves the token to config.yaml under `environments.miso.clients.keycloak`.

**Device Code Flow Output:**
```yaml
📱 Initiating device code flow...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Device Code Flow Authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To complete authentication:
  1. Visit: https://auth.example.com/device
  2. Enter code: ABCD-EFGH
  3. Approve the request

Waiting for approval...
⏳ Waiting for approval (attempt 1)...
✅ Authentication approved!

✅ Successfully logged in!
Controller: http://localhost:3010
Environment: miso
Token stored securely in ~/.aifabrix/config.yaml
```

**Device Code Flow Steps:**

1. CLI initiates device code flow with environment key
2. Display user code and verification URL
3. User visits URL and enters code in browser
4. User approves request in browser
5. CLI polls for token (automatically)
6. Token is saved to configuration

**Default Controller URL Calculation:**

The default controller URL is automatically calculated based on your developer ID:
- **Formula**: `http://localhost:${3000 + (developerId * 100)}`
- **Developer ID 0** (default): `http://localhost:3000`
- **Developer ID 1**: `http://localhost:3100`
- **Developer ID 2**: `http://localhost:3200`
- **Developer ID 3**: `http://localhost:3300`

This ensures each developer gets their own isolated controller endpoint. You can override this by explicitly providing the `--controller` option.

**Environment Management:**

The `--environment` flag updates the root-level `environment` in `~/.aifabrix/config.yaml`, which indicates the currently selected environment. This environment is used by default in subsequent commands like `deploy`.

**CI/CD Usage Examples:**

```bash
# GitHub Actions / Azure DevOps
aifabrix login \
  --controller ${{ secrets.MISO_CONTROLLER_URL }} \
  --method credentials \
  --app myapp \
  --environment dev

# Device code flow in CI/CD (if environment key is available)
aifabrix login \
  --controller $CONTROLLER_URL \
  --method device \
  --environment $ENVIRONMENT_KEY
```

**Issues:**
- **"Invalid method"** → Method must be `device` or `credentials`
- **"Login failed"** → Check controller URL and credentials
- **"Token expired"** → Run login again
- **"Not logged in"** → Run `aifabrix login` before other commands
- **"Device code expired"** → Restart device code flow (codes expire after ~10 minutes)
- **"Authorization declined"** → User denied the request; run login again
- **"Device code initiation failed"** → Check environment key is valid and controller is accessible
- **"Environment key must contain only letters, numbers, hyphens, and underscores"** → Use valid environment format (e.g., miso, dev, tst, pro)

**Next Steps:**
After logging in, you can:
- Register applications: `aifabrix app register`
- Deploy applications: `aifabrix deploy`
- Check authentication status: `aifabrix auth status`

---

## aifabrix auth status

Display authentication status for the current controller and environment.

**What:** Checks and displays authentication status, including controller URL, environment, token type, expiration, and user information. Validates tokens to ensure they are still valid.

**When:** To verify authentication status, check which controller you're authenticated with, or troubleshoot authentication issues.

**Usage:**
```bash
# Check status with defaults (developer ID-based controller URL, current environment)
aifabrix auth status

# Check status with explicit controller URL
aifabrix auth status --controller https://controller.aifabrix.ai

# Check status with explicit environment
aifabrix auth status --environment dev

# Check status with both controller and environment
aifabrix auth status --controller http://localhost:3100 --environment miso

# Alias: status command
aifabrix status
```

**Options:**
- `-c, --controller <url>` - Check status for specific controller (uses developer ID-based default if not provided)
  - Developer ID 0: `http://localhost:3000` (default)
  - Developer ID 1: `http://localhost:3100`
  - Developer ID 2: `http://localhost:3200`
  - etc.
- `-e, --environment <env>` - Check status for specific environment (uses current environment from config if not provided)

**Controller URL Resolution:**

The controller URL is resolved using the same priority as other commands:
1. `--controller` flag (explicit option)
2. `config.deployment?.controllerUrl` (from config)
3. Developer ID-based default (`http://localhost:${3000 + (developerId * 100)}`)

**Token Types Checked:**

1. **Device Token** (preferred)
   - Stored at root level in config.yaml, keyed by controller URL
   - Universal per controller (not environment-specific)
   - Validated using `/api/v1/auth/validate` endpoint

2. **Client Token** (fallback)
   - Stored per environment and app in config.yaml
   - Environment and app-specific
   - Validated using `/api/v1/auth/validate` endpoint with environment context

**Output (Authenticated with Device Token):**
```yaml
🔐 Authentication Status

Controller: http://localhost:3100
Environment: dev

Status: ✓ Authenticated
Token Type: Device Token
Expires: 2024-01-15T10:30:00Z

User Information:
  Email: user@example.com
  Username: user
  ID: user-123
```

**Output (Authenticated with Client Token):**
```yaml
🔐 Authentication Status

Controller: http://localhost:3000
Environment: dev

Status: ✓ Authenticated
Token Type: Client Token
Application: myapp
Expires: 2024-01-15T10:30:00Z

User Information:
  Email: app@example.com
```

**Output (Not Authenticated):**
```yaml
🔐 Authentication Status

Controller: http://localhost:3000
Environment: dev

Status: ✗ Not authenticated
Token Type: None

💡 Run "aifabrix login" to authenticate
```

**Output (Token Validation Failed):**
```yaml
🔐 Authentication Status

Controller: http://localhost:3000
Environment: dev

Status: ✗ Not authenticated
Token Type: Device Token
Error: Token expired
```

**Examples:**

Check status with defaults:
```bash
aifabrix auth status
```

Check status for specific controller:
```bash
aifabrix auth status --controller https://controller.aifabrix.ai
```

Check status for specific environment:
```bash
aifabrix auth status --environment prod
```

Use alias:
```bash
aifabrix status
```

**When to Use:**

- **Before deploying** - Verify you're authenticated to the correct controller
- **After login** - Confirm authentication was successful
- **Troubleshooting** - Check if token is expired or invalid
- **Multi-controller setup** - Verify which controller you're authenticated with
- **Environment switching** - Check authentication status for specific environment

**Issues:**
- **"Not authenticated"** → Run `aifabrix login` to authenticate
- **"Token expired"** → Run `aifabrix login` again to refresh token
- **"Token validation failed"** → Token may be invalid; try logging in again
- **"Network error"** → Check controller URL and network connection

**Next Steps:**
After checking status:
- If not authenticated: Run `aifabrix login`
- If token expired: Run `aifabrix login` to refresh
- If authenticated: Proceed with other commands (register, deploy, etc.)

---

## aifabrix logout

Clear authentication tokens from config.yaml.

**What:** Removes stored authentication tokens from `~/.aifabrix/config.yaml`. Supports clearing all tokens or specific tokens based on options (controller, environment, app). Preserves other configuration settings like `developer-id`, `environment`, `secrets-encryption`, etc.

**When:** When you want to log out, switch accounts, or clear expired tokens.

**Usage:**
```bash
# Clear all tokens (both device and client tokens)
aifabrix logout

# Clear device token for specific controller
aifabrix logout --controller http://localhost:3000

# Clear all client tokens for specific environment
aifabrix logout --environment dev

# Clear client token for specific app in environment
aifabrix logout --environment dev --app myapp
```

**Options:**
- `-c, --controller <url>` - Clear device tokens for specific controller (device tokens only)
- `-e, --environment <env>` - Clear client tokens for specific environment (client tokens only)
- `-a, --app <app>` - Clear client tokens for specific app (requires --environment, client tokens only)

**Token Types:**

1. **Device Tokens** (root level, keyed by controller URL)
   - Stored at `config.device[controllerUrl]`
   - Cleared with `--controller` option or when no options provided
   - Universal per controller (not environment-specific)

2. **Client Tokens** (per environment and app)
   - Stored at `config.environments[env].clients[appName]`
   - Cleared with `--environment` and/or `--app` options or when no options provided
   - Environment and app-specific

**Output (Clear All):**
```yaml
🔓 Clearing authentication tokens...

✓ Cleared 2 device token(s)
✓ Cleared 5 client token(s)

✅ Successfully cleared tokens!
Config file: ~/.aifabrix/config.yaml
```

**Output (Clear Specific Controller):**
```yaml
🔓 Clearing authentication tokens...

✓ Cleared device token for controller: http://localhost:3000

✅ Successfully cleared tokens!
Config file: ~/.aifabrix/config.yaml
```

**Output (Clear Specific Environment):**
```yaml
🔓 Clearing authentication tokens...

✓ Cleared 3 client token(s) for environment 'dev'

✅ Successfully cleared tokens!
Config file: ~/.aifabrix/config.yaml
```

**Output (No Tokens Found):**
```yaml
🔓 Clearing authentication tokens...

  No device tokens found
  No client tokens found

⚠️  No tokens found to clear
Config file: ~/.aifabrix/config.yaml
```

**What Gets Preserved:**

The logout command only removes token-related entries. The following settings are preserved:
- `developer-id` - Developer ID for port isolation
- `environment` - Currently selected environment
- `secrets-encryption` - Encryption key for token encryption
- `aifabrix-secrets` - Default secrets file path
- `aifabrix-home` - Base directory override
- `aifabrix-env-config` - Custom environment config path
- All other non-token configuration

**Examples:**

Clear all tokens:
```bash
aifabrix logout
```

Clear device token for specific controller:
```bash
aifabrix logout --controller https://controller.example.com
```

Clear all client tokens for environment:
```bash
aifabrix logout --environment dev
```

Clear specific app token:
```bash
aifabrix logout --environment dev --app myapp
```

**Validation:**

- `--app` requires `--environment` option
- Controller URL must be a valid HTTP or HTTPS URL
- Environment key must contain only letters, numbers, hyphens, and underscores

**Issues:**
- **"--app requires --environment option"** → Provide `--environment` when using `--app`
- **"Controller URL is required"** → Provide a valid controller URL
- **"Controller URL must be a valid HTTP or HTTPS URL"** → Use format like `http://localhost:3000` or `https://controller.example.com`
- **"Environment key must contain only letters, numbers, hyphens, and underscores"** → Use valid format (e.g., `dev`, `tst`, `pro`)

**Next Steps:**
After logging out, you can:
- Log in again: `aifabrix login`
- Switch to different controller/environment: `aifabrix login --controller <url> --environment <env>`

