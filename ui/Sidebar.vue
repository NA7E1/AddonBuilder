<template>
    <v-container>
        <header class="d-flex align-center justify-space-between mb-4">
            <div>
                <h1 class="text-h6 mb-1">Addon Builder</h1>
                <p class="text-body-2 mb-0">Create and manage your addon elements.</p>
            </div>
            <v-btn icon color="tertiary" @click="showSettings = true">
                <v-icon>mdi-cog</v-icon>
            </v-btn>
        </header>

        <v-btn block color="primary" class="mb-4" @click="scan()">Scan Project</v-btn>

        <v-row>
            <v-col v-for="(items, key) in elements" :key="key" cols="12">
                <v-card outlined>
                    <v-card-title class="d-flex align-center pa-3" @click="expanded[key] = !expanded[key]" style="cursor: pointer">
                        <v-icon class="mr-3">{{ elementInfo[key].icon }}</v-icon>
                        <span class="text-body-1 font-weight-semibold">{{ elementInfo[key].name }}</span>
                        <v-spacer></v-spacer>
                        <v-btn icon @click.stop="expanded[key] = !expanded[key]">
                            <v-icon>{{ expanded[key] ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                        </v-btn>
                    </v-card-title>

                    <v-expand-transition>
                        <div v-show="expanded[key]">
                            <v-divider></v-divider>
                            <v-card-text class="pa-0">
                                <v-list dense v-if="items.length > 0">
                                    <v-list-item v-for="item in items" :key="item.identifier">
                                        <v-list-item-content>
                                            <v-list-item-title class="d-flex align-center">
                                                {{ item.identifier.split(':').pop() }}
                                                <v-tooltip bottom v-if="item.errors && Object.keys(item.errors).length > 0">
                                                    <template v-slot:activator="{ on, attrs }">
                                                        <v-icon small color="error" class="ml-2" v-bind="attrs" v-on="on">mdi-alert-circle</v-icon>
                                                    </template>
                                                    <span>{{ Object.keys(item.errors).join(', ') }}</span>
                                                </v-tooltip>
                                            </v-list-item-title>
                                            <v-list-item-subtitle class="text-caption text--secondary">{{ item.filepath }}</v-list-item-subtitle>
                                        </v-list-item-content>
                                        
                                        <v-list-item-action class="flex-row">
                                            <v-menu offset-y :close-on-content-click="false">
                                                <template v-slot:activator="{ on, attrs }">
                                                    <v-btn icon small color="tertiary" v-bind="attrs" v-on="on" @click="openFileTree(item)">
                                                        <v-icon small>mdi-file-tree</v-icon>
                                                    </v-btn>
                                                </template>
                                                <v-card min-width="300" max-width="500" max-height="400" class="overflow-y-auto">
                                                    <v-treeview :items="treeItems" dense open-all hover>
                                                        <template v-slot:label="{ item }">
                                                            <div class="d-flex align-center justify-space-between w-100" @click="item.file ? openFile(item.file) : null" style="cursor: pointer">
                                                                <span :class="{'error--text': item.hasError}">{{ item.name }}</span>
                                                                <v-icon small v-if="item.file" class="ml-2" color="tertiary">mdi-open-in-new</v-icon>
                                                            </div>
                                                        </template>
                                                        <template v-slot:append="{ item }">
                                                            <v-icon v-if="item.hasError" small color="error">mdi-alert-circle</v-icon>
                                                        </template>
                                                    </v-treeview>
                                                </v-card>
                                            </v-menu>
                                            <v-btn icon small color="error">
                                                <v-icon small>mdi-trash-can</v-icon>
                                            </v-btn>
                                        </v-list-item-action>
                                    </v-list-item>
                                </v-list>
                                <div v-else class="pa-4 text-center text--secondary text-caption">
                                    No items found.
                                </div>
                            </v-card-text>
                        </div>
                    </v-expand-transition>
                </v-card>
            </v-col>
        </v-row>

        <v-dialog v-model="showSettings" max-width="400">
            <v-card>
                <v-card-title class="d-flex justify-space-between align-center">
                    Settings
                    <v-btn icon @click="showSettings = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text>
                    <p>Settings placeholder</p>
                </v-card-text>
            </v-card>
        </v-dialog>

    </v-container>
</template>

<script>
export default  {
    data: () => ({
        showSettings: false,
        expanded: {
            structures: true,
            features: true,
            structure_pools: true, // Default open
            unlinked: true,
            unknown: true
        },
        treeItems: [],
        elements: {
            structures: [],
            features: [],
            structure_pools: [], // Added
            unlinked: [],
            unknown: []
        },
        elementInfo: {
            structures: {name: "Structures", icon: "mdi-office-building"},
            features: {name: "Features", icon: "mdi-tree"},
            structure_pools: {name: "Structure Pools", icon: "mdi-folder-table"}, // Added
            unlinked: {name: "Unlinked", icon: "mdi-link-variant-off"},
            unknown: {name: "Unknown", icon: "mdi-file-cancel"}
        }
    }),

    async mounted() {
        await window.appendLog("Sidebar mounted");
        this.elements = await window.scanAddon();
    },

    methods: {
        async scan() {
            this.elements = await window.scanAddon();
        },
        async openFile(path) {
            if (!path) return;
            try {
                const { openFile } = await require('@bridge/tab');
                await openFile(path);
            } catch (err) {
                console.error(err);
                await window.appendLog(`Error opening file: ${err.message}`);
            }
        },
        openFileTree(rootItem) {
            const buildTree = (item, idPrefix) => {
                const node = {
                    id: idPrefix,
                    name: item.identifier || 'Unknown',
                    file: item.filepath,
                    children: [],
                    hasError: item.errors && Object.keys(item.errors).length > 0
                };

                // Add sub-features
                if (item.features && item.features.length) {
                    item.features.forEach((child, idx) => {
                        node.children.push(buildTree(child, `${idPrefix}-f${idx}`));
                    });
                }
                // Add structure parts
                if (item.structure) {
                    // Structure is usually a leaf in this context, but we can list it
                     node.children.push({
                        id: `${idPrefix}-s`,
                        name: item.structure.path ? item.structure.path.split(/[\\/]/).pop() : 'Structure',
                        file: item.structure.path,
                        children: [],
                        hasError: false
                    });
                }
                 // Add pool elements
                if (item.elements && item.elements.length) {
                    item.elements.forEach((child, idx) => {
                         node.children.push(buildTree(child, `${idPrefix}-e${idx}`));
                    });
                }
                 // Add jigsaw aliases/pools
                if (item.pool_aliases && item.pool_aliases.length) {
                    item.pool_aliases.forEach((child, idx) => {
                        node.children.push(buildTree(child, `${idPrefix}-pa${idx}`));
                    });
                }
                if (item.start_pool) {
                      node.children.push(buildTree(item.start_pool, `${idPrefix}-sp`));
                }
                // Generic sub-feature recursion if needed (e.g. child features not in .features array)
                // But scanAddon usually normalizes them into .features or specific props.

                return node;
            };

            this.treeItems = [buildTree(rootItem, 'root')];
        }
    }
};
</script>