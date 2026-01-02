const env = await require('@bridge/env');
const fs = await require('@bridge/fs');
const path = await require('@bridge/path');
const { getCurrentProject } = env;
const { join } = path;

async function scanAddon() {
    const projectRoot = await getCurrentProject();
    await window.log('Starting addon scan...');

    const elements = {
        structures: { linked: [], unlinked: [] },
        features: { linked: [], unlinked: [] },
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

    const scanStart = Date.now();
    let filesFound = 0;

    // Helper: Recursive Indexer

    async function scan(type, dir, map) {
        let entries;
        try { entries = await fs.readdir(dir); } catch (err) {
            await window.log(`Error reading dir ${dir}: ${err.message}`, true);
            return;
        }

        for (const name of entries) {
            const filePath = join(dir, name);
            let isDir = false;
            try { isDir = Array.isArray(await fs.readdir(filePath)); } catch (e) { }

            if (isDir) {
                await scan(type, filePath, map);
            } else if (name.toLowerCase().endsWith('.mcstructure') && type === 'mcstructure') {
                const id = filePath.replace(join(projectRoot, 'BP', 'structures'), '').replace(/^[\\\/]/, '').replace('.mcstructure', '');
                map.set(id, { identifier: id, path: filePath, type: 'mcstructure' });
                filesFound++;
            } else if (name.toLowerCase().endsWith('.json')) {
                try {
                    const raw = await fs.readFile(filePath, 'utf8');
                    const text = typeof raw === 'string' ? raw : await raw.text();
                    const cleaned = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/,\s*([}\]])/g, '$1');
                    const parsed = JSON.parse(cleaned);

                    const key = type !== 'feature' ? `minecraft:${type}` : Object.keys(parsed || {}).find(k => k.startsWith('minecraft:'));
                    const data = parsed?.[key];

                    if (data?.description?.identifier) {
                        map.set(data.description.identifier, { path: filePath, visited: false, data, elementType: key, version: parsed?.format_version || 'unknown' });
                    } else {
                        elements.unknown.push({ path: filePath, errors: { MISSING_IDENTIFIER: [filePath] } });
                    }
                } catch (err) {
                    await window.log(`Error: ${filePath} - ${err.message}`);
                }
                filesFound++;
            } else {
                elements.unknown.push({ path: filePath, errors: { UNKNOWN_FILE_TYPE: [filePath] } });
                filesFound++;
            }
        }
    }

    // 1. Index Files

    const tasks = [
        scan('mcstructure', join(projectRoot, 'BP', 'structures'), index.mcstructures)
    ];

    if (window.settings.scanStructures) {
        tasks.push(
            scan('structure_set', join(projectRoot, 'BP', 'worldgen', 'structure_sets'), index.structure_sets),
            scan('jigsaw', join(projectRoot, 'BP', 'worldgen', 'structures'), index.jigsaws),
            scan('template_pool', join(projectRoot, 'BP', 'worldgen', 'template_pools'), index.template_pools)
        );
    }

    if (window.settings.scanFeatures) {
        tasks.push(
            scan('feature', join(projectRoot, 'BP', 'features'), index.features),
            scan('feature_rules', join(projectRoot, 'BP', 'feature_rules'), index.feature_rules)
        );
    }

    await Promise.all(tasks);

    await window.log(`Indexing complete: mcstructures=${index.mcstructures.size}, structure_sets=${index.structure_sets.size}, jigsaws=${index.jigsaws.size}, pools=${index.template_pools.size}, features=${index.features.size}, feature_rules=${index.feature_rules.size}, unknown=${elements.unknown.length}`);

    // Helper: Features

    async function checkFeature(id) {
        const featureInfo = index.features.get(id);
        if (!featureInfo) return { identifier: id, type: 'feature', path: 'unknown', version: 'unknown', errors: { MISSING_FEATURE: [] }, features: [], structure: null, elementType: null };
        featureInfo.visited = true;

        const feature = {
            identifier: id,
            type: 'feature',
            elementType: featureInfo.elementType,
            path: featureInfo.path,
            version: featureInfo.version || 'unknown',
            errors: {},
            features: [],
            structure: null
        };

        let validSubFeatures = 0;
        if (['minecraft:weighted_random_feature', 'minecraft:aggregate_feature', 'minecraft:sequence_feature', 'minecraft:conditional_list'].includes(feature.elementType)) {
            validSubFeatures = 0;
            for (const featureElement of (feature.elementType === 'minecraft:conditional_list' ? featureInfo.data?.conditional_features : featureInfo.data?.features) || []) {
                let checkId;
                switch (feature.elementType) {
                    case 'minecraft:weighted_random_feature':
                        checkId = featureElement?.[0];
                        break;
                    case 'minecraft:aggregate_feature':
                    case 'minecraft:sequence_feature':
                        checkId = featureElement;
                        break;
                    case 'minecraft:conditional_list':
                        checkId = featureElement?.feature;
                        break;
                }
                feature.features.push(await checkFeature(checkId));
                const childFeature = feature.features[feature.features.length - 1];
                if (!childFeature.errors.INVALID_FEATURE || childFeature.description?.identifier?.startsWith('minecraft:')) validSubFeatures++;
            }

            if (validSubFeatures === 0) {
                feature.errors.NO_VALID_SUB_FEATURES = [feature.path];
                feature.errors.INVALID_FEATURE = [feature.path];
            }
        } else if (['minecraft:scatter_feature', 'minecraft:search_feature', 'minecraft:snap_to_surface_feature'].includes(feature.elementType)) {
            const checkId = feature.elementType === 'minecraft:snap_to_surface_feature'
                ? featureInfo.data?.feature_to_snap
                : featureInfo.data?.places_feature;

            const child = await checkFeature(checkId);
            feature.features.push(child);

            if (child.errors.INVALID_FEATURE || child.description?.identifier?.startsWith('minecraft:')) {
                feature.errors.INVALID_SUB_FEATURE = [feature.path];
                feature.errors.INVALID_FEATURE = [feature.path];
            }
        } else if (feature.elementType === 'minecraft:structure_template_feature') {
            const structName = featureInfo.data?.structure_name?.split(':')?.pop();
            if (!structName || !index.mcstructures.has(structName) || structName.startsWith('minecraft:')) {
                feature.errors.MISSING_STRUCTURE = [feature.path];
                feature.errors.INVALID_FEATURE = [feature.path];
            } else feature.structure = index.mcstructures.get(structName);
        }
        return feature;
    }

    // Helper: Structure Pools

    async function checkPool(id) {
        const poolInfo = index.template_pools.get(id);
        if (!poolInfo) return { identifier: id, type: 'template_pool', path: 'unknown', version: 'unknown', errors: { MISSING_POOL: [] }, elements: [] };
        poolInfo.visited = true;

        const pool = {
            identifier: id,
            type: 'template_pool',
            path: poolInfo.path || 'unknown',
            version: poolInfo.version || 'unknown',
            errors: {},
            elements: []
        };

        let validElements = 0;

        for (const element of poolInfo.data?.elements || []) {
            if (element.element?.element_type === 'minecraft:single_pool_element' && index.mcstructures.has(element.element?.location)) {
                pool.elements.push(index.mcstructures.get(element.element?.location));
                validElements++;
            } else if (element.element?.element_type === 'minecraft:feature_pool_element') {
                pool.elements.push(await checkFeature(element.element?.feature));
                if (pool.elements[pool.elements.length - 1].errors.INVALID_FEATURE) {
                    pool.errors.INVALID_POOL_ELEMENT = [pool.path];
                } else validElements++;
            } else pool.errors.INVALID_POOL_ELEMENT = [pool.path];
        }

        if (validElements === 0) pool.errors.NO_VALID_ELEMENTS = [pool.path];

        return pool;
    }

    // Helper: Structure Jigsaws

    async function checkJigsaw(id) {
        const jigsawInfo = index.jigsaws.get(id);
        if (!jigsawInfo) return { identifier: id, type: 'jigsaw', path: 'unknown', version: 'unknown', errors: { MISSING_JIGSAW: [] }, start_pool: null, pool_aliases: [] };
        jigsawInfo.visited = true;

        const jigsaw = {
            identifier: id,
            type: 'jigsaw',
            path: jigsawInfo.path,
            version: jigsawInfo.version || 'unknown',
            errors: {},
            start_pool: await checkPool(jigsawInfo.data?.start_pool),
            pool_aliases: []
        };

        if (!jigsaw.start_pool || jigsaw.start_pool.errors.NO_VALID_ELEMENTS) jigsaw.errors.INVALID_START_POOL = [jigsaw.path];

        for (const pool of jigsawInfo.data?.pool_aliases || []) {
            jigsaw.pool_aliases.push(await checkPool(pool));

            if (jigsaw.pool_aliases[jigsaw.pool_aliases.length - 1].errors.NO_VALID_ELEMENTS) {
                jigsaw.errors.INVALID_POOL_ALIAS = [jigsaw.path];
            }
        }

        return jigsaw;
    }

    // 2. Assemble Structures

    await window.log('Assembling structure sets...');

    for (const [id, info] of index.structure_sets) {
        index.structure_sets.get(id).visited = true;
        let structure_set = {
            identifier: id,
            type: 'structure_set',
            path: info.path,
            version: info.version || 'unknown',
            errors: {},
            jigsaws: []
        };

        let validJigsaws = 0;

        for (const jigsaw of info.data?.structures || []) {
            if (index.jigsaws.has(jigsaw.structure)) {
                structure_set.jigsaws.push(await checkJigsaw(jigsaw.structure));
                if (!structure_set.jigsaws[structure_set.jigsaws.length - 1].errors.INVALID_START_POOL) validJigsaws++;
            }
        }

        if (validJigsaws > 0) {
            elements.structures.linked.push(structure_set);
        } else {
            structure_set.errors.NO_VALID_JIGSAWS = [structure_set.path];
            elements.structures.unlinked.push(structure_set);
        }
    }

    // 3. Check Orphaned Jigsaws

    for (const [id, info] of index.jigsaws) if (!info.visited) elements.structures.unlinked.push(await checkJigsaw(id));

    // 4. Check Orphaned Pools

    for (const [id, info] of index.template_pools) if (!info.visited) elements.structures.unlinked.push(await checkPool(id));

    // 5. Assemble Features

    await window.log('Assembling features...');

    for (const [id, info] of index.feature_rules) {
        index.feature_rules.get(id).visited = true;
        const feature_rule = {
            identifier: id,
            type: 'feature_rule',
            path: info.path,
            version: info.version || 'unknown',
            errors: {},
            feature: await checkFeature(info.data?.description?.places_feature)
        };
        if ((!feature_rule.feature || feature_rule.feature.errors.INVALID_FEATURE) && !info.data?.description?.places_feature.startsWith('minecraft:')) {
            feature_rule.errors.INVALID_FEATURE_RULE = [feature_rule.path];
            elements.features.unlinked.push(feature_rule);
        } else elements.features.linked.push(feature_rule);
    }

    // 6. Check Orphaned Features

    for (const [id, info] of index.features) if (!info.visited) elements.features.unlinked.push(await checkFeature(id));

    await window.log(`Scan completed in ${(Date.now() - scanStart) / 1000}s, found ${filesFound} files.`);
    await window.log(`Structures: L=${elements.structures.linked.length}/U=${elements.structures.unlinked.length}, Features: L=${elements.features.linked.length}/U=${elements.features.unlinked.length}, Unknown: ${elements.unknown.length}`);

    return elements;
}

window.scanAddon = scanAddon;