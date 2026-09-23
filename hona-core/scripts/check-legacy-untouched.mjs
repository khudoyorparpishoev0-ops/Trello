#!/usr/bin/env node
// Легаси v1 не меняется (§23.4, §23.11 п.6): diff PR содержит только hona-core/**,
// .github/** и корневой .eslintignore.
//
//   node scripts/check-legacy-untouched.mjs <base-ref> [head-ref]
import { execFileSync } from 'node:child_process'

const [base, head = 'HEAD'] = process.argv.slice(2)
if (!base) {
  console.error('usage: check-legacy-untouched.mjs <base-ref> [head-ref]')
  process.exit(2)
}
const changed = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
const allowed = (path) =>
  path.startsWith('hona-core/') || path.startsWith('.github/') || path === '.eslintignore'
const outside = changed.filter((path) => !allowed(path))
if (outside.length > 0) {
  console.error(
    'Legacy v1 files changed — HONA Core 2.0 PRs may touch only hona-core/**, .github/**, .eslintignore:',
  )
  for (const path of outside) console.error(`  ${path}`)
  process.exit(1)
}
console.log(`legacy untouched: ${changed.length} changed file(s), all inside the allowed paths`)
