import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const migrationDir = new URL('../migrations/', import.meta.url)
const registry = await readFile(new URL('index.ts', migrationDir), 'utf8')
const config = await readFile(new URL('../src/payload.config.ts', import.meta.url), 'utf8')

const files = (await readdir(migrationDir))
  .filter((name) => /^\d{8}_\d{6}_.+\.ts$/.test(name))
  .map((name) => name.replace(/\.ts$/, ''))
  .sort()

const registered = [...registry.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1])

assert.deepEqual(
  registered,
  files,
  'Every timestamped Payload migration must be registered exactly once and in filename order',
)
assert.equal(new Set(registered).size, registered.length, 'Migration names must be unique')
assert.match(config, /import \{ migrations \} from '\.\.\/migrations'/)
assert.match(config, /prodMigrations:\s*migrations/)
assert.match(config, /push:\s*false/)

console.log(`Payload migration contract verified: ${registered.length} ordered migrations`)
