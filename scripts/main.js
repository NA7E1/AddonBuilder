const sidebar = await require('@bridge/sidebar')
const notification = await require('@bridge/notification')
const ui = await require('@bridge/ui')
const fs = await require('@bridge/fs');

const PATH = './extensions/AddonBuilder/resources';
const LOG = `${PATH}/addonbuilder.log`
const SETTINGS = `${PATH}/settings.json`
const HELP = `${PATH}/helpText.json`;

const readJson = async (path) => {
    try {
        if (!(await fs.fileExists(path))) return {};
        const raw = await fs.readFile(path, 'utf8');
        return JSON.parse(typeof raw === 'string' ? raw : await raw.text());
    } catch (err) { return {} };
};

window.settings = { scanStructures: true, scanFeatures: true, scanUnknown: true, debugLogging: false };

Object.assign(window.settings, await readJson(SETTINGS));
window.helpText = await readJson(HELP);

const logQueue = [];
let isLogging = false;

window.log = async (line, error) => {
    if (error) {
        console.error(`[AddonBuilder] ${line}`);
        notification.createError(new Error(`AddonBuilder Error: ${line}`));
    } else console.log(`[AddonBuilder] ${line}`);

    if (window.settings.debugLogging) {
        logQueue.push(line);
        if (isLogging) return;
        isLogging = true;
        try {
            while (logQueue.length > 0) {
                const raw = await fs.readFile(LOG, 'utf8').catch(() => '');
                const existing = typeof raw === 'string' ? raw : (await raw?.text?.()) || '';
                await fs.writeFile(LOG, existing + `${new Date().toISOString()}: ${logQueue.shift()}\n`);
            }
        } catch (err) { window.log(`Log Error: ${err.message}`, true); }
        isLogging = false;
    }
};

if (window.settings.debugLogging) await fs.writeFile(LOG, `${new Date().toISOString()}: Addon Builder started\n`);
else if (await fs.fileExists(LOG)) await fs.unlink(LOG);

sidebar.create({
    id: 'NA7E.addonBuilder.sidebar',
    displayName: 'Addon Builder',
    icon: 'mdi-progress-wrench',
    component: ui.Sidebar
});

window.addEventListener('unhandledrejection', err => window.log(`Unhandled Rejection: ${err.reason}`, true));