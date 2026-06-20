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
    'mountain',
    'step',
    'tides',
    'tubes'
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
let activePort = port;
const duration = parseNumber(args.duration, 0);
const crf = String(parseInteger(args.crf, 28));
const preset = args.preset || 'medium';
const videoBitrate = args['video-bitrate'] || args.bitrate || '';
const maxrate = args.maxrate || '';
const bufsize = args.bufsize || '';
const captureMode = args.capture || 'frames';
const preroll = parseNumber(args.preroll, captureMode === 'x11' ? 3.5 : 0);
const visualizations = parseVisualizations(args.visualizations || args.only);

await main();

async function main() {
    assertBuilt();
    await assertExecutable('ffmpeg');
    await assertExecutable('ffprobe');
    if (captureMode === 'x11') {
        await assertExecutable('Xvfb');
        await assertExecutable('openbox');
    }

    mkdirSync(outputDir, { recursive: true });

    const display = captureMode === 'x11' ? await startVirtualDisplay() : null;
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

        if (display) {
            stopProcess(display.windowManager);
            stopProcess(display.server);
        }
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

    await listenOnAvailablePort(server, preferredPort);

    return server;
}

async function listenOnAvailablePort(server, preferredPort) {
    for (let candidatePort = preferredPort; candidatePort < preferredPort + 20; candidatePort++) {
        try {
            await new Promise((resolveListen, rejectListen) => {
                const handleError = (error) => {
                    server.off('listening', handleListening);
                    rejectListen(error);
                };
                const handleListening = () => {
                    server.off('error', handleError);
                    resolveListen();
                };

                server.once('error', handleError);
                server.once('listening', handleListening);
                server.listen(candidatePort, '127.0.0.1');
            });
            activePort = candidatePort;
            return;
        } catch (error) {
            if (error.code !== 'EADDRINUSE') {
                throw error;
            }
        }
    }

    throw new Error(`Could not bind local render server on ports ${preferredPort}-${preferredPort + 19}`);
}

async function createBrowser() {
    const browserArgs = [
        `--window-size=${width},${height}`,
        '--hide-scrollbars',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--force-device-scale-factor=1',
        '--no-sandbox'
    ];

    if (captureMode === 'x11') {
        browserArgs.push(
            '--window-position=0,0',
            '--kiosk',
            '--start-fullscreen',
            '--ozone-platform=x11',
            '--disable-gpu',
            '--disable-dev-shm-usage'
        );
    }

    const browser = await puppeteer.launch({
        headless: captureMode === 'x11' || args.headed === 'true' ? false : 'new',
        args: browserArgs
    });

    return browser;
}

async function renderVisualization(browser, type) {
    const mp4Path = join(outputDir, `${type}-${width}x${height}-${Date.now()}.mp4`);
    const url = `http://127.0.0.1:${activePort}/render.html`;
    const page = await browser.newPage();

    try {
        page.setDefaultTimeout(6 * 60 * 60 * 1000);
        page.setDefaultNavigationTimeout(60 * 1000);
        await page.setViewport({ width, height, deviceScaleFactor: 1 });

        console.log(`Rendering ${type} at ${width}x${height} ${fps}fps`);
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.waitForSelector('#c');
        await page.bringToFront();

        const playback = await page.evaluate((renderOptions) => {
            return window.hillsideRender.preparePlayback(renderOptions);
        }, {
            type,
            width,
            height,
            fps,
            duration,
            manualFrames: true,
            deterministicTime: captureMode === 'frames'
        });

        const audioPath = join(distDir, playback.audio);
        const captureDuration = duration > 0 ? duration : getAudioDuration(audioPath);
        if (!Number.isFinite(captureDuration) || captureDuration <= 0) {
            throw new Error(`Could not determine duration for ${type}`);
        }

        if (captureMode === 'frames') {
            const capture = startFramePipeCapture(audioPath, mp4Path, captureDuration);
            await writeFramePipeCapture(page, capture, captureDuration, type);
            await waitForProcess(capture, `ffmpeg frame encode for ${type}`);
            await page.evaluate(() => window.hillsideRender.stopPlayback());
        } else if (captureMode === 'x11') {
            await page.evaluate(() => window.hillsideRender.renderFrame());
            if (preroll > 0) {
                console.log(`Prerolling ${preroll}s before capture`);
                await page.evaluate((renderFps, seconds) => new Promise((resolve) => {
                    let remaining = Math.max(1, Math.floor(renderFps * seconds));
                    const timer = window.setInterval(() => {
                        window.hillsideRender.renderFrame();
                        remaining--;
                        if (remaining <= 0) {
                            window.clearInterval(timer);
                            resolve();
                        }
                    }, 1000 / Math.max(renderFps, 1));
                }), fps, preroll);
            }
            const capture = startX11Capture(audioPath, mp4Path, captureDuration);
            await delay(250);
            await page.evaluate((renderFps) => window.hillsideRender.beginManualPlayback(renderFps), fps);
            await waitForProcess(capture, `ffmpeg x11 capture for ${type}`);
            await page.evaluate(() => window.hillsideRender.stopPlayback());
        } else {
            const capture = await startScreencastCapture(page, audioPath, mp4Path, captureDuration);
            await page.evaluate(() => window.hillsideRender.beginPlayback());
            await capture.writeFrames();
            await page.evaluate(() => window.hillsideRender.stopPlayback());
            await capture.stop();
        }

        console.log(`Wrote ${mp4Path}`);
    } finally {
        await page.close();
    }
}

