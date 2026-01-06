<template>
    <v-container>
        <header class="d-flex align-center justify-space-between mb-4">
            <div>
                <h1 class="text-h6 mb-1">Addon Builder</h1>
                <p class="text-body-2 grey--text mb-0">Create and manage your addon elements.</p>
            </div>
            <v-btn icon color="tertiary" @click="showSettings = true">
                <v-icon>mdi-cog</v-icon>
            </v-btn>
        </header>

        <v-btn block color="primary" class="mb-4 rounded-lg" depressed large @click="scan()">
            <v-icon left>mdi-magnify</v-icon>
            Scan Project
        </v-btn>

        <v-row>
            <v-col v-for="(group, key) in elements" :key="key" cols="12">
                <v-card outlined class="rounded-lg overflow-hidden">
                    <div class="d-flex align-center py-2 px-3 select-none sidebarNavigation" @click="expanded[key] = !expanded[key]" style="cursor: pointer; user-select: none;">
                        <div class="d-flex align-center flex-grow-1">
                            <v-icon class="mr-3" color="primary">{{ elementInfo[key].icon }}</v-icon>
                            <div class="d-flex flex-column">
                                <span class="text-subtitle-1 font-weight-bold">{{ elementInfo[key].name }}</span>
                                <span class="text-caption grey--text">{{ Array.isArray(group) ? group.length : (group.linked.length + group.unlinked.length) }} items</span>
                            </div>
                        </div>
                        
                        <div class="d-flex align-center">
                            <v-btn v-if="key !== 'unknown'" small color="primary" class="mr-2" @click.stop="createElement(key)">
                                <v-icon left small>mdi-plus</v-icon> Create New
                            </v-btn>
                            <v-icon color="grey">{{ expanded[key] ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                        </div>
                    </div>

                    <v-expand-transition>
                        <div v-show="expanded[key]" class="sidebarSelection">
                            <v-divider></v-divider>
                            <v-card-text class="pa-0">
                                
                                <template v-if="!Array.isArray(group)">
                                    <v-list dense color="transparent" class="pa-0">
                                        <template v-for="item in [...group.linked, ...group.unlinked]" :key="item.identifier">
                                            <v-list-group no-action append-icon="mdi-chevron-down" class="ab-element-group">
                                                <template v-slot:activator>
                                                    <v-list-item-content @click.stop="openEditor(item, key)" style="cursor: pointer;">
                                                        <v-list-item-title class="d-flex align-center">
                                                            <span :class="group.linked.includes(item) ? 'primary--text font-weight-bold' : 'grey--text'">{{ item.identifier.split(':').pop() }}</span>
                                                            <span v-if="!group.linked.includes(item)" class="text-overline grey--text ml-2" style="font-size: 8px !important;">Unlinked</span>
                                                            <v-tooltip bottom v-if="item.errors && Object.keys(item.errors).length > 0">
                                                                <template v-slot:activator="{ on, attrs }">
                                                                    <v-icon small color="error" class="ml-2" v-bind="attrs" v-on="on">mdi-alert-circle</v-icon>
                                                                </template>
                                                                <div class="d-flex flex-column text-left">
                                                                    <div v-for="(errors, type) in item.errors" :key="type">
                                                                        <strong>{{ type }}:</strong> {{ Array.isArray(errors) ? errors.join(', ') : errors }}
                                                                    </div>
                                                                </div>
                                                            </v-tooltip>
                                                        </v-list-item-title>
                                                        <v-list-item-subtitle class="text-caption text--secondary font-italic">{{ item.path ? item.path.split(/[\\/]/).pop() : 'No File' }}</v-list-item-subtitle>
                                                    </v-list-item-content>
                                                    
                                                    <v-list-item-action class="flex-row align-center mr-n4">
                                                        <v-btn icon small v-if="item.path" color="primary" class="mr-1" @click.stop="handleOpenFile(item.path)" title="Open in Default Editor">
                                                            <v-icon small>mdi-file-document-outline</v-icon>
                                                        </v-btn>
                                                        <v-btn icon small color="error" @click.stop="deleteItem(item)" title="Delete Element">
                                                            <v-icon small>mdi-trash-can</v-icon>
                                                        </v-btn>
                                                    </v-list-item-action>
                                                </template>

                                                <v-list-item v-for="(child, idx) in getFlattenedHierarchy(item)" :key="child.id || idx" :style="{ paddingLeft: (child.level * 16 + 12) + 'px' }" class="min-height-32">
                                                    <v-list-item-content class="py-1">
                                                        <v-list-item-title class="text-caption d-flex align-center">
                                                            <v-icon small class="mr-1" :color="child.hasError ? 'error' : 'grey'">{{ child.icon || 'mdi-file-outline' }}</v-icon>
                                                            <span :class="{'error--text': child.hasError, 'grey--text text--lighten-1': !child.path}">{{ child.name }}</span>
                                                            <v-tooltip bottom v-if="child.hasError">
                                                                <template v-slot:activator="{ on, attrs }">
                                                                    <v-icon x-small color="error" class="ml-1" v-bind="attrs" v-on="on">mdi-alert-circle</v-icon>
                                                                </template>
                                                                <div class="text-left text-caption">
                                                                    <div v-for="(errors, type) in child.errors" :key="type">
                                                                        <strong>{{ type }}:</strong> {{ Array.isArray(errors) ? errors.join(', ') : errors }}
                                                                    </div>
                                                                </div>
                                                            </v-tooltip>
                                                        </v-list-item-title>
                                                    </v-list-item-content>
                                                    <v-list-item-action class="my-0">
                                                        <v-btn icon x-small v-if="child.path" color="tertiary" @click.stop="handleOpenFile(child.path)">
                                                            <v-icon x-small>mdi-file-document-outline</v-icon>
                                                        </v-btn>
                                                    </v-list-item-action>
                                                </v-list-item>
                                            </v-list-group>
                                        </template>
                                    </v-list>
                                    <div v-if="group.linked.length === 0 && group.unlinked.length === 0" class="pa-4 text-center text--secondary text-caption">
                                        No items found.
                                    </div>
                                </template>

                                <template v-else>
                                    <v-list dense v-if="group.length > 0" color="transparent" class="pa-0">
                                        <v-list-item v-for="item in group" :key="item.path" class="min-height-48 px-3">
                                            <v-list-item-content @click="handleOpenFile(item.path)" style="cursor: pointer;">
                                                <v-list-item-title class="error--text font-weight-medium text-caption">{{ item.path.split(/[\\/]/).pop() }}</v-list-item-title>
                                                <v-list-item-subtitle class="text-caption grey--text text-truncate">{{ item.errors ? Object.keys(item.errors).join(', ') : 'Unknown Error' }}</v-list-item-subtitle>
                                            </v-list-item-content>
                                            <v-list-item-action>
                                                <v-btn icon small color="error" @click.stop="handleOpenFile(item.path)">
                                                    <v-icon small>mdi-file-document-outline</v-icon>
                                                </v-btn>
                                            </v-list-item-action>
                                        </v-list-item>
                                    </v-list>
                                    <div v-else class="pa-4 text-center text--secondary text-caption">
                                        No items found.
                                    </div>
                                </template>

                            </v-card-text>
                        </div>
                    </v-expand-transition>
                </v-card>
            </v-col>
        </v-row>

        <v-dialog v-model="showSettings" max-width="400">
            <v-card class="sidebarNavigation">
                <v-card-title class="d-flex justify-space-between align-center pb-1">
                    Settings
                    <v-btn icon @click="showSettings = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pt-0">
                    <div class="mt-1 mb-2">
                        <div class="text-overline mb-2 primary--text font-weight-bold">Scan Controls</div>
                        <v-switch v-model="settings.scanStructures" label="Scan for structures" dense hide-details class="mt-0 pt-0 mb-4"></v-switch>
                        <v-switch v-model="settings.scanFeatures" label="Scan for features" dense hide-details class="mt-0 pt-0 mb-4"></v-switch>
                        <v-switch v-model="settings.scanUnknown" label="Scan for unknown files" dense hide-details class="mt-0 pt-0"></v-switch>
                    </div>

                    <div class="mt-1 mb-2">
                        <div class="text-overline mb-2 primary--text font-weight-bold">Developer Settings</div>
                        <v-switch v-model="settings.debugLogging" label="Enable Debug Logging" dense hide-details class="mt-0 pt-0 mb-4"></v-switch>
                    </div>
                </v-card-text>
            </v-card>
        </v-dialog>
    </v-container>
</template>

<script>
export default {
    data: () => ({
        showSettings: false,
        elements: { structures: { linked: [], unlinked: [] }, features: { linked: [], unlinked: [] }, unknown: [] },
        settings: window.settings || { scanStructures: true, scanFeatures: true, scanUnknown: true, debugLogging: false },
        expanded: { structures: true, features: true, unknown: true },
        treeItems: [],
        elementInfo: {
            structures: {name: "Structures", icon: "mdi-office-building"},
            features: {name: "Features", icon: "mdi-tree"},
            unknown: {name: "Unknown", icon: "mdi-file-cancel"}
        }
    }),

    watch: {
        settings: { handler: 'saveSettings', deep: true }
    },

    async mounted() {
        this.bridge = {
            fs: await require('@bridge/fs'),
            tab: await require('@bridge/tab'),
            path: await require('@bridge/path'),
            env: await require('@bridge/env'),
            ui: await require('@bridge/ui'),
        };
        this.bridge.projectRoot = await this.bridge.env.getCurrentProject();
        if (!window.scanAddon) await require('../scripts/scanAddon.js').catch(() => {});
        this.elements = await window.scanAddon();
    },

    methods: {
        async scan() { this.elements = await window.scanAddon(); },

        async handleOpenFile(path) {
            if (!path) return;
            try { await this.bridge.tab.openFilePath(path.slice(this.bridge.projectRoot.length + 1), true); }
            catch (error) { await window.log(`Error opening file ${path}: ${error.message}`, true); }
        },

        async createElement(type) {
            try { await this.openEditor({ identifier: (await this.bridge.env.getProjectPrefix()) + ':new_' + type.slice(0, -1) }, type); }
            catch (error) { await window.log(`Error creating element: ${error.message}`, true); }
        },

        async openEditor(item, type) {
            const info = this.elementInfo[type], editorComponent = this.bridge.ui[`${info.name.slice(0, -1)}Editor`];
            if (!editorComponent) return window.log(`Error: Editor component '${info.name.slice(0, -1)}Editor' not found.`, true);

            class ElementEditor extends this.bridge.tab.ContentTab {
                component = editorComponent;
                type = 'NA7E.addonBuilder.elementEditorV2';
                id = item.identifier;
                item = item;
                isTemporary = false;
                constructor(tabSystem) { super(tabSystem, item.identifier, true) }

                is(other) { return other && (other.id === this.id || other === this) }
                isFor(other) { return other && (other.id === this.id || other === this) }
                
                get icon() { return info.icon }
                get iconColor() { return 'primary' }
                get name() { return this.id.split(':').pop() }
            };
            await this.bridge.tab.addTab(new ElementEditor(this.bridge.tab.getCurrentTabSystem()));
        },
        
        async deleteItem(item) {
            if (!item.path) return;
            try {
                await this.bridge.fs.unlink(item.path);
                let currentDir = this.bridge.path.dirname(item.path);
                while (currentDir.startsWith(this.bridge.projectRoot) && currentDir !== this.bridge.projectRoot) {
                    const files = await this.bridge.fs.readdir(currentDir);
                    if (files.length === 0) { await this.bridge.fs.unlink(currentDir); currentDir = this.bridge.path.dirname(currentDir); }
                    else break;
                }
                await this.scan();
            } catch (error) { await window.log(`Error deleting ${item.path}: ${error.message}`, true); }
        },

        getFlattenedHierarchy(rootItem) {
            const index = window.addonIndex, hasErrors = (item) => item?.errors && Object.keys(item.errors).length > 0;
            const icons = { mcstructures: 'mdi-cube-outline', jigsaws: 'mdi-puzzle-outline', template_pools: 'mdi-format-list-bulleted-type', features: 'mdi-tree-outline' };
            
            const resolveIdentifier = (identifier, typeMap) => {
                if (!identifier || typeof identifier !== 'string') return null;
                const found = (typeMap ? index[typeMap]?.get(identifier) : null) || index.features?.get(identifier) || index.mcstructures?.get(identifier) || index.jigsaws?.get(identifier) || index.template_pools?.get(identifier);
                const resolvedItem = found?.checked || found;
                return resolvedItem ? { ...resolvedItem, name: identifier, typeMap: typeMap || (found?.checked ? 'features' : null) } : { name: identifier, errors: identifier.startsWith('minecraft:') ? {} : { UNKNOWN_ID: [identifier] } };
            };

            const flatten = (item, level = 0, pathSet = new Set(), depth = 0) => {
                if (depth > 10) return []; // Safety
                const nodes = [];
                
                // Array props to traverse
                const arrayProps = [{ prop: 'features', map: 'features' }, { prop: 'jigsaws', map: 'jigsaws' }, { prop: 'elements' }, { prop: 'pool_aliases', map: 'template_pools' }];
                arrayProps.forEach(({ prop, map }) => {
                    (item[prop] || []).forEach(identifier => {
                        const child = resolveIdentifier(identifier, map);
                        if (child && !pathSet.has(child.path || child.name)) {
                            const newSet = new Set(pathSet); if (child.path) newSet.add(child.path); else newSet.add(child.name);
                            nodes.push({ name: child.identifier || child.name, path: child.path, level, hasError: hasErrors(child), errors: child.errors, icon: icons[map] || icons[child.typeMap] });
                            nodes.push(...flatten(child, level + 1, newSet, depth + 1));
                        }
                    });
                });

                // Single props to traverse
                const singleProps = [{ prop: 'structure', map: 'mcstructures' }, { prop: 'start_pool', map: 'template_pools' }, { prop: 'fallback_pool', map: 'template_pools' }, { prop: 'feature', map: 'features' }];
                singleProps.forEach(({ prop, map }) => {
                    if (item[prop]) {
                        const child = resolveIdentifier(item[prop], map) || (prop === 'structure' ? resolveIdentifier(item[prop], 'jigsaws') : null);
                        if (child && !pathSet.has(child.path || child.name)) {
                            const newSet = new Set(pathSet); if (child.path) newSet.add(child.path); else newSet.add(child.name);
                            nodes.push({ name: child.identifier || child.name, path: child.path, level, hasError: hasErrors(child), errors: child.errors, icon: icons[map] || icons[child.typeMap] });
                            nodes.push(...flatten(child, level + 1, newSet, depth + 1));
                        }
                    }
                });
                return nodes;
            };

            // Start with the root item (Structure Set / Feature)
            const initialSet = new Set(); if (rootItem.path) initialSet.add(rootItem.path);
            return flatten(rootItem, 1, initialSet);
        },

        async saveSettings() {
            window.settings = this.settings;
            await this.bridge.fs.writeFile("./extensions/AddonBuilder/resources/settings.json", JSON.stringify(this.settings, null, 4));
        }
    }
};
</script>
<style scoped>
.min-height-32 {
    min-height: 32px !important;
}
.min-height-48 {
    min-height: 48px !important;
}
.ab-element-group .v-list-group__header {
    padding-right: 12px !important;
}
.ab-element-group .v-list-group__header__append-icon {
    margin-left: 4px !important;
}
.sidebarNavigation {
    transition: background 0.2s;
}
.sidebarSelection:hover {
    background: rgba(var(--v-primary-base), 0.05);
}
</style>