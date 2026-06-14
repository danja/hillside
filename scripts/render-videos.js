#!/usr/bin/env node

import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');

const VISUALIZATIONS = [
    'hillside',
    'roofs',
    'road',
    'clouds',
    'wire',
    'mountain'
];

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.webm': 'video/webm',
    '.json': 'application/json; charset=utf-8'
};

const args = parseArgs(process.argv.slice(2));
const distDir = resolve(repoRoot, args.dist || 'dist-render');
const outputDir = resolve(repoRoot, args.output || 'renders');
const width = parseInteger(args.width, 1280);
const height = parseInteger(args.height, 720);
const fps = parseInteger(args.fps, 30);
const port = parseInteger(args.port, 4175);
const duration = parseNumber(args.duration, 0);
const crf = String(parseInteger(args.crf, 18));
const preset = args.preset || 'medium';
const visualizations = parseVisualizations(args.visualizations || args.only);

await main();

async function main() {
    assertBuilt();
    await assertExecutable('ffmpeg');
    await assertExecutable('ffprobe');

    mkdirSync(outputDir, { recursive: true });

    const server = await startServer(distDir, port);
    let browser = null;

    try {
        browser = await createBrowser();

        for (const type of visualizations) {
            await renderVisualization(browser, type);
        }
    } finally {
        if (browser) {
            await browser.close();
        }

        await new Promise((resolveClose) => server.close(resolveClose));
    }
}

function parseArgs(rawArgs) {
    const parsed = {};

    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];
        if (!arg.startsWith('--')) continue;

        const [key, inlineValue] = arg.slice(2).split('=');
        if (inlineValue !== undefined) {
            parsed[key] = inlineValue;
        } else if (rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--')) {
            parsed[key] = rawArgs[i + 1];
            i++;
        } else {
            parsed[key] = 'true';
        }
    }

    return parsed;
}

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumber(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseVisualizations(value) {
    if (!value) return VISUALIZATIONS;

    const selected = value.split(',').map((item) => item.trim()).filter(Boolean);
    const invalid = selected.filter((type) => !VISUALIZATIONS.includes(type));

    if (invalid.length > 0) {
        throw new Error(`Unknown visualization(s): ${invalid.join(', ')}`);
    }

    return selected;
}

function assertBuilt() {
    const renderHtml = join(distDir, 'render.html');
    if (!existsSync(renderHtml)) {
        throw new Error(`Missing ${renderHtml}. Run npm run build:render first.`);
    }
}

async function assertExecutable(command) {
    const result = spawnSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`Missing required executable: ${command}`);
    }
}

async function startServer(rootDir, preferredPort) {
    const server = createServer((request, response) => {
        const requestUrl = new URL(request.url, `http://${request.headers.host}`);
        const pathname = requestUrl.pathname === '/' ? '/render.html' : requestUrl.pathname;
        const safePath = pathname.split('/').map((part) => decodeURIComponent(part)).filter(Boolean);
        const filePath = resolve(rootDir, ...safePath);

        if (!filePath.startsWith(rootDir) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
            response.writeHead(404);
            response.end('Not found');
            return;
        }

        const contentType = MIME_TYPES[extname(filePath)] || 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': contentType });
        createReadStream(filePath).pipe(response);
    });

    await new Promise((resolveListen, rejectListen) => {
        server.once('error', rejectListen);
        server.listen(preferredPort, '127.0.0.1', resolveListen);
    });

    return server;
}

async function createBrowser() {
    const browser = await puppeteer.launch({
        headless: args.headed === 'true' ? false : 'new',
        args: [
            `--window-size=${width},${height}`,
            '--window-position=0,0',
            '--autoplay-policy=no-user-gesture-required',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--force-device-scale-factor=1',
            '--no-sandbox'
        ]
    });

    return browser;
}

