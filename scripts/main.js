const { create } = await require('@bridge/sidebar');
const { Sidebar } = await require('@bridge/ui');
const { getCurrentProject } = await require('@bridge/env');
const fs = await require('@bridge/fs');
const { dirname } = await require('@bridge/path');
const projectRoot = await getCurrentProject();

create({
    id: 'NA7E.addonBuilder.sidebar',
    displayName: 'Addon Builder',
    icon: 'mdi-progress-wrench',
    component: Sidebar
});

const EXT_PATH = (await fs.fileExists(`${projectRoot}/.bridge/extensions/AddonBuilder/manifest.json`))
    ? `${projectRoot}/.bridge/extensions/AddonBuilder`
    : 'extensions/AddonBuilder';

const LOG_PATH = `${EXT_PATH}/addonbuilder.log`;
const SETTINGS_PATH = `${EXT_PATH}/settings.json`;

const defaultSettings = {
    scanStructures: true,
    scanFeatures: true,
    scanUnknown: true,
    debugLogging: false
};

let settings = defaultSettings;
try {
    if (await fs.fileExists(SETTINGS_PATH)) {
        const raw = await fs.readFile(SETTINGS_PATH, 'utf8');
        const text = typeof raw === 'string' ? raw : await raw.text();
        settings = { ...defaultSettings, ...JSON.parse(text) };
    }
} catch (e) {
    console.error('Failed to load settings:', e);
}

window.addonBuilderSettings = settings;

if (settings.debugLogging) {
    await fs.writeFile(LOG_PATH, `${new Date().toISOString()}: Addon Builder started\n`);
} else {
    try {
        if (await fs.fileExists(LOG_PATH)) await fs.unlink(LOG_PATH);
    } catch (e) { }
}

const logQueue = [];
let isWriting = false;

window.appendLog = async function (line) {
    if (!window.addonBuilderSettings || !window.addonBuilderSettings.debugLogging) return;
    console.log(`[AddonBuilder] ${line}`);
    return new Promise((resolve) => {
        logQueue.push({ line, resolve });
        processLogQueue();
    });
}

async function processLogQueue() {
    if (isWriting || logQueue.length === 0) return;
    isWriting = true;

    while (logQueue.length > 0) {
        const { line, resolve } = logQueue.shift();
        try {
            let existing = '';
            try {
                if (await fs.fileExists(LOG_PATH)) {
                    const raw = await fs.readFile(LOG_PATH, 'utf8');
                    existing = (typeof raw === 'string' ? raw : (await raw?.text?.()) || raw) || '';
                }
            } catch (e) { }
            await fs.writeFile(LOG_PATH, existing + `${new Date().toISOString()}: ${String(line)}\n`);
        } catch (e) {
            console.error('Failed to write to log:', e);
        }
        resolve();
    }

    isWriting = false;
}

window.addEventListener('unhandledrejection', async (event) => {
    await window.appendLog(`Unhandled Rejection: ${String(event.reason)}`);
});