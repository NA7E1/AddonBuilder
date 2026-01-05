const env = await require('@bridge/env');
const fs = await require('@bridge/fs');
const path = await require('@bridge/path');
const { getCurrentProject } = env;
const { join } = path;

window.scanAddon = async function () {
    const projectRoot = await getCurrentProject();
    await window.log('Starting addon scan...');

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

    // Helper: Directory Checker
    async function tryReadDir(dirPath) {
        try { return Array.isArray(await fs.readdir(dirPath)); } catch { return false; }
    }

    // Helper: Directory Scanner
    async function scan(type, directory, map) {
        let entries = [];
        try { entries = await fs.readdir(directory); } catch { return; }

        for (const name of entries) {
            const filePath = join(directory, name);
            if (await tryReadDir(filePath)) await scan(type, filePath, map);
            else {
                filesFound++;
                if (type === 'mcstructure' && name.endsWith('.mcstructure')) {
                    const identifier = filePath.replace(join(projectRoot, 'BP', 'structures'), '').replace(/^[\\\/]/, '').replace('.mcstructure', '');
                    map.set(identifier, { identifier, path: filePath, type });
                } else if (name.endsWith('.json')) {
                    try {
                        const parsed = await window.parseJSON(filePath);
                        const key = type === 'feature' ? Object.keys(parsed || {}).find(k => k.startsWith('minecraft:')) : `minecraft:${type}`;
                        const data = parsed?.[key];
                        if (data?.description?.identifier) map.set(data.description.identifier, { path: filePath, visited: false, data, elementType: key, version: parsed?.format_version || 'unknown' });
                        else elements.unknown.push({ path: filePath, errors: { MISSING_IDENTIFIER: [filePath] } });
                    } catch (error) { await window.log(`Error: ${filePath} - ${error.message}`); }
                } else elements.unknown.push({ path: filePath, errors: { UNKNOWN_FILE_TYPE: [filePath] } });
            }
        }
    }

    // 1. Index Files
    await Promise.all([
        scan('mcstructure', join(projectRoot, 'BP', 'structures'), index.mcstructures),
        window.settings.scanStructures && scan('structure_set', join(projectRoot, 'BP', 'worldgen', 'structure_sets'), index.structure_sets),
        window.settings.scanStructures && scan('jigsaw', join(projectRoot, 'BP', 'worldgen', 'structures'), index.jigsaws),
        window.settings.scanStructures && scan('template_pool', join(projectRoot, 'BP', 'worldgen', 'template_pools'), index.template_pools),
        window.settings.scanFeatures && scan('feature', join(projectRoot, 'BP', 'features'), index.features),
        window.settings.scanFeatures && scan('feature_rules', join(projectRoot, 'BP', 'feature_rules'), index.feature_rules)
    ].filter(Boolean));

    // Helper: Item Assembler
    async function checkItem(identifier, map, type, callback) {
        const info = map.get(identifier), isVanilla = identifier?.startsWith('minecraft:');
        if (!info) return { identifier, type, path: 'unknown', version: 'unknown', errors: isVanilla ? {} : { [`MISSING_${type.toUpperCase()}`]: [] }, ...(await callback(null, {})) };
        if (info.checked) return info.checked;
        info.visited = true;
        const item = { identifier, type, path: info.path, version: info.version || 'unknown', errors: {}, ...(await callback(info.data, {})) };
        info.checked = item;
        return item;
    }

    // Helper: Feature Assembler
    async function checkFeature(identifier) {
        return await checkItem(identifier, index.features, 'feature', async function (data, featureItem) {
            featureItem.features = []; featureItem.structure = null; featureItem.elementType = index.features.get(identifier)?.elementType;
            if (!data) return featureItem;

            async function validChild(childId) {
                const childResult = await checkFeature(childId);
                featureItem.features.push(childId);
                return !childResult.errors.INVALID_FEATURE || childId.startsWith('minecraft:');
            }

            let validCount = 0;
            if (['minecraft:weighted_random_feature', 'minecraft:aggregate_feature', 'minecraft:sequence_feature', 'minecraft:conditional_list'].includes(featureItem.elementType)) {
                const list = (featureItem.elementType === 'minecraft:conditional_list' ? data.conditional_features : data.features) || [];
                for (const entry of list) if (await validChild(entry?.feature || entry?.[0] || entry)) validCount++;
                if (!validCount) featureItem.errors = { INVALID_FEATURE: [index.features.get(identifier).path], NO_VALID_SUB_FEATURES: [index.features.get(identifier).path] };
            } else if (['minecraft:scatter_feature', 'minecraft:search_feature', 'minecraft:snap_to_surface_feature'].includes(featureItem.elementType)) {
                if (!(await validChild(data.feature_to_snap || data.places_feature))) featureItem.errors = { INVALID_FEATURE: [index.features.get(identifier).path], INVALID_SUB_FEATURE: [index.features.get(identifier).path] };
            } else if (featureItem.elementType === 'minecraft:structure_template_feature') {
                const name = data.structure_name?.split(':')?.pop();
                if (!name || !index.mcstructures.has(name)) featureItem.errors = { MISSING_STRUCTURE: [index.features.get(identifier).path], INVALID_FEATURE: [index.features.get(identifier).path] };
                else featureItem.structure = name;
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
                if (elementType === 'minecraft:single_pool_element' && index.mcstructures.has(element.element?.location)) {
                    poolItem.elements.push(element.element.location); validCount++;
                } else if (elementType === 'minecraft:feature_pool_element') {
                    const featureResult = await checkFeature(element.element?.feature);
                    poolItem.elements.push(element.element.feature);
                    if (!featureResult.errors.INVALID_FEATURE || element.element.feature?.startsWith('minecraft:')) validCount++;
                    else poolItem.errors.INVALID_POOL_ELEMENT = [index.template_pools.get(identifier).path];
                } else poolItem.errors.INVALID_POOL_ELEMENT = [index.template_pools.get(identifier).path];
            }
            if (!validCount) poolItem.errors.NO_VALID_ELEMENTS = [index.template_pools.get(identifier).path];
            return poolItem;
        });
    }

    // Helper: Jigsaw Assembler
    async function checkJigsaw(identifier) {
        return await checkItem(identifier, index.jigsaws, 'jigsaw', async function (data, jigsawItem) {
            jigsawItem.start_pool = data?.start_pool; jigsawItem.pool_aliases = [];
            if (!data) return jigsawItem;
            const startResult = await checkPool(jigsawItem.start_pool);
            if (!jigsawItem.start_pool || startResult.errors.NO_VALID_ELEMENTS) jigsawItem.errors.INVALID_START_POOL = [index.jigsaws.get(identifier).path];
            for (const alias of data.pool_aliases || []) {
                jigsawItem.pool_aliases.push(alias);
                if ((await checkPool(alias)).errors.NO_VALID_ELEMENTS) jigsawItem.errors.INVALID_POOL_ALIAS = [index.jigsaws.get(identifier).path];
            }
            return jigsawItem;
        });
    }

    // 2. Scan Structure Sets
    await window.log('Assembling structure sets...');
    for (const [identifier, info] of index.structure_sets) {
        info.visited = true;
        const structureSet = { identifier, type: 'structure_set', path: info.path, version: info.version || 'unknown', errors: {}, jigsaws: [] };
        let validJigsaws = 0;
        for (const entry of info.data?.structures || []) {
            if (index.jigsaws.has(entry.structure)) {
                const jigsawResult = await checkJigsaw(entry.structure);
                structureSet.jigsaws.push(entry.structure);
                if (!jigsawResult.errors.INVALID_START_POOL) validJigsaws++;
            }
        }
        if (validJigsaws) elements.structures.linked.push(structureSet);
        else { structureSet.errors.NO_VALID_JIGSAWS = [structureSet.path]; elements.structures.unlinked.push(structureSet); }
    }

    // 3. Scan Orphaned Jigsaws and Pools
    for (const [identifier, info] of index.jigsaws) if (!info.visited) elements.structures.unlinked.push(await checkJigsaw(identifier));
    for (const [identifier, info] of index.template_pools) if (!info.visited) elements.structures.unlinked.push(await checkPool(identifier));

    // 4. Scan Feature Rules
    await window.log('Assembling features...');
    for (const [identifier, info] of index.feature_rules) {
        info.visited = true;
        const featureRule = { identifier, type: 'feature_rule', path: info.path, version: info.version || 'unknown', errors: {}, feature: info.data?.description?.places_feature };
        const featureResult = await checkFeature(featureRule.feature);
        if ((!featureResult || featureResult.errors.INVALID_FEATURE) && !featureRule.feature?.startsWith('minecraft:')) {
            featureRule.errors.INVALID_FEATURE_RULE = [featureRule.path];
            elements.features.unlinked.push(featureRule);
        } else elements.features.linked.push(featureRule);
    }

    // 5. Scan Orphaned Features
    for (const [identifier, info] of index.features) if (!info.visited) elements.features.unlinked.push(await checkFeature(identifier));

    await window.log(`Scan completed in ${(Date.now() - scanStart) / 1000}s, found ${filesFound} files.`);
    await window.log(`Structures: ${elements.structures.linked.length}L/${elements.structures.unlinked.length}U, Features: ${elements.features.linked.length}L/${elements.features.unlinked.length}U, Unknown: ${elements.unknown.length}`);
    return elements;
}