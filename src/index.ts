import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import cac, { type CAC } from 'cac'
import { readMfdConfig } from './config'
import { startPageServer } from './server'

export { readMfdConfig, defineConfig } from './config'
export type { MfdConfig, MfdConfigData, MfdMcVersionRange } from './config'
export {
  defineStyle,
  type MfdStyleApi,
  type MfdStyleModule,
  type MfdManifest,
  type MfdThemeMode,
  type MfdLocale,
} from './style-types'

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
 * - page      serve the addon downloader website
 * - version   print the version
 * - help      show help
 */
export function createCliApp(): CAC {
  const cli = cac('mfd')

  cli
    .command('page', 'Serve the addon downloader website')
    .option('-p, --port <port>', 'Port to listen on', { default: 9527 })
    .option('-H, --host <host>', 'Host to bind', { default: 'localhost' })
    .option('--addon <file>', 'Path to the .addon file, relative to cwd', {
      default: 'dist.addon',
    })
    .option('--root <dir>', 'Custom frontend dist directory')
    .action(async (opts) => {
      try {
        const cwd = process.cwd()
        const config = await readMfdConfig(cwd)
        await startPageServer({
          config,
          cwd,
          port: Number(opts.port) || 9527,
          host: opts.host || 'localhost',
          addon: opts.addon,
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