async function startVirtualDisplay() {
    const firstDisplay = parseInteger(args.display, 99);

    for (let displayNumber = firstDisplay; displayNumber < firstDisplay + 20; displayNumber++) {
        const displayName = `:${displayNumber}`;
        const xvfb = spawn('Xvfb', [
            displayName,
            '-screen',
            '0',
            `${width}x${height}x24`,
            '-ac',
            '+extension',
            'RANDR'
        ], {
            stdio: 'ignore'
        });

        await delay(500);

        if (xvfb.exitCode !== null) {
            continue;
        }

        process.env.DISPLAY = displayName;
        const openbox = spawn('openbox', [], {
            env: process.env,
            stdio: 'ignore'
        });

        await delay(500);

        if (openbox.exitCode !== null) {
            stopProcess(xvfb);
            continue;
        }

        return {
            name: displayName,
            server: xvfb,
            windowManager: openbox
        };
    }

    throw new Error(`Could not start Xvfb/openbox from display :${firstDisplay} to :${firstDisplay + 19}`);
}

function startX11Capture(audioPath, outputPath, captureDuration) {
    const displayInput = getDisplayInput();
    return spawn('ffmpeg', [
        '-y',
        '-thread_queue_size', '1024',
        '-f', 'x11grab',
        '-draw_mouse', '0',
        '-video_size', `${width}x${height}`,
        '-framerate', String(fps),
        '-i', displayInput,
        '-i', audioPath,
        '-t', String(captureDuration),
        '-vf', 'format=yuv420p',
        '-r', String(fps),
        '-c:v', 'libx264',
        '-preset', preset,
        '-tune', 'zerolatency',
        ...getVideoRateArgs(),
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        outputPath
    ], {
        stdio: 'inherit'
    });
}

function startFramePipeCapture(audioPath, outputPath, captureDuration) {
    return spawn('ffmpeg', [
        '-y',
        '-thread_queue_size', '1024',
        '-f', 'image2pipe',
        '-framerate', String(fps),
        '-vcodec', 'mjpeg',
        '-i', 'pipe:0',
        '-i', audioPath,
        '-t', String(captureDuration),
        '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p',
        '-r', String(fps),
        '-c:v', 'libx264',
        '-preset', preset,
        ...getVideoRateArgs(),
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        outputPath
    ], {
        stdio: ['pipe', 'inherit', 'inherit']
    });
}

function getVideoRateArgs() {
    if (!videoBitrate) {
        return ['-crf', crf];
    }

    const rateArgs = ['-b:v', videoBitrate];
    if (maxrate) {
        rateArgs.push('-maxrate', maxrate);
    }
    if (bufsize) {
        rateArgs.push('-bufsize', bufsize);
    }

    return rateArgs;
}

