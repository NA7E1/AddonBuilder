const { getCurrentProject } = await require('@bridge/env');
const fs = await require('@bridge/fs');
const { join, basename } = await require('@bridge/path');

async function scanAddon() {

    // 1. Scan Setup
    const elements = {
        structures: [],
        features: [],
        unlinked: []
    };
    
    const index = {
        sets: new Map(),
        structures: new Map(),
        pools: new Map(),
        rules: new Map(),
        features: new Map(),
        mcstructures: new Map()
    };

    const scannedPaths = new Set();
    let filesIndexed = 0;

    const _scanStart = Date.now();
    await window.appendLog(`${new Date().toISOString()}: Scan started...`);

    // Helper: Recursive directory walker
    const getFiles = async (dir) => {
        try {
            const entries = await fs.readdir(dir);
            const files = await Promise.all(entries.map(async (entryName) => {
                const fullPath = join(dir, entryName);
                try {
                    const stat = await fs.stat(fullPath);
                    if (stat && typeof stat.isDirectory === 'function' && stat.isDirectory()) {
                        return await getFiles(fullPath);
                    } else {
                        return fullPath;
                    }
                } catch (e) {
                    // If stat fails, check if it's a directory by trying readdir
                    try {
                        await fs.readdir(fullPath);
                        return await getFiles(fullPath);
                    } catch {
                        return fullPath;
                    }
                }
            }));
            return files.flat(Infinity);
        } catch (e) { 
            await window.appendLog(`getFiles error for ${dir}: ${e.message}`);
            return []; 
        }
    };

    // Helper: File indexer
    const indexFiles = async (subDir, map, typeLabel) => {
        const currentProject = await getCurrentProject();
        const scanPath = `${currentProject}/BP/${subDir}`;
        const files = await getFiles(scanPath);

        for (const filePath of files) {
            filesIndexed++;
            if (filePath.endsWith('.mcstructure')) {
                const name = basename(filePath, '.mcstructure'); // Uses Bridge's path basename
                map.set(name, { path: filePath, type: 'mcstructure' });
                continue;
            }

            if (!filePath.endsWith('.json')) continue;

            try {
                const rawContent = await fs.readFile(filePath, 'utf8');
                const textContent = typeof rawContent?.text === 'function' ? await rawContent.text() : rawContent;
                // Strip comments and trailing commas for JSONC support
                const cleaned = textContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/,\s*([}\]])/g, '$1');
                const json = JSON.parse(cleaned);
                let id = null;

                if (typeLabel === 'structure_set') id = json['minecraft:structure_set']?.description?.identifier;
                else if (typeLabel === 'feature_rule') id = json['minecraft:feature_rules']?.description?.identifier;
                else if (typeLabel === 'structure') id = (json['minecraft:structure'] || json['minecraft:jigsaw'])?.description?.identifier;
                else if (typeLabel === 'structure_pool') id = json['minecraft:template_pool']?.description?.identifier;
                else if (typeLabel === 'feature') {
                    const key = Object.keys(json).find(k => k.startsWith('minecraft:') && k !== 'format_version');
                    id = json[key]?.description?.identifier;
                }

                if (id) {
                    map.set(id, { 
                        path: filePath, 
                        json, 
                        version: json.format_version, 
                        type: typeLabel 
                    });
                } else {
                    elements.unlinked.push({
                        filepath: filePath,
                        type: 'unknown',
                        error: 'MISSING_IDENTIFIER' // Malformed or unknown file
                    });

                    scannedPaths.add(filePath);
                }
            } catch (e) {
                scannedPaths.add(filePath);
            }
        }
    };

    await Promise.all([
        indexFiles('worldgen/structure_sets', index.sets, 'structure_set'),
        indexFiles('worldgen/structures', index.structures, 'structure'),
        indexFiles('worldgen/template_pools', index.pools, 'structure_pool'),
        indexFiles('feature_rules', index.rules, 'feature_rule'),
        indexFiles('features', index.features, 'feature'),
        indexFiles('structures', index.mcstructures, 'mcstructure')
    ]);

    // 2. Resolver Functions

    const resolvePool = async (poolId, tempScanned, depth = 0, processedPools = new Set()) => {
        const pool = index.pools.get(poolId);
        if (!pool) return { valid: false };

        if (processedPools.has(poolId)) return { valid: false };

        processedPools.add(poolId);
        tempScanned.add(pool.path);

        const mcstructurePaths = [];
        const relatedPools = [];
        const elementsList = pool.json['minecraft:template_pool']?.elements || [];

        for (const el of elementsList) {
            const ref = el.element?.location || el.element?.template;
            if (!ref) continue;

            const parts = ref.split('/');
            const nameWithNamespace = parts[parts.length - 1];
            const name = nameWithNamespace.split(':').pop();

            if (index.mcstructures.has(name)) {
                const mc = index.mcstructures.get(name);
                tempScanned.add(mc.path);
                mcstructurePaths.push(mc.path);
            }
        }

        // Find related pools by prefix (for jigsaw structures)
        const poolBaseName = poolId.split(':').pop();
        const poolPrefix = poolBaseName.replace(/(_st|\d+)$/, '');
        
        for (const [otherId, otherPool] of index.pools) {
            if (otherId === poolId) continue;
            if (processedPools.has(otherId)) continue;
            
            const otherBaseName = otherId.split(':').pop();
            const otherPrefix = otherBaseName.replace(/(_st|\d+)$/, '');
            
            if (poolPrefix === otherPrefix) {
                const relatedRes = await resolvePool(otherId, tempScanned, depth + 1, processedPools);
                if (relatedRes.valid) {
                    relatedPools.push(relatedRes.data);
                }
            }
        }

        return {
            valid: true,
            data: {
                identifier: poolId,
                filepath: pool.path,
                version: pool.version,
                mcstructures: mcstructurePaths,
                relatedPools: relatedPools
            }
        };
    };

    const resolveStructure = async (structId, tempScanned, depth = 0) => {
        const struct = index.structures.get(structId);
        if (!struct) return { valid: false };

        tempScanned.add(struct.path);

        const root = struct.json['minecraft:structure'] || struct.json['minecraft:jigsaw'];
        const startPoolId = root?.strategy?.start_pool || root?.start_pool;
        
        if (!startPoolId) return { valid: false };

        const poolRes = await resolvePool(startPoolId, tempScanned, depth + 1);
        if (!poolRes.valid) return { valid: false };

        return {
            valid: true,
            data: {
                identifier: structId,
                filepath: struct.path,
                version: struct.version,
                pools: [poolRes.data]
            }
        };
    };

    const resolveFeature = async (featId, tempScanned, depth = 0) => {
        const feat = index.features.get(featId);
        if (!feat) return { valid: false };

        tempScanned.add(feat.path);

        const key = Object.keys(feat.json).find(k => k.startsWith('minecraft:') && k !== 'format_version');
        const component = feat.json[key];

        const result = {
            identifier: featId,
            filepath: feat.path,
            version: feat.version,
            features: [],
            mcstructures: []
        };

        // A. Check for .mcstructure reference
        const structName = (component.structure_name || component.template)?.split(':').pop();
        if (structName) {
            if (index.mcstructures.has(structName)) {
                const mc = index.mcstructures.get(structName);
                tempScanned.add(mc.path);
                result.mcstructures.push(mc.path);
            }
        }

        // B. Recursive Feature Search (Arrays)
        const possibleArrays = [component.features, component.places_feature, component.weighted_feature_steps];
        for (const arr of possibleArrays) {
            if (Array.isArray(arr)) {
                for (const item of arr) {
                    // Handle weighted arrays: ["feature_id", weight]
                    let childId = typeof item === 'string' ? item : null;
                    
                    if (Array.isArray(item) && item.length > 0) {
                        childId = typeof item[0] === 'string' ? item[0] : null;
                    }
                    
                    if (!childId && typeof item === 'object') {
                        childId = item.feature || item.places_feature;
                    }
                    
                    if (childId) {
                        const childRes = await resolveFeature(childId, tempScanned, depth + 1);
                        if (childRes.valid) result.features.push(childRes.data);
                    }
                }
            }
        }

        // C. Single Reference
        if (component.feature) {
            const childRes = await resolveFeature(component.feature, tempScanned, depth + 1);
            if (childRes.valid) result.features.push(childRes.data);
        }

        return { valid: true, data: result };
    };

    // 3. Scan Structure Sets and Feature Rules

    // A. Structure Sets
    for (const [id, set] of index.sets) {
        const tempScanned = new Set();
        tempScanned.add(set.path);

        const validStructures = [];
        const rawList = set.json['minecraft:structure_set']?.structures || [];

        for (const item of rawList) {
            if (item.structure) {
                const res = await resolveStructure(item.structure, tempScanned, 1);
                if (res.valid) validStructures.push(res.data);
            }
        }

        if (validStructures.length > 0) {
            tempScanned.forEach(p => scannedPaths.add(p));
            elements.structures.push({
                identifier: id,
                filepath: set.path,
                version: set.version,
                structures: validStructures
            });
        } else {
            // Structure set has no valid structures - mark only the set as broken, not the structures
            scannedPaths.add(set.path);
            elements.unlinked.push({
                identifier: id,
                filepath: set.path,
                version: set.version,
                type: 'structure_set',
                error: 'NO_VALID_STRUCTURES'
            });
        }
    }

    // B. Feature Rules
    for (const [id, rule] of index.rules) {
        const tempScanned = new Set();
        tempScanned.add(rule.path);

        const featId = rule.json['minecraft:feature_rules']?.description?.places_feature;
        const res = featId ? await resolveFeature(featId, tempScanned, 1) : { valid: false };

        if (res.valid) {
            tempScanned.forEach(p => scannedPaths.add(p));
            elements.features.push({
                identifier: id,
                filepath: rule.path,
                version: rule.version,
                places_feature: [res.data]
            });
        } else {
            elements.unlinked.push({
                identifier: id,
                filepath: rule.path,
                version: rule.version,
                type: 'feature_rule',
                error: 'BROKEN_FEATURE_REFERENCE'
            });
        }
    }

    // 4. Mark truly orphaned items (not referenced by any structure_set or feature_rule)
    // Structures/pools/features are only orphaned if they weren't scanned as part of any valid chain

    // 4. Match .mcstructure files by name to pools/features
    // Since .mcstructure is binary NBT, match by filename pattern
    for (const [name, mc] of index.mcstructures) {
        if (!scannedPaths.has(mc.path)) {
            // Try to match by name to any pool element or feature
            const baseName = name.toLowerCase().replace(/[_\-]/g, '');
            let matched = false;
            
            // Check if any scanned pool might reference this
            for (const path of scannedPaths) {
                const pathLower = path.toLowerCase();
                if (pathLower.includes(baseName) || baseName.includes(path.split('/').pop().split('.')[0].toLowerCase().replace(/[_\-]/g, ''))) {
                    scannedPaths.add(mc.path);
                    matched = true;
                    break;
                }
            }
            
            if (!matched) {
                elements.unlinked.push({
                    name: name,
                    type: 'mcstructure',
                    filepath: mc.path,
                    error: 'UNUSED_FILE'
                });
            }
        }
    }

    // Log scan end and summary
    const structNames = elements.structures.map(s => s.identifier || s.filepath || '<unknown>').join(', ') || 'None';
    const featNames = elements.features.map(f => f.identifier || f.filepath || '<unknown>').join(', ') || 'None';
    // For unlinked, show file paths for structure_sets/feature_rules, identifiers for others
    const unlinkedNames = elements.unlinked.map(u => {
        if (u.type === 'structure_set' || u.type === 'feature_rule') return u.filepath;
        return u.identifier || u.name || u.filepath || '<unknown>';
    }).join(', ') || 'None';

    const summaryLines = [];
    summaryLines.push(`${new Date().toISOString()}: Scan finished. ${filesIndexed} files indexed in ${((Date.now() - _scanStart) / 1000).toFixed(2)}s`);
    summaryLines.push(`Files in valid chains: ${scannedPaths.size}`);
    summaryLines.push(`Structures found (${elements.structures.length}): ${structNames}`);
    summaryLines.push(`Features found (${elements.features.length}): ${featNames}`);
    summaryLines.push(`Unlinked items (${elements.unlinked.length}): ${unlinkedNames}`);

    await window.appendLog(summaryLines.join('\n'));

    return elements;
}

window.scanAddon = scanAddon;