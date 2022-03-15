import { join } from 'path';
import { readFile } from 'fs/promises';
import { createServer, ServerResponse } from 'http';
import { build, BuildOptions, BuildResult, OnLoadResult, Plugin, serve } from 'esbuild';
import copy from 'cpy';
import minimatch from 'minimatch';
import debounce from 'lodash.debounce';
import yargs from 'yargs/yargs';
import chokidar, { FSWatcher } from 'chokidar';
import postcss from 'postcss';
import postcssLoadConfig from 'postcss-load-config';

interface Watchers {
    src: FSWatcher;
    assets: FSWatcher;
}

function postcssPlugin(): Plugin {
    return {
        name: 'postcss',
        setup: (build) => {
            build.onLoad({ filter: /\.css$/, namespace: 'file' }, async ({ path }) => {
                if (minimatch(path, `${srcPath}/**/*.css`)) {
                    const { plugins, options } = await postcssLoadConfig();
                    const css = await readFile(path, 'utf-8');
                    const res = await postcss(plugins).process(css, {
                        ...options,
                        from: path,
                    });
                    const result: OnLoadResult = {
                        contents: res.css,
                        loader: 'css',
                    };
                    return result;
                }
                return null;
            });
        },
    };
}

const srcPath = join(process.cwd(), '/src');
const srcGlob = `${srcPath}/**/*.{ts,tsx,css}`;
const assetGlob = ['package.json', `${srcPath}/**/*.html`];

async function copyAssets(watchers: Watchers | null) {
    console.log('Copying assets to dist');
    if (watchers) {
        watchers.assets.on('all', () => void copyAssets(null));
    }
    return await copy(assetGlob, 'dist');
}

const sharedConfig: BuildOptions = {
    sourcemap: 'inline',
    target: 'esnext',
    tsconfig: 'tsconfig-build.json',
    entryPoints: [`src/index.tsx`],
    bundle: true,
    loader: {
        '.svg': 'file',
    },
};

async function buildAll(plugins: Plugin[], watchers?: Watchers, port?: number) {
    console.time('Built in');
    let buildResult: BuildResult | undefined;

    async function doBuild() {
        if (buildResult) {
            buildResult = await buildResult.rebuild?.();
        } else {
            buildResult = await build({
                ...sharedConfig,
                banner: port
                    ? {
                          js: ` (() => new EventSource("http://localhost:${
                              port + 1
                          }").onmessage = () => location.reload())();`,
                      }
                    : undefined,
                outdir: 'dist',
                format: 'cjs',
                plugins,
                incremental: !!watchers,
            });
        }
    }

    try {
        await doBuild();
    } catch (error) {
        if (!watchers) throw error;
    }

    if (watchers) {
        watchers.src.on('all', () => {
            void (async () => {
                console.time('Rebuilt in');
                try {
                    await doBuild();
                } catch (_) {} // eslint-disable-line no-empty
                console.timeEnd('Rebuilt in');
            })();
        });
    }

    console.timeEnd('Built in');
}

async function serveAll(port: number, watchers: Watchers, plugins: Plugin[]) {
    const serveResult = await serve(
        {
            port,
            servedir: 'src',
            onRequest: ({ method, path, timeInMS }) => {
                console.log(`${method} ${path} ${timeInMS}ms`);
            },
        },
        {
            ...sharedConfig,
            banner: {
                js: ` (() => new EventSource("http://localhost:${port + 1}").onmessage = () => location.reload())();`,
            },
            outfile: 'src/index.js',
            plugins,
            incremental: true,
            write: false,
        }
    );

    const clients: ServerResponse[] = [];
    const reloadClients = debounce(() => {
        clients.forEach((res) => res.write('data: update\n\n'));
        clients.length = 0;
    }, 250);
    watchers.src.on('all', reloadClients);

    createServer((req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
            Connection: 'keep-alive',
        });
        return clients.push(res);
    }).listen(port + 1);

    console.log(`Listening on ${serveResult.host}:${port}`);
    return serveResult;
}

interface Arguments {
    port: number;
    watch: boolean;
}

async function cli() {
    const args: Arguments = await yargs(process.argv.slice(2)).options({
        port: { type: 'number', default: 9999 },
        watch: { type: 'boolean', default: false },
    }).argv;

    const plugins = [postcssPlugin()];

    if (args.watch) {
        const watchers: Watchers = {
            src: chokidar.watch([srcGlob], { ignoreInitial: true }),
            assets: chokidar.watch(assetGlob, { ignoreInitial: true }),
        };
        await serveAll(args.port, watchers, plugins);
        await buildAll(plugins, watchers, args.port);
        await copyAssets(watchers);
    } else {
        await buildAll(plugins);
        await copyAssets(null);
    }
}

void cli();
