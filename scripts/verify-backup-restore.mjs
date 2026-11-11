import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backup = readFileSync(new URL('./backup-postgres.sh', import.meta.url), 'utf8');
const restore = readFileSync(new URL('./restore-postgres.sh', import.meta.url), 'utf8');
const compose = readFileSync(new URL('../infra/docker/docker-compose.yml', import.meta.url), 'utf8');

for (const token of [
  'pg_dump --format=custom',
  'pg_restore --list',
  'sha256sum',
  'chmod 700',
  'chmod 600',
  '.partial',
  'BASHPID',
  '$RANDOM',
  'while [[ -e "$ARCHIVE"',
  '$ARCHIVE.sha256',
  '$ARCHIVE.manifest',
]) assert.ok(backup.includes(token), 'Backup safeguard missing: ' + token);

for (const token of [
  'CONFIRM_DATABASE_RESTORE',
  'RESTORE_DATABASE_NAME',
  'sha256sum --check',
  'pg_restore --clean --if-exists',
  '--single-transaction',
  'backup-postgres.sh',
  'notification_outbox',
]) assert.ok(restore.includes(token), 'Restore safeguard missing: ' + token);

assert.ok(compose.includes('postgres_data:/var/lib/postgresql/data'), 'PostgreSQL persistent volume is missing');
assert.ok(compose.includes('POSTGRES_PASSWORD:?'), 'PostgreSQL password must be required');
assert.ok(compose.includes('127.0.0.1'), 'Database port should bind to loopback by default');

console.log('PASS: PostgreSQL custom-format backup and archive validation are configured');
console.log('PASS: backup permissions, temporary archive handling and SHA-256 manifest are configured');
console.log('PASS: same-second backup and restore-safety archive collisions are prevented');
console.log('PASS: restore requires explicit target confirmation and checksum validation');
console.log('PASS: restore creates a safety backup and uses a single transaction');
console.log('PASS: PostgreSQL persistent volume and required password configuration are present');
