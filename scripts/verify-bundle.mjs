import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, dirname, extname } from 'node:path'

const dist = resolve('dist')
const html = await readFile(resolve(dist, 'index.html'), 'utf8')
assert.match(html, /<div id="app">/)
assert.match(html, /type="module"/)
const files = []
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) await walk(path)
    else files.push(path)
  }
}
await walk(dist)
let references = 0
for (const file of files.filter(f => ['.html', '.css', '.js'].includes(extname(f)))) {
  const content = await readFile(file, 'utf8')
  const candidates = extname(file) === '.html'
    ? [...content.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1])
    : extname(file) === '.css'
      ? [...content.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)].map(m => m[1])
      : [...content.matchAll(/(?:from\s*|import\s*\()["']([^"']+)["']/g)].map(m => m[1])
  for (const ref of candidates) {
    if (/^(?:data:|https?:|#)/.test(ref)) continue
    assert.ok(ref.startsWith('.') || ref.startsWith('/'), `Bare import in static bundle: ${ref}`)
    const path = ref.startsWith('/') ? resolve(dist, '.' + ref) : resolve(dirname(file), ref.split(/[?#]/)[0])
    assert.ok(path.startsWith(dist + '/'), `Bundle reference escaped dist: ${ref}`)
    assert.ok((await stat(path)).isFile(), `Missing bundle asset: ${ref}`)
    references++
  }
}
const js = files.filter(f => extname(f) === '.js')
assert.ok(js.some(f => /HomeView-/.test(f)), 'Home route chunk missing')
assert.ok(js.some(f => /BattleView-/.test(f)), 'Battle route chunk missing')
await stat(resolve(dist, 'ATTRIBUTION.txt'))
await stat(resolve(dist, 'THIRD_PARTY_NOTICES.txt'))
console.log(`Static bundle verified: ${files.length} files, ${references} local references, Home and Battle chunks present.`)
