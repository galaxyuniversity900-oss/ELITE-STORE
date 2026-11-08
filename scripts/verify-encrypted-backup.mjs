import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publish = await readFile('scripts/publish-encrypted-backup.sh', 'utf8');
const restore = await readFile('scripts/restore-encrypted-postgres.sh', 'utf8');
for (const token of ['age -r', 'rclone copyto', 'sha256sum', 'REMOTE_HASH', 'DELETE_PLAINTEXT_AFTER_UPLOAD']) {
  assert.ok(publish.includes(token), 'Publisher missing required control: ' + token);
}
for (const token of ['sha256sum -c', 'age -d -i', 'CONFIRM_DATABASE_RESTORE', 'RESTORE_DATABASE_NAME', 'restore-postgres.sh']) {
  assert.ok(restore.includes(token), 'Restore wrapper missing required control: ' + token);
}
assert.ok(!publish.includes('age -d'), 'Publisher must never decrypt backups');
console.log('Encrypted off-site backup/restore preflight: PASS');
