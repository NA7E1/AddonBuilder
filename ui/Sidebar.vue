<template>
    <v-container>
        <div class="d-flex align-center justify-space-between mb-4">
            <div style="min-width: 0; flex: 1;">
                <h1 class="text-h6 mb-1 text-truncate">Addon Builder</h1>
                <p class="text-body-2 grey--text mb-0 text-truncate">Create and manage your addon elements.</p>
            </div>
            <v-btn icon color="tertiary" @click="showSettings = true">
                <v-icon>mdi-cog</v-icon>
            </v-btn>
        </div>

        <v-btn block color="primary" class="mb-4 rounded-lg" depressed large @click="scan()">
            <v-icon left>mdi-magnify</v-icon>
            Scan Project
        </v-btn>

        <v-card v-for="(group, key) in elements" :key="key" outlined class="rounded-lg overflow-hidden mb-3">
            <div class="d-flex align-center py-2 px-3 select-none sidebarNavigation" @click="expanded[key] = !expanded[key]" :style="{cursor: 'pointer', userSelect: 'none'}">
                <v-icon class="mr-3" color="primary">{{ elementInfo[key].icon }}</v-icon>
                <div class="d-flex flex-column" style="min-width: 0; flex: 1;">
                    <span class="text-subtitle-1 font-weight-bold text-truncate">{{ elementInfo[key].name }}</span>
                    <span class="text-caption grey--text">{{ Array.isArray(group) ? group.length : (group.linked.length + group.unlinked.length) }} items</span>
                </div>
                
                <v-btn v-if="key !== 'unknown'" small color="primary" class="mr-2" @click.stop="createElement(key)">
                    <v-icon left small>mdi-plus</v-icon>New
                </v-btn>
                <v-icon color="grey">{{ expanded[key] ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </div>

            <v-expand-transition>
                <div v-show="expanded[key]" class="sidebarSelection">
                    <v-divider></v-divider>
                    
                    <template v-if="!Array.isArray(group)">
                        <v-list v-if="group.linked.length || group.unlinked.length" dense color="transparent" class="pa-0">
                            <v-list-group v-for="item in [...group.linked, ...group.unlinked]" :key="item.identifier" no-action append-icon="mdi-chevron-down" :style="{'--list-group-pr': '12px', '--list-group-ml': '4px'}">
                                <template v-slot:activator>
                                    <v-list-item-content @click.stop="openEditor(item, key)" :style="{cursor: 'pointer', minWidth: 0}">
                                        <v-list-item-title class="text-truncate" :class="group.linked.includes(item) ? 'primary--text font-weight-bold' : 'grey--text'">{{ item.identifier.split(':').pop() }}</v-list-item-title>
                                        <v-list-item-subtitle class="text-caption text--secondary font-italic text-truncate">{{ item.path ? item.path.split(/[\\/]/).pop() : 'No File' }}</v-list-item-subtitle>
                                    </v-list-item-content>
                                    
                                    <v-list-item-action class="flex-row align-center mr-n4" :style="{flexShrink: 0, gap: '2px'}">
                                        <span v-if="!group.linked.includes(item)" class="text-overline grey--text" :style="{fontSize: '8px !important', flexShrink: 0, alignSelf: 'center'}">Unlinked</span>
                                        <v-tooltip bottom v-if="item.errors && Object.keys(item.errors).length > 0">
                                            <template v-slot:activator="{ on, attrs }">
                                                <v-icon small color="error" v-bind="attrs" v-on="on" :style="{flexShrink: 0, alignSelf: 'center'}">mdi-alert-circle</v-icon>
                                            </template>
                                            <div class="d-flex flex-column text-left">
                                                <div v-for="(errors, type) in item.errors" :key="type">
                                                    <strong>{{ type }}:</strong> {{ Array.isArray(errors) ? errors.join(', ') : errors }}
                                                </div>
                                            </div>
                                        </v-tooltip>
                                        <v-btn v-if="item.path" icon small color="primary" @click.stop="handleOpenFile(item.path)" title="Open in Default Editor">
                                            <v-icon small>mdi-file-document-outline</v-icon>
                                        </v-btn>
                                        <v-btn icon small color="error" @click.stop="deleteItem(item)" title="Delete Element">
                                            <v-icon small>mdi-trash-can</v-icon>
                                        </v-btn>
                                    </v-list-item-action>
                                </template>

                                <v-list-item v-for="(child, idx) in getFileTree(item)" :key="child.id || idx" :style="{paddingLeft: (child.level * 16 + 12) + 'px', minHeight: '32px'}">
                                    <v-list-item-content class="py-1" style="min-width: 0;">
                                        <v-list-item-title class="text-caption d-flex align-center" style="min-width: 0;">
                                            <v-icon small class="mr-1" :color="child.hasError ? 'error' : 'grey'" :style="{flexShrink: 0}">{{ child.icon || 'mdi-file-outline' }}</v-icon>
                                            <span :class="{'error--text': child.hasError, 'grey--text text--lighten-1': !child.path}" class="text-truncate" :style="{flex: 1, minWidth: 0}">{{ child.name }}</span>
                                            <v-tooltip bottom v-if="child.hasError">
                                                <template v-slot:activator="{ on, attrs }">
                                                    <v-icon x-small color="error" class="ml-1" v-bind="attrs" v-on="on" :style="{flexShrink: 0}">mdi-alert-circle</v-icon>
                                                </template>
                                                <div class="text-left text-caption">
                                                    <div v-for="(errors, type) in child.errors" :key="type">
                                                        <strong>{{ type }}:</strong> {{ Array.isArray(errors) ? errors.join(', ') : errors }}
                                                    </div>
                                                </div>
                                            </v-tooltip>
                                        </v-list-item-title>
                                    </v-list-item-content>
                                    <v-list-item-action class="my-0" v-if="child.path" :style="{flexShrink: 0}">
                                        <v-btn icon x-small color="tertiary" @click.stop="handleOpenFile(child.path)">
                                            <v-icon x-small>mdi-file-document-outline</v-icon>
                                        </v-btn>
                                    </v-list-item-action>
                                </v-list-item>
                            </v-list-group>
                        </v-list>
                        <div v-else class="pa-4 text-center text--secondary text-caption">
                            No items found.
                        </div>
                    </template>

                    <template v-else>
                        <v-list v-if="group.length" dense color="transparent" class="pa-0">
                            <v-list-item v-for="item in group" :key="item.path" :style="{minHeight: '48px'}" class="px-3">
                                <v-list-item-content @click="handleOpenFile(item.path)" :style="{cursor: 'pointer', minWidth: 0}">
                                    <v-list-item-title class="error--text font-weight-medium text-caption text-truncate">{{ item.path.split(/[\\/]/).pop() }}</v-list-item-title>
                                    <v-list-item-subtitle class="text-caption grey--text text-truncate">{{ item.errors ? Object.keys(item.errors).join(', ') : 'Unknown Error' }}</v-list-item-subtitle>
                                </v-list-item-content>
                                <v-list-item-action :style="{flexShrink: 0}">
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
                </div>
            </v-expand-transition>
        </v-card>

        <v-dialog v-model="showSettings" max-width="400">
            <v-card class="sidebarNavigation">
                <v-card-title class="d-flex justify-space-between align-center pb-1">
                    Settings
                    <v-btn icon @click="showSettings = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pt-0">
                    <div class="text-overline mb-2 primary--text font-weight-bold">Scan Controls</div>
                    <v-switch v-model="settings.scanStructures" label="Scan for structures" dense hide-details class="mt-0 pt-0 mb-4"></v-switch>
                    <v-switch v-model="settings.scanFeatures" label="Scan for features" dense hide-details class="mt-0 pt-0 mb-4"></v-switch>
                    <v-switch v-model="settings.scanUnknown" label="Scan for unknown files" dense hide-details class="mt-0 pt-0 mb-4"></v-switch>

                    <div class="text-overline mb-2 primary--text font-weight-bold">Developer Settings</div>
                    <v-switch v-model="settings.debugLogging" label="Enable Debug Logging" dense hide-details class="mt-0 pt-0"></v-switch>
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

        getFileTree(item) {
            const index = window.addonIndex;
            const icons = { mcstructures: 'mdi-cube-outline', jigsaws: 'mdi-puzzle-outline', template_pools: 'mdi-format-list-bulleted-type', features: 'mdi-tree-outline' };
            
            const resolve = (id, type) => {
                if (!id || typeof id !== 'string') return null;
                const found = (type ? index[type]?.get(id) : null) || index.features?.get(id) || index.mcstructures?.get(id) || index.jigsaws?.get(id) || index.template_pools?.get(id);
                const resolved = found?.checked || found;
                return resolved ? { ...resolved, name: id, typeMap: type || (found?.checked ? 'features' : null) } : { name: id, errors: id.startsWith('minecraft:') ? {} : { UNKNOWN_ID: [id] } };
            };

            const traverse = (item, level = 0, visited = new Set(), depth = 0) => {
                if (depth > 10) return [];
                const nodes = [], hasError = item?.errors && Object.keys(item.errors).length > 0;
                
                const addChild = (id, type) => {
                    const child = resolve(id, type);
                    const key = child?.path || child?.name;
                    if (child && !visited.has(key)) {
                        visited.add(key);
                        nodes.push({ name: child.identifier || child.name, path: child.path, level, hasError: child.errors && Object.keys(child.errors).length > 0, errors: child.errors, icon: icons[type] || icons[child.typeMap] });
                        nodes.push(...traverse(child, level + 1, visited, depth + 1));
                    }
                };
                
                ['features', 'jigsaws', 'elements', 'pool_aliases'].forEach(prop => {
                    const typeMap = { features: 'features', jigsaws: 'jigsaws', pool_aliases: 'template_pools' }[prop];
                    (item[prop] || []).forEach(id => addChild(id, typeMap));
                });
                
                if (item.structure) addChild(item.structure, 'mcstructures') || addChild(item.structure, 'jigsaws');
                if (item.start_pool) addChild(item.start_pool, 'template_pools');
                if (item.fallback_pool) addChild(item.fallback_pool, 'template_pools');
                if (item.feature) addChild(item.feature, 'features');
                
                return nodes;
            };

            const visited = new Set();
            if (item.path) visited.add(item.path);
            return traverse(item, 1, visited);
        },

        async saveSettings() {
            window.settings = this.settings;
            await this.bridge.fs.writeFile("./extensions/AddonBuilder/resources/settings.json", JSON.stringify(this.settings, null, 4));
        }
    }
};
</script>