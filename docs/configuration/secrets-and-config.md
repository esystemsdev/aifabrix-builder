# Secrets and config.yaml

← [Configuration](README.md)

## config.yaml

Location: `~/.aifabrix/config.yaml`. Manages developer-id, aifabrix-home, aifabrix-secrets, aifabrix-env-config, traefik, controller, environment, device tokens, and per-environment client tokens.

**Key fields:** `developer-id` (read by `aifabrix up-infra`), `traefik` (set by `aifabrix up-infra --traefik`), `controller` and `environment` (set by login/auth config), `device` (device flow tokens), `environments.<env>.clients.<app>` (client tokens). Tokens can be encrypted at rest when `secrets-encryption` is set.

## secrets.local.yaml

Location: `~/.aifabrix/secrets.local.yaml` or path from `aifabrix-secrets` in config. Flat key-value; pattern `<app>-client-idKeyVault`, `<app>-client-secretKeyVault`, and other `*KeyVault` keys. Used by `aifabrix resolve`, `aifabrix login --method credentials`, and deploy. The CLI writes to this file only when you run `aifabrix secrets set`, `aifabrix secure`, or when the system bootstraps an encryption key on empty install; otherwise treat it as edit-at-your-own-risk. Recommended permissions: 600.

### Special key: secrets-encryptionKeyVault

The key **`secrets-encryptionKeyVault`** in `secrets.local.yaml` is used only when the system bootstraps the secrets encryption key on an empty installation. The CLI does **not** read this from an external Key Vault; it is a local key name. If this key is present in the user or project secrets file and `config.yaml` has no `secrets-encryption` yet, the CLI copies that value into `config.yaml` as `secrets-encryption`. If it is missing everywhere, the CLI generates a new 32-byte key, writes it to the user secrets file under `secrets-encryptionKeyVault`, and saves it in `config.yaml`. For normal operation, decryption uses the key from `config.yaml` (`secrets-encryption`), not from `secrets.local.yaml`.

### No restore if you change or lose secrets

- **There is no backup or restore.** If you delete, overwrite, or corrupt `secrets.local.yaml`, you cannot recover the previous values; the CLI does not keep history or backups.
- **Changing or losing the encryption key breaks decryption.** If you change `secrets-encryption` in `config.yaml` or remove it, or if you had encrypted values and the key no longer matches, those values cannot be decrypted. Recovery is to re-enter secrets (e.g. run `aifabrix login` again for tokens) and re-run `aifabrix secure` if you use encryption.
- **Keep a safe copy of the encryption key.** If you use `aifabrix secure`, store the key used for `--secrets-encryption` in a secure place (e.g. password manager). Without it, encrypted secrets in `secrets.local.yaml` cannot be decrypted and the system will not work for any command that needs those secrets.

## Encryption (aifabrix secure)

Run `aifabrix secure --secrets-encryption <key>` to encrypt secrets in `secrets.local.yaml`. Key: 32 bytes, hex or base64. Encrypted values use `secure://` prefix. Plaintext secrets work if no encryption key is configured; the system detects encrypted values and only decrypts when needed. The key is stored in `config.yaml` as `secrets-encryption` for automatic decryption.

See [Commands: Utilities](../commands/utilities.md) for `secrets set` and `secure`.
