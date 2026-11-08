#!/usr/bin/env bash
set -euo pipefail
umask 077
ENCRYPTED_ARCHIVE="${1:-}"
: "${AGE_IDENTITY_FILE:?Set AGE_IDENTITY_FILE to a protected private age identity file}"
: "${RESTORE_DATABASE_NAME:?Set the exact database name to restore}"
: "${CONFIRM_DATABASE_RESTORE:?Set CONFIRM_DATABASE_RESTORE=YES after review}"
if [[ "$CONFIRM_DATABASE_RESTORE" != "YES" ]]; then
  echo "Restore confirmation must be exactly YES." >&2
  exit 1
fi
if [[ -z "$ENCRYPTED_ARCHIVE" || ! -f "$ENCRYPTED_ARCHIVE" ]]; then
  echo "Usage: AGE_IDENTITY_FILE=/secure/identity $0 /path/to/backup.dump.age" >&2
  exit 2
fi
command -v age >/dev/null 2>&1 || { echo "age CLI is required" >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum is required" >&2; exit 1; }
ENCRYPTED_ARCHIVE="$(realpath "$ENCRYPTED_ARCHIVE")"
if [[ ! -f "$ENCRYPTED_ARCHIVE.sha256" ]]; then
  echo "Encrypted archive SHA-256 sidecar is required." >&2
  exit 1
fi
(cd "$(dirname "$ENCRYPTED_ARCHIVE")" && sha256sum -c "$(basename "$ENCRYPTED_ARCHIVE").sha256")
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mes-store-decrypt.XXXXXX")"
chmod 700 "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT
DECRYPTED="$TMP_DIR/$(basename "$ENCRYPTED_ARCHIVE" .age)"
age -d -i "$AGE_IDENTITY_FILE" -o "$DECRYPTED" "$ENCRYPTED_ARCHIVE"
chmod 600 "$DECRYPTED"
sha256sum "$DECRYPTED" > "$DECRYPTED.sha256"
bash scripts/restore-postgres.sh "$DECRYPTED"
