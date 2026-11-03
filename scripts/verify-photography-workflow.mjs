import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/generate-product-photography.yml', import.meta.url), 'utf8');
const generator = readFileSync(new URL('./generate-product-photography.py', import.meta.url), 'utf8');

const stepStart = workflow.indexOf('      - name: Generate two photographs per selected product');
const stepEnd = workflow.indexOf('      - name: Validate generated media and catalogue references', stepStart);
assert.ok(stepStart >= 0 && stepEnd > stepStart, 'Photography generation workflow step is missing');

const step = workflow.slice(stepStart, stepEnd);
const shellStart = step.indexOf('        run: |');
assert.ok(shellStart >= 0, 'Generation step must use a literal shell block');
const shell = step.slice(shellStart);
assert.ok(!shell.includes('${{ inputs.'), 'Workflow inputs must never be interpolated directly into shell commands');

for (const variable of ['PRODUCT_IDS', 'PRODUCT_LIMIT', 'FORCE_REGENERATE']) {
  assert.ok(step.includes(variable + ': ${{ inputs.'), 'Missing environment mapping for ' + variable);
}
assert.ok(shell.includes('set -euo pipefail'), 'Shell must fail safely');
assert.ok(shell.includes('"$PRODUCT_IDS"'), 'Product IDs must be passed as one quoted argument');
assert.ok(shell.includes('"$PRODUCT_LIMIT"'), 'Product limit must be passed as one quoted argument');
assert.ok(shell.includes('"$FORCE_REGENERATE"'), 'Force flag must be read from its environment variable');
assert.ok(shell.includes('"$' + '{args[@]}"'), 'Argument array must be expanded safely');

assert.ok(workflow.includes('generated == 0'), 'Workflow must reject an empty generated-media set');
assert.ok(workflow.includes('path.stat().st_size < 10000'), 'Workflow must reject missing or implausibly small images');
assert.ok(generator.includes('re.fullmatch(r"[a-zA-Z0-9_-]+", product_id)'), 'Generator must validate product IDs before creating paths');
assert.ok(generator.includes('OPENAI_API_KEY'), 'Generator must require an explicit API credential');

console.log('Photography workflow security checks: PASS');
console.log('Inputs are environment-bound, shell arguments are quoted, product paths are validated, and generated media is checked.');
