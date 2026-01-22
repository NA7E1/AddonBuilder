const sidebar = await require('@bridge/sidebar');
const notification = await require('@bridge/notification');
const ui = await require('@bridge/ui');
const fs = await require('@bridge/fs');
const PATH = './extensions/AddonBuilder/resources';
const LOG_PATH = `${PATH}/addonbuilder.log`;
const SETTINGS_PATH = `${PATH}/settings.json`;
const SESSION_PATH = `${PATH}/session.json`;
const HELP_PATH = `${PATH}/helpText.json`;
window.PATH = PATH;

window.settings = {
    // Scan Behavior
    scanOnMount: true,
    autoScanAfterChanges: false,
    // Scan Content
    scanStructures: true,
    scanFeatures: true,
    scanSubpacks: true,
    scanUnknown: true,
    // Data Persistence
    saveSessions: true,
    saveAddonData: true,
    // Developer Options
    debugLogging: false,
    disableScanCache: false
};

const readJsonFile = async (path) => {
    try {
        if (!path || !(await fs.fileExists(path))) return {};
        const raw = await fs.readFile(path, 'utf8');
        return JSON.parse(typeof raw === 'string' ? raw : (await raw?.text?.()) || '{}');
    } catch { return {}; }
};

window.parseJSON = async function(path) {
    if (!path || !(await fs.fileExists(path))) return {};
    const raw = await fs.readFile(path, 'utf8');
    const text = typeof raw === 'string' ? raw : (await raw?.text?.()) || '';
    if (!text) return {};
    const cleaned = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
};

window.mergeJSON = async function(target, source) {
    for (const key in source) {
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            target[key] = await window.mergeJSON(target[key] || {}, value);
        } else target[key] = value;
    }
    return target;
};

window.log = async function(line, error) {
    console[error ? 'error' : 'log'](`[AddonBuilder] ${line}`);
    if (error) notification.createError(new Error(`AddonBuilder Error: ${line}`));
    if (window.settings.debugLogging) {
        try {
            const raw = await fs.readFile(LOG_PATH, 'utf8').catch(() => '');
            const existing = typeof raw === 'string' ? raw : (await raw?.text?.()) || '';
            await fs.writeFile(LOG_PATH, `${existing}${new Date().toISOString()}: ${line}\n`);
        } catch { }
    }
};

window.loadSession = async () => (await fs.fileExists(SESSION_PATH)) ? await readJsonFile(SESSION_PATH) : null;

window.saveSession = async function(sessionData) {
    if (!window.settings.saveSessions) return;
    try {
        await fs.writeFile(SESSION_PATH, JSON.stringify(sessionData, null, 2));
    } catch (error) {
        window.log(`Error saving session: ${error.message}`, true);
    }
};

let scanNotification = null;
window.updateScanProgress = (message, percent) => {};

window.performScan = async function() {
    if (scanNotification) return;
    
    try {
        scanNotification = notification.create({
            icon: 'mdi-magnify-scan',
            message: 'Scanning addon...',
            color: 'primary',
            textColor: 'white'
        });
        
        const result = await window.scanAddon();
        const env = await require('@bridge/env');
        
        const serializeIndex = (idx) => idx ? Object.fromEntries(
            Object.entries(idx).map(([k, v]) => [k, Array.from(v?.entries() || [])])
        ) : null;
        
        await window.saveSession({ 
            manifest: result.manifest, 
            elements: result.elements, 
            resources: result.resources,
            addonIndex: serializeIndex(result.addonIndex),
            projectRoot: await env.getCurrentProject()
        });
        
        scanNotification?.dispose();
        scanNotification = null;
        return result;
    } catch (error) {
        window.log(`Scan error: ${error.message}`, true);
        scanNotification?.dispose();
        scanNotification = null;
        throw error;
    }
};

Object.assign(window.settings, await readJsonFile(SETTINGS_PATH));
window.helpText = await readJsonFile(HELP_PATH);

if (await fs.fileExists(SESSION_PATH)) await fs.unlink(SESSION_PATH);

if (window.settings.debugLogging) await fs.writeFile(LOG_PATH, `${new Date().toISOString()}: Addon Builder started\n`);
else if (await fs.fileExists(LOG_PATH)) await fs.unlink(LOG_PATH);

sidebar.create({
    id: 'NA7E.addonBuilder.sidebar',
    displayName: 'Addon Builder',
    icon: 'mdi-progress-wrench',
    component: ui.Sidebar
});

window.addEventListener('unhandledrejection', err => window.log(`Unhandled Rejection: ${err.reason}`, true));