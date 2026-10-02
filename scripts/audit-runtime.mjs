import { build } from 'vite'
import { readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const normalize = id => id.split('?')[0].replace(root + '/', '')
const reached = new Map()
const chunks = []
const dependencyPackages = new Set()
await build({
  logLevel: 'warn',
  build: { write: false },
  plugins: [{
    name: 'stage0-runtime-evidence',
    generateBundle(_options, bundle) {
      for (const id of this.getModuleIds()) {
        if (!id.startsWith(root + '/src/')) continue
        const key = normalize(id)
        const info = this.getModuleInfo(id)
        const previous = reached.get(key) || new Set()
        for (const importer of [...info.importers, ...info.dynamicImporters]) {
          const name = normalize(importer)
          if (name.startsWith('src/')) previous.add(name)
        }
        reached.set(key, previous)
      }
      for (const value of Object.values(bundle)) {
        if (value.type === 'chunk') {
          chunks.push({ file: value.fileName, sourceModules: Object.keys(value.modules).map(normalize).filter(p => p.startsWith('src/')).sort() })
          for (const id of Object.keys(value.modules)) {
            const match = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)
            if (match) dependencyPackages.add(match[1])
          }
        }
      }
    },
  }],
})
async function walk(path) {
  const results = []
  for (const item of await readdir(path, { withFileTypes: true })) {
    const file = `${path}/${item.name}`
    if (item.isDirectory()) results.push(...await walk(file))
    else results.push(file)
  }
  return results
}
const sourceFiles = (await walk('src')).filter(p => /\.(vue|ts|css)$/.test(p)).sort()
const shared = new Set(['src/game/types.ts', 'src/env.d.ts', 'src/vite-env.d.ts'])
const entries = sourceFiles.map(path => ({
  path,
  classification: reached.has(path) ? 'ACTIVE' : shared.has(path) ? 'SHARED' : 'LEGACY / UNUSED',
  evidence: reached.has(path) ? 'Vite production module graph' : shared.has(path) ? 'Type declarations used by active source/tooling' : 'Not reachable from index.html -> src/main.ts; no matching router entry',
  importers: [...(reached.get(path) || [])].sort(),
}))
const counts = entries.reduce((out, row) => { out[row.classification] = (out[row.classification] || 0) + 1; return out }, {})
const assetCounts = {
  monsterReachable: [...reached.keys()].filter(p => p.startsWith('src/assets/monster/')).length,
  propertyReachable: [...reached.keys()].filter(p => p.startsWith('src/assets/property/')).length,
  otherReachable: [...reached.keys()].filter(p => p.startsWith('src/assets/') && !p.startsWith('src/assets/monster/') && !p.startsWith('src/assets/property/')).length,
}
await writeFile('docs/stage0/runtime-map.json', JSON.stringify({ baseline: '2931ea69bfbf653c105f145520d41747c85f4f07', method: 'Actual Vite production graph including dynamic Home/Battle routes and auto imports; type-only shared files identified separately.', counts, assetCounts, entries, chunks, dependencyPackages: [...dependencyPackages].sort() }, null, 2) + '\n')
console.log(JSON.stringify({ counts, assetCounts }))
