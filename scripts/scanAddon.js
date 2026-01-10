const env = await require('@bridge/env');
const fs = await require('@bridge/fs');
const path = await require('@bridge/path');
const { getCurrentProject } = env;
const { join } = path;

window.scanAddon = async function () {
    const projectRoot = await getCurrentProject();
    await window.log('Starting addon scan...');
    
    window.updateScanProgress('Starting scan...', 0);

    const elements = {
        structures: {
            linked: [],
            unlinked: []
        },
        features: {
            linked: [],
            unlinked: []
        },
        unknown: []
    };
    const resources = {
        structure_files: {
            linked: [],
            unlinked: []
        }
    };
    const index = {
        mcstructures: new Map(),
        structure_sets: new Map(),
        jigsaws: new Map(),
        template_pools: new Map(),
        features: new Map(),
        feature_rules: new Map()
    };
    window.addonIndex = index;

    const scanStart = Date.now();
    let filesFound = 0;

    // 1: Scan manifest.json
    const manifest = await window.parseJSON(join(projectRoot, 'BP', 'manifest.json'));

    // Helper: Directory Checker
    async function tryReadDir(dirPath) {
        try { return Array.isArray(await fs.readdir(dirPath)); } catch { return false; }
    }

    // Helper: Directory Scanner
    async function scan(type, directory, map, subpackName = null) {
        let entries = [];
        try { entries = await fs.readdir(directory); } catch { return; }

        for (const name of entries) {
            const filePath = join(directory, name);
            if (await tryReadDir(filePath)) await scan(type, filePath, map, subpackName);
            else {
                filesFound++;
                if (type === 'mcstructure' && name.endsWith('.mcstructure')) {
                    const basePath = subpackName ? join(projectRoot, 'BP', 'subpacks', subpackName, 'structures') : join(projectRoot, 'BP', 'structures');
                    const identifier = filePath.replace(basePath, '').replace(/^[\\\/]/, '').replace('.mcstructure', '');
                    map.set(filePath, { identifier, path: filePath, type, subpack: subpackName, visited: false });
                } else if (name.endsWith('.json')) {
                    try {
                        const parsed = await window.parseJSON(filePath);
                        const key = type === 'feature' ? Object.keys(parsed || {}).find(k => k.startsWith('minecraft:')) : `minecraft:${type}`;
                        const data = parsed?.[key];
                        if (data?.description?.identifier) {
                            map.set(filePath, { identifier: data.description.identifier, path: filePath, visited: false, data, elementType: key, version: parsed?.format_version || 'unknown', subpack: subpackName });
                            if (subpackName && window.settings?.debugLogging) {
                                await window.log(`Found ${type}: ${data.description.identifier} in subpack ${subpackName}`);
                            }
                        } else {
                            elements.unknown.push({ path: filePath, errors: { MISSING_IDENTIFIER: [filePath] }, subpack: subpackName });
                        }
                    } catch (error) { await window.log(`Error: ${filePath} - ${error.message}`); }
                } else elements.unknown.push({ path: filePath, errors: { UNKNOWN_FILE_TYPE: [filePath] } });
            }
        }
    }

    // Helper: Indentifier Finder
    async function getInfo(map, identifier) {
        if (!identifier) return null;
        if (map.has(identifier)) return map.get(identifier);
        for (const info of map.values()) if (info && info.identifier === identifier) return info;
        return null;
    }

    // Helper: Scan Directories
    async function scanDirectories(baseDir) {
        await Promise.all([
            scan('mcstructure', join(baseDir, 'structures'), index.mcstructures),
            window.settings.scanStructures && scan('structure_set', join(baseDir, 'worldgen', 'structure_sets'), index.structure_sets),
            window.settings.scanStructures && scan('jigsaw', join(baseDir, 'worldgen', 'structures'), index.jigsaws),
            window.settings.scanStructures && scan('template_pool', join(baseDir, 'worldgen', 'template_pools'), index.template_pools),
            window.settings.scanFeatures && scan('feature', join(baseDir, 'features'), index.features),
            window.settings.scanFeatures && scan('feature_rules', join(baseDir, 'feature_rules'), index.feature_rules)
        ].filter(Boolean));
    }

    // 2a. Index Files
    window.updateScanProgress('Indexing files...', 10);
    await scanDirectories(join(projectRoot, 'BP'));

    // 2b. Index Subpacks
    window.updateScanProgress('Indexing subpacks...', 30);
    if (window.settings.scanSubpacks) {
        for (let subpack of (manifest?.subpacks || [])) {
            await scanDirectories(join(projectRoot, 'BP', 'subpacks', subpack.folder_name));
        }
    }

    // Helper: Item Assembler
    async function checkItem(identifier, map, type, callback) {
        const isVanilla = identifier?.startsWith('minecraft:');
        const info = map.get(identifier) || await getInfo(map, identifier);
        if (!info) return { identifier, type, path: 'unknown', version: 'unknown', errors: isVanilla ? {} : { [`MISSING_${type.toUpperCase()}`]: [] }, ...(await callback(null, {})) };
        if (info.checked) return info.checked;
        info.visited = true;
        const base = { identifier: info.identifier || identifier, type, path: info.path, version: info.version || 'unknown', subpack: info.subpack, elementType: info.elementType, errors: {} };
        const item = { ...base, ...(await callback(info.data, base)) };
        info.checked = item;
        return item;
    }

    // Helper: Feature Assembler
    async function checkFeature(identifier) {
        return await checkItem(identifier, index.features, 'feature', async function (data, featureItem) {
            featureItem.features = []; featureItem.structure = null;
            if (!data) return featureItem;

            async function validChild(childId) {
                if (!childId || typeof childId !== 'string') return false;
                const childResult = await checkFeature(childId);
                featureItem.features.push(childId);
                return !childResult.errors.INVALID_FEATURE || childId.startsWith('minecraft:');
            }

            let validCount = 0;
            if (['minecraft:weighted_random_feature', 'minecraft:aggregate_feature', 'minecraft:sequence_feature', 'minecraft:conditional_list'].includes(featureItem.elementType)) {
                const list = (featureItem.elementType === 'minecraft:conditional_list' ? data.conditional_features : data.features) || [];
                for (const entry of list) {
                    const childId = (typeof entry === 'string') ? entry : (typeof entry === 'object' ? entry?.feature : null);
                    if (childId && await validChild(childId)) validCount++;
                }
                if (!validCount) featureItem.errors = { INVALID_FEATURE: [featureItem.path], NO_VALID_SUB_FEATURES: [featureItem.path] };
            } else if (['minecraft:scatter_feature', 'minecraft:search_feature', 'minecraft:snap_to_surface_feature'].includes(featureItem.elementType)) {
                if (!(await validChild(data.feature_to_snap || data.places_feature))) featureItem.errors = { INVALID_FEATURE: [featureItem.path], INVALID_SUB_FEATURE: [featureItem.path] };
            } else if (featureItem.elementType === 'minecraft:structure_template_feature') {
                const name = data.structure_name?.split(':')?.pop();
                const mcstructureInfo = await getInfo(index.mcstructures, name);
                if (!mcstructureInfo) featureItem.errors = { MISSING_STRUCTURE: [featureItem.path], INVALID_FEATURE: [featureItem.path] };
                else {
                    featureItem.structure = name;
                    mcstructureInfo.visited = true;
                }
            }
            return featureItem;
        });
    }

    // Helper: Pool Assembler
    async function checkPool(identifier) {
        return await checkItem(identifier, index.template_pools, 'template_pool', async function (data, poolItem) {
            poolItem.elements = []; poolItem.fallback_pool = data?.fallback_pool;
            if (!data) return poolItem;
            let validCount = 0;
            for (const element of data.elements || []) {
                const elementType = element.element?.element_type;
                if (elementType === 'minecraft:single_pool_element') {
                    const mcstructureInfo = await getInfo(index.mcstructures, element.element?.location);
                    if (mcstructureInfo) {
                        poolItem.elements.push(element.element.location);
                        mcstructureInfo.visited = true;
                        validCount++;
                    }
                } else if (elementType === 'minecraft:feature_pool_element') {
                    const featureResult = await checkFeature(element.element?.feature);
                    poolItem.elements.push(element.element.feature);
                    if (!featureResult.errors.INVALID_FEATURE || element.element.feature?.startsWith('minecraft:')) validCount++;
                    else poolItem.errors.INVALID_POOL_ELEMENT = [poolItem.path];
                } else poolItem.errors.INVALID_POOL_ELEMENT = [poolItem.path];
            }
            if (!validCount) poolItem.errors.NO_VALID_ELEMENTS = [poolItem.path];
            return poolItem;
        });
    }

    // Helper: Jigsaw Assembler
    async function checkJigsaw(identifier) {
        return await checkItem(identifier, index.jigsaws, 'jigsaw', async function (data, jigsawItem) {
            jigsawItem.start_pool = data?.start_pool; jigsawItem.pool_aliases = [];
            if (!data) return jigsawItem;
            const startResult = await checkPool(jigsawItem.start_pool);
            if (!jigsawItem.start_pool || startResult.errors.NO_VALID_ELEMENTS) jigsawItem.errors.INVALID_START_POOL = [jigsawItem.path];
            for (const alias of data.pool_aliases || []) {
                jigsawItem.pool_aliases.push(alias);
                if ((await checkPool(alias)).errors.NO_VALID_ELEMENTS) jigsawItem.errors.INVALID_POOL_ALIAS = [jigsawItem.path];
            }
            return jigsawItem;
        });
    }

    // 2. Scan Structure Sets
    window.updateScanProgress('Assembling structure sets...', 50);
    await window.log('Assembling structure sets...');
    for (const [key, info] of index.structure_sets) {
        info.visited = true;
        const structureSet = { identifier: info.identifier, type: 'structure_set', path: info.path, version: info.version || 'unknown', errors: {}, jigsaws: [] };
        let validJigsaws = 0;
        for (const entry of info.data?.structures || []) {
            const jigsawInfo = await getInfo(index.jigsaws, entry.structure);
            if (jigsawInfo) {
                const jigsawResult = await checkJigsaw(entry.structure);
                structureSet.jigsaws.push(entry.structure);
                if (!jigsawResult.errors.INVALID_START_POOL) validJigsaws++;
            }
        }
        if (validJigsaws) elements.structures.linked.push(structureSet);
        else { structureSet.errors.NO_VALID_JIGSAWS = [structureSet.path]; elements.structures.unlinked.push(structureSet); }
    }

    // 3. Scan Orphaned Jigsaws and Pools
    window.updateScanProgress('Checking orphaned structures...', 60);
    for (const [key, info] of index.jigsaws) if (!info.visited) elements.structures.unlinked.push(await checkJigsaw(info.identifier));
    for (const [key, info] of index.template_pools) if (!info.visited) elements.structures.unlinked.push(await checkPool(info.identifier));

    // 4. Scan Feature Rules
    window.updateScanProgress('Assembling features...', 70);
    await window.log('Assembling features...');
    for (const [key, info] of index.feature_rules) {
        info.visited = true;
        const featureRule = { identifier: info.identifier, type: 'feature_rule', path: info.path, version: info.version || 'unknown', errors: {}, feature: info.data?.description?.places_feature };
        const featureResult = await checkFeature(featureRule.feature);
        const hasErrors = featureResult.errors && Object.keys(featureResult.errors).length > 0;
        if (hasErrors && !featureRule.feature?.startsWith('minecraft:')) {
            featureRule.errors.INVALID_FEATURE_RULE = [featureRule.path];
            elements.features.unlinked.push(featureRule);
        } else elements.features.linked.push(featureRule);
    }

    // 5. Scan Orphaned Features
    window.updateScanProgress('Checking orphaned features...', 80);
    for (const [key, info] of index.features) if (!info.visited) elements.features.unlinked.push(await checkFeature(info.identifier));

    // 6. Scan Structure Files
    window.updateScanProgress('Scanning structure files...', 90);
    for (const [key, info] of index.mcstructures) {
        const resourceItem = { 
            identifier: info.identifier, 
            type: 'mcstructure', 
            path: info.path, 
            subpack: info.subpack 
        };
        if (info.visited) resources.structure_files.linked.push(resourceItem);
        else resources.structure_files.unlinked.push(resourceItem);
    }

    await window.log(`Scan completed in ${(Date.now() - scanStart) / 1000}s, found ${filesFound} files.`);
    await window.log(`Structures: ${elements.structures.linked.length}L/${elements.structures.unlinked.length}U, Features: ${elements.features.linked.length}L/${elements.features.unlinked.length}U, Unknown: ${elements.unknown.length}`);
    await window.log(JSON.stringify(elements));
    return { manifest, elements, resources };
}