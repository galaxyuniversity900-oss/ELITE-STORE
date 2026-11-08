import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = '.github/workflows';
const files = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
  .map((entry) => join(root, entry.name));

const violations = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*uses:\s*([^\s#]+)/);
    if (!match) continue;
    const action = match[1];
    if (action.startsWith('./') || action.startsWith('docker://')) continue;
    const ref = action.slice(action.lastIndexOf('@') + 1);
    if (!/^[a-f0-9]{40}$/i.test(ref)) violations.push(\`${file}:${index + 1}: ${action}\`);
  }
}
if (violations.length) {
  console.error('Workflow actions must use full immutable commit SHAs:');
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log(\`Workflow action pinning: OK (${files.length} workflow files)\`);
