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
                <!-- Check if group is object (structures/features) or array (unknown) -->
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
                                
                                <!-- Case 1: Complex Group (Linked/Unlinked) -->
                                <template v-if="!Array.isArray(group)">
                                    <!-- Linked Items -->
                                    <v-list dense v-if="group.linked.length > 0" color="transparent">
                                        <v-list-item v-for="item in group.linked" :key="item.identifier" @click="openEditor(item, key)">
                                            <v-list-item-content>
                                                <v-list-item-title class="d-flex align-center">
                                                    {{ item.identifier.split(':').pop() }}
                                                    <v-tooltip bottom v-if="item.errors && Object.keys(item.errors).length > 0">
                                                        <template v-slot:activator="{ on, attrs }">
                                                            <v-icon small color="error" class="ml-2" v-bind="attrs" v-on="on">mdi-alert-circle</v-icon>
                                                        </template>
                                                        <div class="d-flex flex-column text-left">
                                                            <div v-for="(errs, k) in item.errors" :key="k">
                                                                <strong>{{ k }}:</strong> {{ Array.isArray(errs) ? errs.join(', ') : errs }}
                                                            </div>
                                                        </div>
                                                    </v-tooltip>
                                                </v-list-item-title>
                                                <v-list-item-subtitle class="text-caption text--secondary">{{ item.path }}</v-list-item-subtitle>
                                            </v-list-item-content>
                                            
                                            <v-list-item-action class="flex-row">
                                                <v-menu offset-y :close-on-content-click="false">
                                                    <template v-slot:activator="{ on, attrs }">
                                                        <v-btn icon small color="primary" v-bind="attrs" v-on="on" @click="openFileTree(item)">
                                                            <v-icon small>mdi-file-tree</v-icon>
                                                        </v-btn>
                                                    </template>
                                                    <v-card min-width="320" max-width="600" max-height="400" class="overflow-y-auto rounded-lg background" outlined>
                                                        <v-treeview :items="treeItems" dense open-all hover>
                                                            <template v-slot:label="{ item }">
                                                                <div class="d-flex align-center" @click.stop="item.path ? handleOpenFile(item.path) : null" :style="{ cursor: item.path ? 'pointer' : 'default' }">
                                                                    <v-tooltip bottom v-if="item.hasError">
                                                                        <template v-slot:activator="{ on, attrs }">
                                                                             <v-icon small color="error" class="mr-2" v-bind="attrs" v-on="on">mdi-alert-circle</v-icon>
                                                                        </template>
                                                                        <div class="text-left">
                                                                            <div v-for="(errs, key) in item.errors" :key="key">
                                                                                <strong>{{ key }}:</strong> {{ Array.isArray(errs) ? errs.join(', ') : errs }}
                                                                            </div>
                                                                        </div>
                                                                    </v-tooltip>
                                                                    <span :class="{'error--text': item.hasError, 'text--primary': item.path}" style="transition: color 0.1s">{{ item.name }}</span>
                                                                </div>
                                                            </template>
                                                            <template v-slot:append="{ item }">
                                                                <v-btn icon small v-if="item.path" color="tertiary" @click.stop="handleOpenFile(item.path)">
                                                                    <v-icon small>mdi-open-in-new</v-icon>
                                                                </v-btn>
                                                            </template>
                                                        </v-treeview>
                                                    </v-card>
                                                </v-menu>
                                                <v-btn icon small color="error" @click.stop="deleteItem(item)">
                                                    <v-icon small>mdi-trash-can</v-icon>
                                                </v-btn>
                                            </v-list-item-action>
                                        </v-list-item>
                                    </v-list>

                                    <!-- Unlinked Items Divider & List -->
                                    <div v-if="group.unlinked.length > 0">
                                        <v-divider v-if="group.linked.length > 0"></v-divider>
                                        <v-subheader class="text-caption font-weight-bold text-uppercase mt-2 primary--text" style="height: 32px;">Unlinked</v-subheader>
                                        <v-list dense color="transparent">
                                            <v-list-item v-for="item in group.unlinked" :key="item.identifier" @click="openEditor(item, key)">
                                                <v-list-item-content>
                                                    <v-list-item-title class="d-flex align-center">
                                                        {{ item.identifier.split(':').pop() }}
                                                        <v-tooltip bottom v-if="item.errors && Object.keys(item.errors).length > 0">
                                                            <template v-slot:activator="{ on, attrs }">
                                                                <v-icon small color="error" class="ml-2" v-bind="attrs" v-on="on">mdi-alert-circle</v-icon>
                                                            </template>
                                                            <div class="d-flex flex-column text-left">
                                                                <div v-for="(errs, k) in item.errors" :key="k">
                                                                    <strong>{{ k }}:</strong> {{ Array.isArray(errs) ? errs.join(', ') : errs }}
                                                                </div>
                                                            </div>
                                                        </v-tooltip>
                                                    </v-list-item-title>
                                                    <v-list-item-subtitle class="text-caption text--secondary">
                                                        <span class="font-weight-medium primary--text mr-1" v-if="item.type">{{ item.type.replace('minecraft:', '') }}</span>
                                                        {{ item.path }} 
                                                    </v-list-item-subtitle>
                                                </v-list-item-content>
                                                
                                                 <v-list-item-action class="flex-row">
                                                    <v-menu offset-y :close-on-content-click="false">
                                                        <template v-slot:activator="{ on, attrs }">
                                                            <v-btn icon small color="primary" v-bind="attrs" v-on="on" @click="openFileTree(item)">
                                                                <v-icon small>mdi-file-tree</v-icon>
                                                            </v-btn>
                                                        </template>
                                                        <v-card min-width="320" max-width="600" max-height="400" class="overflow-y-auto rounded-lg background" outlined>
                                                            <v-treeview :items="treeItems" dense open-all hover>
                                                                <template v-slot:label="{ item }">
                                                                    <div class="d-flex align-center" @click.stop="item.path ? handleOpenFile(item.path) : null" :style="{ cursor: item.path ? 'pointer' : 'default' }">
                                                                        <v-tooltip bottom v-if="item.hasError">
                                                                            <template v-slot:activator="{ on, attrs }">
                                                                                 <v-icon small color="error" class="mr-2" v-bind="attrs" v-on="on">mdi-alert-circle</v-icon>
                                                                            </template>
                                                                            <div class="text-left">
                                                                                <div v-for="(errs, key) in item.errors" :key="key">
                                                                                    <strong>{{ key }}:</strong> {{ Array.isArray(errs) ? errs.join(', ') : errs }}
                                                                                </div>
                                                                            </div>
                                                                        </v-tooltip>
                                                                        <span :class="{'error--text': item.hasError, 'text--primary': item.path}" style="transition: color 0.1s">{{ item.name }}</span>
                                                                    </div>
                                                                </template>
                                                                <template v-slot:append="{ item }">
                                                                    <v-btn icon small v-if="item.path" color="tertiary" @click.stop="handleOpenFile(item.path)">
                                                                        <v-icon small>mdi-open-in-new</v-icon>
                                                                    </v-btn>
                                                                </template>
                                                            </v-treeview>
                                                        </v-card>
                                                    </v-menu>
                                                    <v-btn icon small color="error" @click.stop="deleteItem(item)">
                                                        <v-icon small>mdi-trash-can</v-icon>
                                                    </v-btn>
                                                </v-list-item-action>
                                            </v-list-item>
                                        </v-list>
                                    </div>

                                    <!-- Empty State -->
                                    <div v-if="group.linked.length === 0 && group.unlinked.length === 0" class="pa-4 text-center text--secondary text-caption">
                                        No items found.
                                    </div>
                                </template>

                                <!-- Case 2: Simple Array (Unknown) -->
                                <template v-else>
                                    <v-list dense v-if="group.length > 0" color="transparent">
                                        <v-list-item v-for="item in group" :key="item.path" @click="handleOpenFile(item.path)">
                                            <v-list-item-content>
                                                <v-list-item-title class="error--text font-weight-medium">{{ item.path.split(/[\\/]/).pop() }}</v-list-item-title>
                                                <v-list-item-subtitle class="text-caption grey--text text--lighten-1">{{ item.errors ? Object.keys(item.errors).join(', ') : 'Unknown Error' }}</v-list-item-subtitle>
                                            </v-list-item-content>
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
export default  {
    data: () => ({
        showSettings: false,
        settings: window.settings || {
            scanStructures: true,
            scanFeatures: true,
            scanUnknown: true,
            debugLogging: false
        },
        expanded: {
            structures: true,
            features: true,
            unknown: true
        },
        treeItems: [],
        elements: {
            structures: { linked: [], unlinked: [] },
            features: { linked: [], unlinked: [] },
            unknown: []
        },
        elementInfo: {
            structures: {name: "Structures", icon: "mdi-office-building"},
            features: {name: "Features", icon: "mdi-tree"},
            unknown: {name: "Unknown", icon: "mdi-file-cancel"}
        },
    }),

    watch: {
        settings: {
            handler: 'saveSettings',
            deep: true
        }
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

        await window.log("Sidebar mounted.");

        this.elements = await window.scanAddon();
    },

    methods: {
        async scan() {
            this.elements = await window.scanAddon();
        },

        async handleOpenFile(path) {
            if (!path) return;
            try {
                await this.bridge.tab.openFilePath(path.slice(this.bridge.projectRoot.length + 1), true);
            } catch (err) {
                await window.log(`Error opening file ${path}: ${err.message}`, true);
            }
        },

        async createElement(type) {
            try {
                await this.openEditor({ identifier: (await this.bridge.env.getProjectPrefix()) + ':new_' + type.slice(0, -1) }, type);
            } catch (err) {
                await window.log(`Error creating element: ${err.message}`, true);
            }
        },

        async openEditor(item, type) {
            const info = this.elementInfo[type];

            const editorComponent = this.bridge.ui[`${info.name.slice(0, -1)}Editor`];
            if (!editorComponent) {
                await window.log(`Error: Editor component '${info.name.slice(0, -1)}Editor' not found.`, true);
                return;
            }


            class ElementEditor extends this.bridge.tab.ContentTab {
                id = item.identifier;
                type = 'NA7E.addonBuilder.elementEditor';
                component = editorComponent;
                props = { item };
                isTemporary = false;

                async is(other) { return other.id === this.id; }
                async isFor(other) { return other.id === this.id; }

                get icon() { return info.icon; }
                get iconColor() { return 'primary'; }
                get name() { return this.id.split(':').pop(); }
            };

            await window.log(`Opening ${type.slice(0, -1)} editor for: ${item.identifier}`);
            await this.bridge.tab.addTab(new ElementEditor(this.bridge.tab.getCurrentTabSystem()));
        },
        
        async deleteItem(item) {
            if (!item.path) return;
            
            try {
                await this.bridge.fs.unlink(item.path);
                await window.log(`Deleted file: ${item.path}`);

                let dir = this.bridge.path.dirname(item.path);
                while (dir.startsWith(this.bridge.projectRoot) && dir !== this.bridge.projectRoot) {
                    const files = await this.bridge.fs.readdir(dir);
                    if (files.length === 0) {
                        await this.bridge.fs.unlink(dir);
                        await window.log(`Deleted empty dir: ${dir}`);
                        dir = this.bridge.path.dirname(dir);
                    } else {
                        break;
                    }
                }
                await this.scan();
            } catch (err) {
                await window.log(`Error deleting ${item.path}: ${err.message}`, true);
            }
        },

        async openFileTree(rootItem) {
            const buildTree = (item, idPrefix) => {
                const node = {
                    id: idPrefix,
                    name: item.identifier || 'Unknown',
                    path: item.path,
                    children: [],
                    hasError: item.errors && Object.keys(item.errors).length > 0,
                    errors: item.errors
                };

                const childTypes = [
                    { prop: 'features', prefix: 'f' },
                    { prop: 'jigsaws', prefix: 'j' },
                    { prop: 'elements', prefix: 'e' },
                    { prop: 'pool_aliases', prefix: 'pa' }
                ];

                childTypes.forEach(({ prop, prefix }) => {
                    if (item[prop] && item[prop].length) {
                        item[prop].forEach((child, idx) => node.children.push(buildTree(child, `${idPrefix}-${prefix}${idx}`)));
                    }
                });

                if (item.structure) {
                    node.children.push({
                        id: `${idPrefix}-s`,
                        name: item.structure.identifier || item.structure.path?.split(/[\\/]/).pop() || 'Structure',
                        path: item.structure.path,
                        children: [],
                        hasError: false
                    });
                }

                if (item.start_pool) {
                    node.children.push(buildTree(item.start_pool, `${idPrefix}-sp`));
                }

                return node;
            };

            this.treeItems = [buildTree(rootItem, 'root')];
        },

        async saveSettings() {
            window.settings = this.settings;
            await this.bridge.fs.writeFile("./extensions/AddonBuilder/resources/settings.json", JSON.stringify(this.settings, null, 4));
        }
    }
};
</script>