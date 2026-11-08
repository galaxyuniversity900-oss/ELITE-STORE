#!/usr/bin/env bash
set -euo pipefail
umask 077
BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Usage: BACKUP_AGE_RECIPIENT=age1... BACKUP_RCLONE_REMOTE=remote:path $0 /path/to/mes-store.dump" >&2
  exit 2
fi
: "${BACKUP_AGE_RECIPIENT:?Set the age public recipient}"
: "${BACKUP_RCLONE_REMOTE:?Set an authenticated rclone remote destination}"
command -v age >/dev/null 2>&1 || { echo "age CLI is required" >&2; exit 1; }
command -v rclone >/dev/null 2>&1 || { echo "rclone CLI is required" >&2; exit 1; }
BACKUP_FILE="$(realpath "$BACKUP_FILE")"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mes-store-offsite.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT
ENCRYPTED="$TMP_DIR/$(basename "$BACKUP_FILE").age"
REMOTE="${BACKUP_RCLONE_REMOTE%/}/$(basename "$ENCRYPTED")"
age -r "$BACKUP_AGE_RECIPIENT" -o "$ENCRYPTED" "$BACKUP_FILE"
chmod 600 "$ENCRYPTED"
sha256sum "$ENCRYPTED" > "$ENCRYPTED.sha256"
rclone copyto "$ENCRYPTED" "$REMOTE"
rclone copyto "$ENCRYPTED.sha256" "$REMOTE.sha256"
DOWNLOADED="$TMP_DIR/remote-verification.age"
rclone copyto "$REMOTE" "$DOWNLOADED"
LOCAL_HASH="$(sha256sum "$ENCRYPTED" | awk '{print $1}')"
REMOTE_HASH="$(sha256sum "$DOWNLOADED" | awk '{print $1}')"
if [[ "$LOCAL_HASH" != "$REMOTE_HASH" ]]; then
  echo "Remote encrypted backup checksum mismatch; plaintext source retained." >&2
  exit 1
fi
echo "Encrypted off-site backup uploaded and SHA-256 verified."
echo "Remote object: $REMOTE"
if [[ "${DELETE_PLAINTEXT_AFTER_UPLOAD:-NO}" == "YES" ]]; then
  rm -f "$BACKUP_FILE"
  echo "Local plaintext archive removed after remote verification (filesystem secure erasure is not guaranteed)."
else
  echo "Plaintext source retained. Set DELETE_PLAINTEXT_AFTER_UPLOAD=YES only after validating retention and recovery policy."
fi