async function renderVisualization(browser, type) {
    const mp4Path = join(outputDir, `${type}-${width}x${height}-${Date.now()}.mp4`);
    const url = `http://127.0.0.1:${port}/render.html`;
    const page = await browser.newPage();

    try {
        page.setDefaultTimeout(6 * 60 * 60 * 1000);
        page.setDefaultNavigationTimeout(60 * 1000);
        await page.setViewport({ width, height, deviceScaleFactor: 1 });

        console.log(`Rendering ${type} at ${width}x${height} ${fps}fps`);
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.waitForSelector('#c');

        const playback = await page.evaluate((renderOptions) => {
            return window.hillsideRender.preparePlayback(renderOptions);
        }, { type, width, height, fps, duration });

        const audioPath = join(distDir, playback.audio);
        const captureDuration = duration > 0 ? duration : getAudioDuration(audioPath);
        if (!Number.isFinite(captureDuration) || captureDuration <= 0) {
            throw new Error(`Could not determine duration for ${type}`);
        }

        const capture = await startScreencastCapture(page, audioPath, mp4Path, captureDuration);
        await page.evaluate(() => window.hillsideRender.beginPlayback());
        await capture.writeFrames();
        await page.evaluate(() => window.hillsideRender.stopPlayback());
        await capture.stop();

        console.log(`Wrote ${mp4Path}`);
    } finally {
        await page.close();
    }
}

async function startScreencastCapture(page, audioPath, outputPath, captureDuration) {
    const client = await page.target().createCDPSession();
    let latestFrame = null;
    let frameCount = 0;

    const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-thread_queue_size', '1024',
        '-f', 'image2pipe',
        '-framerate', String(fps),
        '-vcodec', 'mjpeg',
        '-i', 'pipe:0',
        '-i', audioPath,
        '-t', String(captureDuration),
        '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p',
        '-c:v', 'libx264',
        '-preset', preset,
        '-crf', crf,
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        outputPath
    ], {
        stdio: ['pipe', 'inherit', 'inherit']
    });

    client.on('Page.screencastFrame', async (event) => {
        latestFrame = Buffer.from(event.data, 'base64');
        frameCount++;

        try {
            await client.send('Page.screencastFrameAck', { sessionId: event.sessionId });
        } catch (error) {
            // The session can close while the last frame event is being acknowledged.
        }
    });

    await client.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 92,
        maxWidth: width,
        maxHeight: height,
        everyNthFrame: 1
    });

    await waitForFirstFrame(() => latestFrame);

    return {
        async writeFrames() {
            const totalFrames = Math.max(1, Math.ceil(captureDuration * fps));
            const start = Date.now();

            for (let frame = 0; frame < totalFrames; frame++) {
                const targetTime = start + (frame * 1000 / fps);
                const waitMs = targetTime - Date.now();
                if (waitMs > 0) {
                    await delay(waitMs);
                }

                if (!ffmpeg.stdin.write(latestFrame)) {
                    await new Promise((resolveDrain) => ffmpeg.stdin.once('drain', resolveDrain));
                }
            }

            ffmpeg.stdin.end();
        },

        async stop() {
            await client.send('Page.stopScreencast').catch(() => {});
            await waitForProcess(ffmpeg, 'ffmpeg screencast encode');
            await client.detach().catch(() => {});
            console.log(`Captured ${frameCount} browser screencast frames`);
        }
    };
}

function getAudioDuration(audioPath) {
    const result = spawnSync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        audioPath
    ], {
        encoding: 'utf8'
    });

    if (result.status !== 0) {
        throw new Error(`ffprobe failed for ${audioPath}: ${result.stderr}`);
    }

    const audioDuration = Number.parseFloat(result.stdout.trim());
    if (!Number.isFinite(audioDuration) || audioDuration <= 0) {
        throw new Error(`Invalid audio duration for ${audioPath}: ${result.stdout.trim()}`);
    }

    return audioDuration;
}

function waitForProcess(childProcess, label) {
    return new Promise((resolveProcess, rejectProcess) => {
        childProcess.once('error', rejectProcess);
        childProcess.once('exit', (code, signal) => {
            if (code === 0) {
                resolveProcess();
                return;
            }

            rejectProcess(new Error(`${label} failed with ${signal || code}`));
        });
    });
}

async function waitForFirstFrame(getFrame) {
    const deadline = Date.now() + 10000;

    while (!getFrame()) {
        if (Date.now() > deadline) {
            throw new Error('Timed out waiting for the first browser screencast frame');
        }

        await delay(50);
    }
}

function delay(ms) {
    return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
