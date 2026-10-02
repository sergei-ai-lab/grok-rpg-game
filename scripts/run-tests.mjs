import { build } from 'vite'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Use the game's existing Vite/TypeScript pipeline and Node's test runner.
// No test framework, copied engine or production test hooks are required.
const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = await mkdtemp(resolve(root, '.stage0-test-'))
try {
  await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: 'warn',
    resolve: { alias: { '@': resolve(root, 'src') } },
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      lib: { entry: resolve(root, 'tests/subject.ts'), formats: ['es'], fileName: () => 'subject.mjs' },
      rollupOptions: { external: ['vue', '@vueuse/core', 'vue-i18n'] },
    },
  })
  const simulate = process.argv.includes('--simulate')
  const files = simulate
    ? [resolve(root, 'tests/simulate.mjs')]
    : (await readdir(resolve(root, 'tests'))).filter(f => f.endsWith('.test.mjs')).sort().map(f => resolve(root, 'tests', f))
  const result = spawnSync(process.execPath, simulate ? files : ['--test', ...files], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, STAGE0_SUBJECT_URL: pathToFileURL(resolve(outDir, 'subject.mjs')).href },
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}
finally {
  await rm(outDir, { recursive: true, force: true })
}
