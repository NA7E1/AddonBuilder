const { create } = await require('@bridge/sidebar');
const { Sidebar } = await require('@bridge/ui');
const { getCurrentProject } = await require('@bridge/env');
const fs = await require('@bridge/fs');

create({
    id: 'NA7E.addonBuilder.sidebar',
    displayName: 'Addon Builder',
    icon: 'mdi-progress-wrench',
    component: Sidebar
});

const LOG_PATH = `${await getCurrentProject()}/.bridge/extensions/AddonBuilder2/addonbuilder.log`;

await fs.writeFile(LOG_PATH, `${new Date().toISOString()}: Addon Builder started\n`);

const logQueue = [];
let isWriting = false;

window.appendLog = async function(line) {
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
            const raw = await fs.readFile(LOG_PATH, 'utf8');
            const existing = typeof raw?.text === 'function' ? await raw.text() : raw || '';
            await fs.writeFile(LOG_PATH, existing + `${new Date().toISOString()}: ${String(line)}\n`);
        } catch (e) {}
        resolve();
    }
    
    isWriting = false;
}

window.addEventListener('unhandledrejection', async (event) => {
    await window.appendLog(String(event.reason));
});