#!/usr/bin/env node
// Forward-only миграции (§16.2, §23.7 п.5): файлы миграций, уже попавшие в базовую
// ветку, не редактируются и не удаляются; журнал только дописывается.
//
//   node scripts/check-migrations-immutable.mjs <base-ref>
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const base = process.argv[2]
if (!base) {
  console.error('usage: check-migrations-immutable.mjs <base-ref>')
  process.exit(2)
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })
const top = git('rev-parse', '--show-toplevel').trim()
const dir = 'hona-core/packages/db/migrations'
const baseFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', base, '--', dir], {
  cwd: top,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

const problems = []
for (const path of baseFiles) {
  const local = join(top, path)
  if (!existsSync(local)) {
    problems.push(`deleted: ${path}`)
    continue
  }
  const before = execFileSync('git', ['show', `${base}:${path}`], { cwd: top, encoding: 'utf8' })
  const after = readFileSync(local, 'utf8')
  if (path.endsWith('meta/_journal.json')) {
    const was = JSON.parse(before).entries
    const now = JSON.parse(after).entries
    if (JSON.stringify(now.slice(0, was.length)) !== JSON.stringify(was)) {
      problems.push(`journal rewritten: ${path}`)
    }
  } else if (before !== after) {
    problems.push(`modified: ${path}`)
  }
}

if (problems.length > 0) {
  console.error('Applied migrations must not change (forward-only, §16.2):')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`migrations immutable vs ${base}: ${baseFiles.length} file(s) from the base checked`)
