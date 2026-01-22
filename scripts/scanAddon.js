const env = await require('@bridge/env');
const fs = await require('@bridge/fs');
const path = await require('@bridge/path');
const { getCurrentProject } = env;
const { join } = path;

window.scanAddon = async function () {
    const projectRoot = await getCurrentProject();
    window.updateScanProgress('Starting scan...', 0);
    
    window.addonIndex = null;
    const jsonCache = new Map();

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
        feature_rules: new Map(),
        processor_lists: new Map()
    };
    window.addonIndex = index;

    const scanStart = Date.now();
    let totalFiles = 0;
    let processedFiles = 0;

    const manifest = await window.parseJSON(join(projectRoot, 'BP', 'manifest.json'));
    
    async function parseJSONCached(filePath) {
        if (jsonCache.has(filePath)) return jsonCache.get(filePath);
        const result = await window.parseJSON(filePath);
        jsonCache.set(filePath, result);
        return result;
    }
    
    const dirCache = new Map();
    async function tryReadDir(dirPath) {
        if (!window.disableScanCache && dirCache.has(dirPath)) return dirCache.get(dirPath);
        try {
            const result = Array.isArray(await fs.readdir(dirPath));
            if (!window.disableScanCache) dirCache.set(dirPath, result);
            return result;
        } catch {
            dirCache.set(dirPath, false);
            return false;
        }
    }

    async function countFiles(dirPath) {
        let count = 0;
        try {
            const entries = await fs.readdir(dirPath);
            const results = await Promise.all(entries.map(async (name) => {
                const filePath = join(dirPath, name);
                if (await tryReadDir(filePath)) return await countFiles(filePath);
                if (name.endsWith('.mcstructure') || name.endsWith('.json')) return 1;
                return 0;
            }));
            count = results.reduce((sum, val) => sum + val, 0);
        } catch { }
        return count;
    }

    // Helper: Directory Scanner
    async function scan(type, directory, map, subpackName = null) {
        let entries = [];
        try { entries = await fs.readdir(directory); } catch { return; }

        const items = await Promise.all(entries.map(async (name) => {
            const filePath = join(directory, name);
            const isDir = await tryReadDir(filePath);
            return { name, filePath, isDir };
        }));

        await Promise.all(items.filter(item => item.isDir).map(item => 
            scan(type, item.filePath, map, subpackName)
        ));

        const files = items.filter(item => !item.isDir && (item.name.endsWith('.mcstructure') || item.name.endsWith('.json')));
        
        const jsonFiles = files.filter(f => f.name.endsWith('.json'));
        if (jsonFiles.length > 0) {
            await Promise.all(jsonFiles.map(async ({ filePath }) => {
                try {
                    await parseJSONCached(filePath);
                } catch {}
            }));
        }
        
        for (const { name, filePath } of files) {
            processedFiles++;
            if (totalFiles > 0 && processedFiles % 10 === 0) {
                const progress = Math.min(88, 10 + Math.floor((processedFiles / totalFiles) * 78));
                window.updateScanProgress(`Scanning (${processedFiles}/${totalFiles})...`, progress);
            }

            if (type === 'mcstructure' && name.endsWith('.mcstructure')) {
                const basePath = subpackName ? join(projectRoot, 'BP', 'subpacks', subpackName, 'structures') : join(projectRoot, 'BP', 'structures');
                const identifier = filePath.replace(basePath, '').replace(/^[\\\/]/, '').replace('.mcstructure', '');
                map.set(filePath, { identifier, path: filePath, type, subpack: subpackName, visited: false });
            } else if (name.endsWith('.json')) {
                try {
                    const parsed = await parseJSONCached(filePath);
                    const key = type === 'feature' ? Object.keys(parsed || {}).find(k => k.startsWith('minecraft:')) : `minecraft:${type}`;
                    const data = parsed?.[key];
                    if (data?.description?.identifier) {
                        map.set(filePath, { identifier: data.description.identifier, path: filePath, visited: false, data, elementType: key, version: parsed?.format_version || 'unknown', subpack: subpackName });
                    } else {
                        elements.unknown.push({ path: filePath, errors: { MISSING_IDENTIFIER: [filePath] }, subpack: subpackName });
                    }
                } catch (error) {
                    if (window.settings?.debugLogging) {
                        await window.log(`Error parsing ${filePath}: ${error.message}`);
                    }
                }
            }
        }
    }

    async function getInfo(map, identifier) {
        if (!identifier) return null;
        if (map.has(identifier)) return map.get(identifier);
        for (const info of map.values()) if (info && info.identifier === identifier) return info;
        return null;
    }

    async function scanDirectories(baseDir, subpackName = null) {
        await Promise.all([
            scan('mcstructure', join(baseDir, 'structures'), index.mcstructures, subpackName),
            window.settings.scanStructures && scan('structure_set', join(baseDir, 'worldgen', 'structure_sets'), index.structure_sets, subpackName),
            window.settings.scanStructures && scan('jigsaw', join(baseDir, 'worldgen', 'structures'), index.jigsaws, subpackName),
            window.settings.scanStructures && scan('template_pool', join(baseDir, 'worldgen', 'template_pools'), index.template_pools, subpackName),
            window.settings.scanStructures && scan('processor_list', join(baseDir, 'worldgen', 'processor_lists'), index.processor_lists, subpackName),
            window.settings.scanFeatures && scan('feature', join(baseDir, 'features'), index.features, subpackName),
            window.settings.scanFeatures && scan('feature_rules', join(baseDir, 'feature_rules'), index.feature_rules, subpackName)
        ].filter(Boolean));
    }

    processedFiles = 0;
    window.updateScanProgress('Counting files...', 5);
    const dirsToCount = [
        join(projectRoot, 'BP', 'structures'),
        join(projectRoot, 'BP', 'worldgen'),
        join(projectRoot, 'BP', 'features'),
        join(projectRoot, 'BP', 'feature_rules')
    ];
    if (window.settings.scanSubpacks) {
        for (let subpack of (manifest?.subpacks || [])) {
            dirsToCount.push(
                join(projectRoot, 'BP', 'subpacks', subpack.folder_name, 'structures'),
                join(projectRoot, 'BP', 'subpacks', subpack.folder_name, 'worldgen'),
                join(projectRoot, 'BP', 'subpacks', subpack.folder_name, 'features'),
                join(projectRoot, 'BP', 'subpacks', subpack.folder_name, 'feature_rules')
            );
        }
    }
    totalFiles = (await Promise.all(dirsToCount.map(dir => countFiles(dir)))).reduce((sum, val) => sum + val, 0);

    window.updateScanProgress('Scanning...', 10);
    await scanDirectories(join(projectRoot, 'BP'));

    if (window.settings.scanSubpacks) {
        for (let subpack of (manifest?.subpacks || [])) {
            await scanDirectories(join(projectRoot, 'BP', 'subpacks', subpack.folder_name), subpack.folder_name);
        }
    }

    // Helper: Item Assembler
    async function checkItem(identifier, map, type, callback) {
        const isVanilla = identifier?.startsWith('minecraft:');
        const info = map.get(identifier) || await getInfo(map, identifier);
        if (!info) return { identifier, type, path: 'unknown', version: 'unknown', errors: isVanilla ? {} : { [`MISSING_${type.toUpperCase()}`]: [] }, ...(await callback(null, {})) };
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
            poolItem.elements = []; 
            poolItem.fallback_pool = data?.fallback_pool;
            poolItem.processor_lists = []; // Track processor lists
            if (!data) return poolItem;
            for (const element of data.elements || []) {
                const elementType = element.element?.element_type;
                if (elementType === 'minecraft:single_pool_element') {
                    const mcstructureInfo = await getInfo(index.mcstructures, element.element?.location);
                    if (mcstructureInfo) {
                        poolItem.elements.push(element.element.location);
                        mcstructureInfo.visited = true;
                        validCount++;
                    }
                    // Track processor lists referenced by this element
                    const processorListId = element.element?.processors;
                    if (processorListId) {
                        const processorListInfo = await getInfo(index.processor_lists, processorListId);
                        if (processorListInfo) {
                            poolItem.processor_lists.push(processorListId);
                            processorListInfo.visited = true;
                        }
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
            }
            return jigsawItem;
        });
    }

    // 2. Scan Structure Sets
    window.updateScanProgress('Assembling structure sets...', 88);
    for (const [key, info] of index.structure_sets) {
        info.visited = true;
        const structureSet = { identifier: info.identifier, type: 'structure_set', path: info.path, version: info.version || 'unknown', subpack: info.subpack, errors: {}, jigsaws: [] };
        let validJigsaws = 0;
        for (const entry of info.data?.structures || []) {
            const jigsawInfo = await getInfo(index.jigsaws, entry.structure);
            if (jigsawInfo) {
                const jigsawResult = await checkJigsaw(entry.structure);
                if (!jigsawResult.errors.INVALID_START_POOL) validJigsaws++;
            }
        }
        if (validJigsaws) elements.structures.linked.push(structureSet);
        else { structureSet.errors.NO_VALID_JIGSAWS = [structureSet.path]; elements.structures.unlinked.push(structureSet); }
    }

    // 3. Scan Orphaned Jigsaws and Pools
    window.updateScanProgress('Checking orphaned structures...', 90);
    for (const [key, info] of index.jigsaws) if (!info.visited) elements.structures.unlinked.push(await checkJigsaw(info.identifier));
    for (const [key, info] of index.template_pools) if (!info.visited) elements.structures.unlinked.push(await checkPool(info.identifier));

    // 4. Scan Feature Rules
    window.updateScanProgress('Assembling features...', 92);
    for (const [key, info] of index.feature_rules) {
        info.visited = true;
        const featureRule = { identifier: info.identifier, type: 'feature_rule', path: info.path, version: info.version || 'unknown', subpack: info.subpack, errors: {}, feature: info.data?.description?.places_feature };
        const featureResult = await checkFeature(featureRule.feature);
        const hasErrors = featureResult.errors && Object.keys(featureResult.errors).length > 0;
        if (hasErrors && !featureRule.feature?.startsWith('minecraft:')) {
            featureRule.errors.INVALID_FEATURE_RULE = [featureRule.path];
            elements.features.unlinked.push(featureRule);
        } else elements.features.linked.push(featureRule);
    }

    window.updateScanProgress('Checking orphaned features...', 94);
    for (const [key, info] of index.features) if (!info.visited) elements.features.unlinked.push(await checkFeature(info.identifier));

    // 6. Scan Structure Files
    window.updateScanProgress('Scanning structure files...', 96);
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

    // 7. Combine Duplicates
    function combineDuplicates(items) {
        const map = new Map();
        for (const item of items) {
            const key = item.identifier || item.path;
            if (!map.has(key)) {
                const instances = item.subpack ? [{ ...item }] : [{ ...item, subpack: null }];
                map.set(key, { identifier: item.identifier, type: item.type, instances });
            } else {
                const existing = map.get(key);
                existing.instances.push({ ...item });
            }
        }
        return Array.from(map.values());
    }
    
    elements.structures.linked = combineDuplicates(elements.structures.linked);
    elements.structures.unlinked = combineDuplicates(elements.structures.unlinked);
    elements.features.linked = combineDuplicates(elements.features.linked);
    elements.features.unlinked = combineDuplicates(elements.features.unlinked);
    elements.unknown = combineDuplicates(elements.unknown);
    resources.structure_files.linked = combineDuplicates(resources.structure_files.linked);
    resources.structure_files.unlinked = combineDuplicates(resources.structure_files.unlinked);

    // 8. Check for duplicate identifiers in same subpack
    function checkDuplicateIdentifiers(items) {
        for (const item of items) {
            if (!item.instances || item.instances.length < 2) continue;
            
            const subpackMap = new Map();
            for (const inst of item.instances) {
                const subpackKey = inst.subpack || 'base';
                if (!subpackMap.has(subpackKey)) {
                    subpackMap.set(subpackKey, []);
                }
                subpackMap.get(subpackKey).push(inst);
            }
            
            for (const [subpackKey, instances] of subpackMap) {
                if (instances.length > 1) {
                    for (const inst of instances) {
                        if (!inst.errors) inst.errors = {};
                        inst.errors.DUPLICATE_IDENTIFIER = paths.filter(p => p !== inst.path);
                    }
                }
            }
        }
    }
    
    checkDuplicateIdentifiers(elements.structures.linked);
    checkDuplicateIdentifiers(elements.structures.unlinked);
    checkDuplicateIdentifiers(elements.features.linked);
    checkDuplicateIdentifiers(elements.features.unlinked);
    checkDuplicateIdentifiers(resources.structure_files.linked);
    checkDuplicateIdentifiers(resources.structure_files.unlinked);

    await window.log(`Scan completed in ${(Date.now() - scanStart) / 1000}s, processed ${processedFiles} files.`);
    await window.log(`Structures: ${elements.structures.linked.length}L/${elements.structures.unlinked.length}U, Features: ${elements.features.linked.length}L/${elements.features.unlinked.length}U, Unknown: ${elements.unknown.length}`);
    return { manifest, elements, resources, addonIndex: window.addonIndex };
};