async function writeFramePipeCapture(page, ffmpeg, captureDuration, type) {
    const totalFrames = Math.max(1, Math.ceil(captureDuration * fps));
    const progressInterval = Math.max(1, Math.floor(fps * 5));
    const audioStats = {
        bass: { min: Infinity, max: -Infinity },
        mid: { min: Infinity, max: -Infinity },
        treble: { min: Infinity, max: -Infinity },
        beat: { min: Infinity, max: -Infinity },
        audioTime: 0
    };

    for (let frame = 0; frame < totalFrames; frame++) {
        const frameTime = Math.min(frame / fps, captureDuration);
        const result = await page.evaluate(({ time, renderFps }) => {
            const stats = window.hillsideRender.renderFrameAt(time, renderFps);
            const canvas = window.hillsideRender.canvas;
            const jpeg = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];

            return { stats, jpeg };
        }, { time: frameTime, renderFps: fps });

        updateAudioStats(audioStats, result.stats);

        if (!ffmpeg.stdin.write(Buffer.from(result.jpeg, 'base64'))) {
            await new Promise((resolveDrain) => ffmpeg.stdin.once('drain', resolveDrain));
        }

        if (frame > 0 && frame % progressInterval === 0) {
            const seconds = frame / fps;
            const percent = Math.min(100, (frame / totalFrames) * 100).toFixed(1);
            console.log(`${type}: rendered ${seconds.toFixed(1)}s / ${captureDuration.toFixed(1)}s (${percent}%)`);
        }
    }

    ffmpeg.stdin.end();
    console.log(
        `Frame audio ranges: ` +
        `bass=${formatRange(audioStats.bass)} ` +
        `mid=${formatRange(audioStats.mid)} ` +
        `treble=${formatRange(audioStats.treble)} ` +
        `beat=${formatRange(audioStats.beat)} ` +
        `audioTime=${audioStats.audioTime.toFixed(2)}s`
    );
}

function getDisplayInput() {
    const display = process.env.DISPLAY;
    if (!display) {
        throw new Error('DISPLAY is not set for x11 capture.');
    }

    const baseDisplay = display.includes('.') ? display : `${display}.0`;
    return `${baseDisplay}+0,0`;
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
            let lastRenderStats = null;
            const audioStats = {
                bass: { min: Infinity, max: -Infinity },
                mid: { min: Infinity, max: -Infinity },
                treble: { min: Infinity, max: -Infinity },
                beat: { min: Infinity, max: -Infinity },
                audioTime: 0
            };

            for (let frame = 0; frame < totalFrames; frame++) {
                const targetTime = start + (frame * 1000 / fps);
                const waitMs = targetTime - Date.now();
                if (waitMs > 0) {
                    await delay(waitMs);
                }

                const previousFrameCount = frameCount;
                lastRenderStats = await page.evaluate(() => window.hillsideRender.renderFrame());
                updateAudioStats(audioStats, lastRenderStats);
                await waitForScreencastFrame(() => frameCount > previousFrameCount, 250);

                if (!ffmpeg.stdin.write(latestFrame)) {
                    await new Promise((resolveDrain) => ffmpeg.stdin.once('drain', resolveDrain));
                }
            }

            ffmpeg.stdin.end();
            if (lastRenderStats) {
                console.log(
                    `Frame audio ranges: ` +
                    `bass=${formatRange(audioStats.bass)} ` +
                    `mid=${formatRange(audioStats.mid)} ` +
                    `treble=${formatRange(audioStats.treble)} ` +
                    `beat=${formatRange(audioStats.beat)} ` +
                    `audioTime=${audioStats.audioTime.toFixed(2)}s`
                );
            }
        },

        async stop() {
            await client.send('Page.stopScreencast').catch(() => {});
            await waitForProcess(ffmpeg, 'ffmpeg screencast encode');
            await client.detach().catch(() => {});
            console.log(`Captured ${frameCount} browser screencast frames`);
        }
    };
}

function updateAudioStats(audioStats, frameStats) {
    for (const key of ['bass', 'mid', 'treble', 'beat']) {
        audioStats[key].min = Math.min(audioStats[key].min, frameStats[key]);
        audioStats[key].max = Math.max(audioStats[key].max, frameStats[key]);
    }
    audioStats.audioTime = frameStats.analysisTime ?? frameStats.audioTime;
}

function formatRange(range) {
    return `${range.min.toFixed(3)}-${range.max.toFixed(3)}`;
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

function stopProcess(childProcess) {
    if (!childProcess || childProcess.killed || childProcess.exitCode !== null) return;

    childProcess.kill('SIGTERM');
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

async function waitForScreencastFrame(hasNewFrame, timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (!hasNewFrame() && Date.now() < deadline) {
        await delay(5);
    }
}

function delay(ms) {
    return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
