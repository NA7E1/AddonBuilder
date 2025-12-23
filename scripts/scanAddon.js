const { getCurrentProject } = await require('@bridge/env');
const fs = await require('@bridge/fs');
const { join, basename } = await require('@bridge/path');
const projectRoot = await getCurrentProject();

async function scanAddon() {
    await window.appendLog('Starting addon scan...');

    const elements = {
        structures: [],
        features: [],
        unlinked: [],
        unknown: []
    }

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
            await window.appendLog(`Error reading dir ${dir}: ${err.message}`);
            return;
        }

        for (const name of entries) {
            const filePath = join(dir, name);
            let isDir = false;
            try {
                isDir = Array.isArray(await fs.readdir(filePath));
            } catch (err) {
                isDir = false;
            }
            if (isDir) {
                await scan(type, filePath, map);
            } else if (name.toLowerCase().endsWith('.mcstructure') && type === 'mcstructure') {
                const id = filePath.replace(join(projectRoot, 'BP', 'structures'), '').replace(/^[\\\/]/, '').replace('.mcstructure', '');
                map.set(id, { path: filePath });
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
                    await window.appendLog(`Error: ${filePath} - ${err.message}`);
                }
                filesFound++;
            } else {
                elements.unknown.push({ path: filePath, errors: { UNKNOWN_FILE_TYPE: [filePath] } });
                filesFound++;
            }
        }
    };

    // 1. Index Files

    await Promise.all([
        scan('mcstructure', join(projectRoot, 'BP', 'structures'), index.mcstructures),
        scan('structure_set', join(projectRoot, 'BP', 'worldgen', 'structure_sets'), index.structure_sets),
        scan('jigsaw', join(projectRoot, 'BP', 'worldgen', 'structures'), index.jigsaws),
        scan('template_pool', join(projectRoot, 'BP', 'worldgen', 'template_pools'), index.template_pools),
        scan('feature', join(projectRoot, 'BP', 'features'), index.features),
        scan('feature_rules', join(projectRoot, 'BP', 'feature_rules'), index.feature_rules)
    ]);

    await window.appendLog(`Indexing complete: mcstructures=${index.mcstructures.size}, structure_sets=${index.structure_sets.size}, jigsaws=${index.jigsaws.size}, pools=${index.template_pools.size}, features=${index.features.size}, feature_rules=${index.feature_rules.size}, unknown=${elements.unknown.length}`);

    // Helper: Features

    async function checkFeature(id) {
        const featureInfo = index.features.get(id);
        if (!featureInfo) return { identifier: id, type: 'feature', filepath: 'unknown', version: 'unknown', errors: { MISSING_FEATURE: [] }, features: [], structure: null, elementType: null };
        featureInfo.visited = true;

        const feature = {
            identifier: id,
            type: 'feature',
            elementType: featureInfo.elementType,
            filepath: featureInfo.path,
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
                if (feature.features[feature.features.length - 1].errors.INVALID_FEATURE) {
                    feature.errors.INVALID_SUB_FEATURE = [feature.features[feature.features.length - 1].identifier || feature.features[feature.features.length - 1].filepath];
                } else validSubFeatures++;
            }

            if (validSubFeatures === 0) {
                feature.errors.NO_VALID_SUB_FEATURES = [feature.filepath];
            }
        } else if (['minecraft:scatter_feature', 'minecraft:search_feature'].includes(feature.elementType)) {
            feature.subFeature = await checkFeature(featureInfo.data?.places_feature);
            if (feature.subFeature.errors.INVALID_FEATURE) {
                feature.errors.INVALID_SUB_FEATURE = [feature.subFeature.identifier || feature.subFeature.filepath];
                feature.errors.INVALID_FEATURE = [feature.subFeature.identifier || feature.subFeature.filepath];
            }
        } else if (feature.elementType === 'minecraft:snap_to_surface_feature') {
            feature.features.push(await checkFeature(featureInfo.data?.feature_to_snap));
            const snapChild = feature.features[feature.features.length - 1];
            if (snapChild.errors.INVALID_FEATURE) {
                feature.errors.INVALID_SUB_FEATURE = [snapChild.identifier || snapChild.filepath];
                feature.errors.INVALID_FEATURE = [snapChild.identifier || snapChild.filepath];
            }
        } else if (feature.elementType === 'minecraft:structure_template_feature') {
            const structName = featureInfo.data?.structure_name?.split(':')?.pop();
            if (!structName || !index.mcstructures.has(structName)) {
                feature.errors.MISSING_STRUCTURE = [structName || feature.filepath];
                feature.errors.INVALID_FEATURE = [structName || feature.filepath];
            } else feature.structure = index.mcstructures.get(structName);
        } else feature.errors.UNCHECKED_FEATURE = [feature.filepath];
        await window.appendLog(`Returning feature ${id}.`);
        return feature;
    };

    // Helper: Structure Pools

    async function checkPool(id) {
        const poolInfo = index.template_pools.get(id);
        if (!poolInfo) return { identifier: id, type: 'template_pool', filepath: 'unknown', version: 'unknown', errors: { MISSING_POOL: [] }, elements: [] };
        poolInfo.visited = true;

        const pool = {
            identifier: id,
            type: 'template_pool',
            filepath: poolInfo.path || 'unknown',
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
                const child = pool.elements[pool.elements.length - 1];
                await mergeErrors(pool, child);
                if (await hasError(child, "INVALID_FEATURE")) {
                    await addError(pool, "INVALID_POOL_ELEMENT", child.identifier || child.filepath);
                } else validElements++;
            } else await addError(pool, "INVALID_POOL_ELEMENT", pool.filepath);
        };

        if (validElements === 0) await addError(pool, "NO_VALID_ELEMENTS", pool.filepath);

        return pool;
    };

    // Helper: Structure Jigsaws
    async function checkJigsaw(id) {
        const jigsawInfo = index.jigsaws.get(id);
        if (!jigsawInfo) return { identifier: id, type: 'jigsaw', filepath: 'unknown', version: 'unknown', errors: { MISSING_JIGSAW: [] }, start_pool: null, pool_aliases: [] };
        jigsawInfo.visited = true;

        const jigsaw = {
            identifier: id,
            type: 'jigsaw',
            filepath: jigsawInfo.path,
            version: jigsawInfo.version || 'unknown',
            errors: {},
            start_pool: await checkPool(jigsawInfo.data?.start_pool),
            pool_aliases: []
        };

        if (!jigsaw.start_pool || await hasError(jigsaw.start_pool, "NO_VALID_ELEMENTS")) await addError(jigsaw, "INVALID_START_POOL", jigsaw.filepath);

        for (const pool of jigsawInfo.data?.pool_aliases || []) {
            jigsaw.pool_aliases.push(await checkPool(pool));

            const alias = jigsaw.pool_aliases[jigsaw.pool_aliases.length - 1];
            if (await hasError(alias, "NO_VALID_ELEMENTS")) {
                await mergeErrors(jigsaw, alias, alias.identifier || alias.filepath);
                await addError(jigsaw, "INVALID_POOL_ALIAS", alias.identifier || alias.filepath);
            }
        }

        return jigsaw;
    };

    await window.appendLog('Assembling structure sets...');
    // 2. Assemble Structures
    for (const [id, info] of index.structure_sets) {
        index.structure_sets.get(id).visited = true;
        let structure_set = {
            identifier: id,
            type: 'structure_set',
            filepath: info.path,
            version: info.version || 'unknown',
            errors: {},
            jigsaws: []
        };

        let validJigsaws = 0;

        for (const jigsaw of info.data?.structures || []) {
            if (index.jigsaws.has(jigsaw.structure)) {
                structure_set.jigsaws.push(await checkJigsaw(jigsaw.structure));
                const child = structure_set.jigsaws[structure_set.jigsaws.length - 1];
                await mergeErrors(structure_set, child);
                if (!await hasError(child, "INVALID_START_POOL")) validJigsaws++;
            }
        }

        if (validJigsaws > 0) {
            elements.structures.push(structure_set);
        } else {
            await addError(structure_set, "NO_VALID_JIGSAWS", structure_set.filepath);
            elements.unlinked.push(structure_set);
        }
    };

    // 3. Check Orphaned Jigsaws

    for (const [id, info] of index.jigsaws) if (!info.visited) elements.unlinked.push(await checkJigsaw(id));

    // 4. Check Orphaned Pools

    for (const [id, info] of index.template_pools) if (!info.visited) elements.unlinked.push(await checkPool(id));

    await window.appendLog('Assembling features...');
    // 5. Assemble Features

    for (const [id, info] of index.feature_rules) {
        index.feature_rules.get(id).visited = true;
        await window.appendLog(`Feature rule ${id}`);
        const feature_rule = {
            identifier: id,
            type: 'feature_rule',
            filepath: info.path,
            version: info.version || 'unknown',
            errors: {},
            feature: await checkFeature(info.data?.description?.places_feature)
        };
        await window.appendLog(`Feature rule ${id}: ${info.data?.description?.places_feature}, found feature: ${feature_rule.feature?.identifier}`);
        await mergeErrors(feature_rule, feature_rule.feature);
        if (!feature_rule.feature || await hasError(feature_rule.feature, "INVALID_FEATURE")) {
            await addError(feature_rule, "INVALID_FEATURE_RULE", feature_rule.feature?.identifier || feature_rule.filepath);
            elements.unlinked.push(feature_rule);
        } else elements.features.push(feature_rule);
    };

    // 6. Check Orphaned Features

    for (const [id, info] of index.features) if (!info.visited) elements.unlinked.push(await checkFeature(id));

    await window.appendLog(`Scan completed in ${(Date.now() - scanStart) / 1000}s, found ${filesFound} files.\n
    Structures: ${elements.structures.length}, Features: ${elements.features.length}, Unlinked: ${elements.unlinked.length}, Unknown: ${elements.unknown.length}`);
    // Pretty-print `elements` to the log with nesting and errors shown clearly.
    async function prettyLogElements(elements) {
        const indentStr = (n) => '  '.repeat(n);
        const seen = new WeakSet();

        async function logLine(line = '') { await window.appendLog(line); }

        async function logObject(obj, indent = 0) {
            if (obj == null) { await logLine(`${indentStr(indent)}<null>`); return; }
            if (seen.has(obj)) { await logLine(`${indentStr(indent)}<circular>`); return; }
            if (typeof obj !== 'object') { await logLine(`${indentStr(indent)}${String(obj)}`); return; }
            seen.add(obj);

            // Header: identifier/type/path/version if present
            const header = [];
            if (obj.identifier) header.push(`id=${obj.identifier}`);
            if (obj.type) header.push(`type=${obj.type}`);
            if (obj.filepath) header.push(`path=${obj.filepath}`);
            if (obj.version) header.push(`ver=${obj.version}`);
            if (header.length) {
                await logLine(`${indentStr(indent)}- ${header.join(' | ')}`);
            } else {
                await logLine(`${indentStr(indent)}- object`);
            }

            // Errors (special handling)
            if (obj.errors && Object.keys(obj.errors).length) {
                await logLine(`${indentStr(indent + 1)}errors:`);
                for (const [code, sources] of Object.entries(obj.errors)) {
                    const src = Array.isArray(sources) ? sources.join(', ') : String(sources);
                    await logLine(`${indentStr(indent + 2)}${code}: ${src}`);
                }
            }

            // Human-friendly `data` summary (avoid dumping whole payload)
            if (obj.data && typeof obj.data === 'object') {
                const desc = obj.data.description?.identifier || obj.data.name;
                const fmt = obj.data.format_version;
                const parts = [];
                if (desc) parts.push(`desc=${desc}`);
                if (fmt) parts.push(`fmt=${fmt}`);
                if (parts.length) await logLine(`${indentStr(indent + 1)}data: ${parts.join(' | ')}`);
            }

            // Iterate other keys and show nested objects/arrays
            for (const key of Object.keys(obj)) {
                if (['identifier', 'type', 'filepath', 'version', 'errors', 'data'].includes(key)) continue;
                const val = obj[key];
                if (val == null) continue;
                if (Array.isArray(val)) {
                    if (val.length === 0) continue;
                    await logLine(`${indentStr(indent + 1)}${key}:`);
                    for (const item of val) {
                        if (typeof item === 'object') await logObject(item, indent + 2);
                        else await logLine(`${indentStr(indent + 2)}- ${String(item)}`);
                    }
                } else if (typeof val === 'object') {
                    await logLine(`${indentStr(indent + 1)}${key}:`);
                    await logObject(val, indent + 2);
                } else {
                    await logLine(`${indentStr(indent + 1)}${key}: ${String(val)}`);
                }
            }
        }

        await logLine('---- Scan Elements ----');
        for (const section of ['structures', 'features', 'unlinked', 'unknown']) {
            const arr = elements[section] || [];
            await logLine(`${section} (${arr.length}):`);
            for (const el of arr) await logObject(el, 1);
        }
        await logLine('---- End Elements ----');
    }

    await prettyLogElements(elements);

    return elements;
}

window.scanAddon = scanAddon;