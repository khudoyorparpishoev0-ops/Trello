#!/usr/bin/env node
// Размер начального бандла web (§16.3 build): JS и CSS, на которые ссылается
// apps/web/dist/index.html, в сумме не больше 600 КБ gzip.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const LIMIT_BYTES = 600 * 1024
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'dist')
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])
if (assets.length === 0) {
  console.error('check-bundle-size: no initial assets found in dist/index.html — build first')
  process.exit(1)
}
let total = 0
for (const asset of assets) {
  const size = gzipSync(readFileSync(join(dist, asset))).length
  total += size
  console.log(`${asset}  ${(size / 1024).toFixed(1)} KB gzip`)
}
console.log(`initial bundle: ${(total / 1024).toFixed(1)} KB gzip (limit ${LIMIT_BYTES / 1024} KB)`)
if (total > LIMIT_BYTES) {
  console.error('check-bundle-size: initial bundle exceeds the limit')
  process.exit(1)
}
