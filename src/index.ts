import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import cac, { type CAC } from 'cac'
import { readMfdConfig } from './config'
import { buildPage } from './page'
import { startServeServer } from './server'

export {
  readMfdConfig,
  defineConfig,
  resolveLocalized,
  isLocalized,
  normalizeBase,
  withBase,
} from './config'
export type { MfdConfig, MfdConfigData, MfdMcVersionRange } from './config'
export {
  defineStyle,
  type MfdStyleApi,
  type MfdStyleModule,
  type MfdManifest,
  type MfdThemeMode,
  type MfdLocale,
  type Localized,
} from './style-types'
export { buildPage } from './page'
export { startServeServer } from './server'
export { prepareFrontend, frontendTemplateDir } from './build-frontend'

function getVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      version?: string
    }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Build the mfd command line app (a CAC instance).
 *
 * Commands:
 * - page      build the static download page (vitepress-like SSG output)
 * - serve     preview server for the page, manifest and addon endpoints
 * - version   print the version
 * - help      show help
 */
export function createCliApp(): CAC {
  const cli = cac('mfd')

  cli
    .command('page', 'Build the static download page (SSG output)')
    .option('-o, --out <dir>', 'Output directory, overrides distEntry in mfd.config.js')
    .option('--locale <locale>', 'Locale for the static render: en | zh', {
      default: 'en',
    })
    .option('--root <dir>', 'Custom frontend dist directory')
    .action(async (opts) => {
      try {
        const cwd = process.cwd()
        const config = await readMfdConfig(cwd)
        await buildPage({
          config,
          cwd,
          out: opts.out,
          locale: opts.locale === 'zh' ? 'zh' : 'en',
          root: opts.root,
        })
      } catch (err) {
        console.error(err instanceof Error ? err.message : err)
        process.exitCode = 1
      }
    })

  cli
    .command('serve', 'Serve the page, manifest and addon endpoints (preview)')
    .option('-p, --port <port>', 'Port, overrides port in mfd.config.js')
    .option('-H, --host <host>', 'Host to bind', { default: 'localhost' })
    .option('--root <dir>', 'Custom frontend dist directory')
    .action(async (opts) => {
      try {
        const cwd = process.cwd()
        const config = await readMfdConfig(cwd)
        await startServeServer({
          config,
          cwd,
          port: opts.port !== undefined ? Number(opts.port) : undefined,
          host: opts.host || 'localhost',
          root: opts.root,
        })
      } catch (err) {
        console.error(err instanceof Error ? err.message : err)
        process.exitCode = 1
      }
    })

  cli
    .command('version', 'Print the mfd version')
    .action(() => {
      console.log(`mfd v${getVersion()}`)
    })

  cli
    .command('help [command]', 'Show help')
    .action((cmdName?: string) => {
      // cac's outputHelp only prints the currently matched command,
      // so point it at the requested command (or nothing for all)
      const self = cli as unknown as { matchedCommand?: unknown }
      if (cmdName) {
        const target = cli.commands.find((item) => item.name === cmdName)
        if (!target) {
          console.error(`[mfd] unknown command: ${cmdName}`)
          process.exitCode = 1
          return
        }
        self.matchedCommand = target
      } else {
        self.matchedCommand = undefined
      }
      cli.outputHelp()
    })

  cli.help()
  cli.version(getVersion())
  return cli
}
