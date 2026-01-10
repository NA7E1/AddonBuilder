<template>
    <v-container>
        <div class="d-flex align-center justify-space-between mb-2">
            <h1 class="text-subtitle-1 font-weight-bold text-truncate flex-grow-1">Addon Builder</h1>
            <v-btn icon small @click="showSettings = true">
                <v-icon small>mdi-cog</v-icon>
            </v-btn>
        </div>

        <v-btn block color="primary" class="rounded-lg mb-3" depressed @click="scan()" :disabled="scanning" :loading="scanning">
            <v-icon left small>mdi-magnify</v-icon>
            {{ scanning ? 'Scanning...' : 'Scan Project' }}
        </v-btn>
        
        <v-expand-transition>
            <v-card v-show="scanning" outlined class="mb-3 rounded-lg pa-3">
                <div class="text-caption grey--text mb-2">{{ scanProgress.message }}</div>
                <v-progress-linear :value="scanProgress.percent" color="primary" rounded height="6"></v-progress-linear>
                <div class="text-caption grey--text text-right mt-1">{{ scanProgress.percent }}%</div>
            </v-card>
        </v-expand-transition>

        <v-tabs v-model="activeTab" grow class="mb-3 rounded-lg" background-color="sidebarNavigation" slider-size="2" height="36">
            <v-tab class="text-caption">
                <v-icon small left>mdi-package-variant</v-icon>
                Addon
            </v-tab>
            <v-tab class="text-caption">
                <v-icon small left>mdi-file-tree</v-icon>
                Elements
            </v-tab>
            <v-tab class="text-caption">
                <v-icon small left>mdi-folder-multiple</v-icon>
                Resources
            </v-tab>
        </v-tabs>

        <v-tabs-items v-model="activeTab">
            <!-- Addon Tab -->
            <v-tab-item class="sidebarNavigation">
                <v-card outlined class="rounded-lg mb-3">
                    <v-card-title class="text-subtitle-2 py-2 sidebarNavigation">Behavior Pack Information</v-card-title>
                    <v-divider></v-divider>
                    <v-card-text v-if="manifest" class="background">
                        <div class="mb-2">
                            <div class="text-caption grey--text">Name</div>
                            <v-text-field v-model="manifest.header.name" dense hide-details outlined class="text-body-2 mt-1"></v-text-field>
                        </div>
                        <div class="mb-2">
                            <div class="text-caption grey--text">Description</div>
                            <v-textarea v-model="manifest.header.description" dense auto-grow hide-details outlined class="text-body-2 mt-1"></v-textarea>
                        </div>
                        <div class="mb-2">
                            <div class="text-caption grey--text">Version</div>
                            <v-text-field v-model="manifestVersion" dense hide-details outlined class="text-body-2 mt-1"></v-text-field>
                        </div>
                        <div class="mb-2">
                            <div class="text-caption grey--text">UUID</div>
                            <div class="d-flex align-center mt-1">
                                <v-text-field v-model="manifest.header.uuid" dense hide-details outlined class="text-caption font-mono" readonly disabled></v-text-field>
                                <v-btn icon small class="ml-2" @click="regenerateUUID" title="Regenerate UUID">
                                    <v-icon small>mdi-refresh</v-icon>
                                </v-btn>
                            </div>
                        </div>
                        <div v-if="manifest.header?.min_engine_version">
                            <div class="text-caption grey--text">Min Engine Version</div>
                            <v-text-field v-model="manifestMinEngineVersion" dense hide-details outlined class="text-body-2 mt-1"></v-text-field>
                        </div>
                    </v-card-text>
                    <v-card-text v-else class="text-caption grey--text text-center background">
                        No manifest found
                    </v-card-text>
                </v-card>

                <!-- Subpacks Editor -->
                <v-card v-if="manifest" outlined class="rounded-lg mb-3">
                    <v-card-title class="text-subtitle-2 py-2 d-flex align-center justify-space-between">
                        Subpacks
                        <v-btn icon x-small @click="addSubpack">
                            <v-icon small>mdi-plus</v-icon>
                        </v-btn>
                    </v-card-title>
                    <v-divider></v-divider>
                    <v-card-text class="background pa-2">
                        <v-expansion-panels v-if="manifest.subpacks.length" flat>
                            <v-expansion-panel v-for="(sp, i) in manifest.subpacks" :key="i" class="mb-2">
                                <v-expansion-panel-header class="px-3 py-2">
                                    <div class="d-flex align-center flex-grow-1">
                                        <v-btn icon x-small @click.stop="moveSubpack(i, -1)" :disabled="i === 0" class="mr-1">
                                            <v-icon x-small>mdi-chevron-up</v-icon>
                                        </v-btn>
                                        <v-btn icon x-small @click.stop="moveSubpack(i, 1)" :disabled="i === manifest.subpacks.length - 1" class="mr-2">
                                            <v-icon x-small>mdi-chevron-down</v-icon>
                                        </v-btn>
                                        <v-icon small class="mr-2" color="primary">mdi-folder</v-icon>
                                        <div class="flex-grow-1">
                                            <div class="text-body-2 font-weight-medium">{{ sp.name || sp.folder_name }}</div>
                                            <div class="text-caption grey--text">{{ sp.folder_name }}</div>
                                        </div>
                                        <v-chip x-small outlined class="mr-2">T{{ i }}</v-chip>
                                    </div>
                                    <template v-slot:actions>
                                        <div class="d-flex align-center">
                                            <v-btn icon x-small @click.stop="removeSubpack(i)" class="mr-1">
                                                <v-icon small color="error">mdi-delete</v-icon>
                                            </v-btn>
                                            <v-icon small>mdi-chevron-down</v-icon>
                                        </div>
                                    </template>
                                </v-expansion-panel-header>
                                <v-expansion-panel-content>
                                    <v-text-field v-model="sp.folder_name" label="Folder Name" dense outlined hide-details class="mb-2"></v-text-field>
                                    <v-text-field v-model="sp.name" label="Display Name" dense outlined hide-details></v-text-field>
                                </v-expansion-panel-content>
                            </v-expansion-panel>
                        </v-expansion-panels>
                        <div v-else class="text-caption grey--text text-center pa-4">No subpacks defined</div>
                    </v-card-text>
                    <v-divider></v-divider>
                </v-card>
                <v-btn block color="primary" @click="saveManifest">Save Manifest</v-btn>
            </v-tab-item>

            <!-- Elements Tab -->
            <v-tab-item class="sidebarNavigation">
                <v-card v-for="(group, key) in elements" :key="key" outlined class="rounded-lg overflow-hidden mb-3">
                    <div class="d-flex align-center py-1 px-3 select-none cursor-pointer sidebarNavigation" @click="expanded[key] = !expanded[key]">
                        <v-icon class="mr-3" color="primary">{{ elementInfo[key].icon }}</v-icon>
                        <div class="d-flex flex-column flex-grow-1 text-truncate">
                            <span class="text-subtitle-1 font-weight-bold text-truncate">{{ elementInfo[key].name }}</span>
                            <span class="text-caption grey--text text-truncate">{{ getGroupItemCount(group) }} items</span>
                        </div>
                
                        <v-btn v-if="key !== 'unknown'" small color="primary" class="mr-2" @click.stop="createElement(key)">
                            <v-icon left small>mdi-plus</v-icon>New
                        </v-btn>
                        <v-icon color="grey">{{ expanded[key] ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                    </div>
                    <v-divider></v-divider>
                    <v-expand-transition>
                        <div v-show="expanded[key]" class="background">  
                            <template v-if="!Array.isArray(group)">
                                <v-list v-if="getGroupItemCount(group)" dense color="transparent" class="pa-0">
                                    <template v-for="item in getAllItems(group)" :key="item.identifier">
                                        <v-list-group v-if="getFileTree(item).length > 0" no-action append-icon="mdi-chevron-down">
                                            <template v-slot:activator>
                                                <v-list-item-content @click.stop="openEditor(item, key)" @contextmenu.prevent="showContextMenu($event, item, key)" class="cursor-pointer">
                                                    <v-list-item-title class="d-flex align-center text-truncate" :class="isLinked(group, item) ? 'primary--text font-weight-bold' : 'grey--text'">
                                                        <v-tooltip bottom v-if="hasErrors(item)">
                                                            <template v-slot:activator="{ on, attrs }">
                                                                <v-icon small color="error" v-bind="attrs" v-on="on" class="mr-1 flex-shrink-0">mdi-alert-circle</v-icon>
                                                            </template>
                                                            <div class="d-flex flex-column text-left">
                                                                <div v-for="(errors, type) in item.errors" :key="type">
                                                                    <strong>{{ type }}:</strong> {{ Array.isArray(errors) ? errors.join(', ') : errors }}
                                                                </div>
                                                            </div>
                                                        </v-tooltip>
                                                        <span class="text-truncate flex-shrink-1">{{ getShortId(item.identifier) }}</span>
                                                        <v-icon v-if="!isLinked(group, item)" x-small color="grey" class="ml-1 flex-shrink-0">mdi-link-off</v-icon>
                                                    </v-list-item-title>
                                                    <v-list-item-subtitle class="text-caption text--secondary font-italic text-truncate">{{ getFileName(item.path) || 'No File' }}</v-list-item-subtitle>
                                                </v-list-item-content>
                                                
                                                <v-list-item-action class="d-flex flex-row align-center mr-n8 item-actions action-gap">
                                                    <v-btn v-if="item.path" icon small color="primary" @click.stop="handleOpenFile(item.path)" title="Open in Default Editor" class="hover-visible">
                                                        <v-icon small>mdi-file-document-outline</v-icon>
                                                    </v-btn>
                                                    <v-btn icon small color="error" @click.stop="deleteItem(item)" title="Delete Element" class="hover-visible">
                                                        <v-icon small>mdi-trash-can-outline</v-icon>
                                                    </v-btn>
                                                </v-list-item-action>
                                            </template>

                                            <v-list-item 
                                                v-for="(child, idx) in getFileTree(item)" :key="child.id || idx" :style="{ paddingLeft: (child.level * 16 + 8) + 'px' }" @click="child.path && handleOpenFile(child.path)" :class="{ 'cursor-pointer': child.path }" class="tree-item">
                                                <v-list-item-content class="text-truncate">
                                                    <v-list-item-title class="text-caption d-flex align-center">
                                                        <v-tooltip bottom v-if="child.hasError">
                                                            <template v-slot:activator="{ on, attrs }">
                                                                <v-icon small color="error" class="mr-1" v-bind="attrs" v-on="on">mdi-alert-circle</v-icon>
                                                            </template>
                                                            <div class="text-left text-caption">
                                                                <div v-for="(errors, type) in child.errors" :key="type">
                                                                    <strong>{{ type }}:</strong> {{ Array.isArray(errors) ? errors.join(', ') : errors }}
                                                                </div>
                                                            </div>
                                                        </v-tooltip>
                                                        <v-icon v-else small color="grey" class="mr-1">{{ child.icon || 'mdi-file-outline' }}</v-icon>
                                                        <span :class="{'grey--text text--lighten-1': !child.path}" class="text-truncate flex-grow-1">{{ child.name }}</span>
                                                    </v-list-item-title>
                                                </v-list-item-content>
                                                <v-list-item-action v-if="child.path" class="ma-0 ml-2">
                                                    <v-btn icon x-small @click.stop="handleOpenFile(child.path)">
                                                        <v-icon x-small>mdi-open-in-new</v-icon>
                                                    </v-btn>
                                                </v-list-item-action>
                                            </v-list-item>
                                        </v-list-group>

                                        <v-list-item v-else @click="openEditor(item, key)" @contextmenu.prevent="showContextMenu($event, item, key)" class="px-3 min-h-48">
                                            <v-list-item-content class="text-truncate">
                                                <v-list-item-title class="d-flex align-center text-truncate" :class="isLinked(group, item) ? 'primary--text font-weight-bold' : 'grey--text'">
                                                    <v-tooltip bottom v-if="hasErrors(item)">
                                                        <template v-slot:activator="{ on, attrs }">
                                                            <v-icon small color="error" v-bind="attrs" v-on="on" class="mr-1 flex-shrink-0">mdi-alert-circle</v-icon>
                                                        </template>
                                                        <div class="d-flex flex-column text-left">
                                                            <div v-for="(errors, type) in item.errors" :key="type">
                                                                <strong>{{ type }}:</strong> {{ Array.isArray(errors) ? errors.join(', ') : errors }}
                                                            </div>
                                                        </div>
                                                    </v-tooltip>
                                                    <span class="text-truncate flex-shrink-1">{{ getShortId(item.identifier) }}</span>
                                                    <v-icon v-if="!isLinked(group, item)" x-small color="grey" class="ml-1 flex-shrink-0">mdi-link-off</v-icon>
                                                </v-list-item-title>
                                                <v-list-item-subtitle class="text-caption text--secondary font-italic text-truncate">{{ getFileName(item.path) || 'No File' }}</v-list-item-subtitle>
                                            </v-list-item-content>
                                            
                                            <v-list-item-action class="d-flex flex-row align-center item-actions action-gap">
                                                <v-btn v-if="item.path" icon small color="primary" @click.stop="handleOpenFile(item.path)" title="Open in Default Editor" class="mx-n1 hover-visible">
                                                    <v-icon small>mdi-file-document-outline</v-icon>
                                                </v-btn>
                                                <v-btn icon small color="error" @click.stop="deleteItem(item)" title="Delete Element" class="mx-n1 hover-visible">
                                                    <v-icon small>mdi-trash-can-outline</v-icon>
                                                </v-btn>
                                            </v-list-item-action>
                                        </v-list-item>
                                    </template>
                                </v-list>
                                <div v-else class="pa-4 text-center text--secondary text-caption">
                                    No items found.
                                </div>
                            </template>
                        
                            <template v-else>
                                <v-list v-if="group.length" dense color="transparent" class="pa-0">
                                    <v-list-item v-for="item in group" :key="item.path" class="px-3 min-h-48">
                                        <v-list-item-content @click="handleOpenFile(item.path)" class="cursor-pointer text-truncate">
                                            <v-list-item-title class="error--text font-weight-medium text-caption text-truncate">{{ getFileName(item.path) }}</v-list-item-title>
                                            <v-list-item-subtitle class="text-caption grey--text text-truncate">{{ item.errors ? Object.keys(item.errors).join(', ') : 'Unknown Error' }}</v-list-item-subtitle>
                                        </v-list-item-content>
                                        <v-list-item-action class="flex-shrink-0">
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
            </v-tab-item>

            <!-- Resources Tab -->
            <v-tab-item class="sidebarNavigation">
                <v-card v-for="(group, key) in resources" :key="key" outlined class="rounded-lg overflow-hidden mb-3">
                    <div class="d-flex align-center py-2 px-3 select-none cursor-pointer sidebarNavigation" @click="expandedResources[key] = !expandedResources[key]">
                        <v-icon class="mr-3" color="primary">{{ resourceInfo[key].icon }}</v-icon>
                        <div class="d-flex flex-column flex-grow-1 text-truncate">
                            <span class="text-subtitle-1 font-weight-bold text-truncate">{{ resourceInfo[key].name }}</span>
                            <span class="text-caption grey--text text-truncate">{{ getGroupItemCount(group) }} items</span>
                        </div>
                        <v-icon color="grey">{{ expandedResources[key] ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                    </div>

                    <v-expand-transition>
                        <div v-show="expandedResources[key]" class="background">
                            <v-divider></v-divider>
                            <v-list v-if="getGroupItemCount(group)" dense color="transparent" class="pa-0">
                                <v-list-item v-for="item in getAllItems(group)" :key="item.path" @click="handleOpenFile(item.path)" @contextmenu.prevent="showContextMenu($event, item, key, true)" class="px-3 cursor-pointer min-h-48">
                                    <v-list-item-content class="text-truncate">
                                        <v-list-item-title class="d-flex align-center text-truncate" :class="isLinked(group, item) ? 'primary--text font-weight-bold' : 'grey--text'">
                                            <span class="text-truncate flex-shrink-1">{{ item.identifier }}</span>
                                            <v-chip v-if="item.subpack" x-small class="ml-2 flex-shrink-0" color="primary" outlined>{{ item.subpack }}</v-chip>
                                            <v-icon v-if="!isLinked(group, item)" x-small color="grey" class="ml-1 flex-shrink-0">mdi-link-off</v-icon>
                                        </v-list-item-title>
                                        <v-list-item-subtitle class="text-caption text--secondary font-italic text-truncate">{{ getFileName(item.path) }}</v-list-item-subtitle>
                                    </v-list-item-content>
                                    <v-list-item-action class="d-flex flex-row align-center item-actions action-gap">
                                        <v-btn icon small color="primary" @click.stop="handleOpenFile(item.path)" title="Open File" class="hover-visible">
                                            <v-icon small>mdi-file-document-outline</v-icon>
                                        </v-btn>
                                        <v-btn icon small color="error" @click.stop="deleteItem(item)" title="Delete File" class="hover-visible">
                                            <v-icon small>mdi-trash-can-outline</v-icon>
                                        </v-btn>
                                    </v-list-item-action>
                                </v-list-item>
                            </v-list>
                            <div v-else class="pa-4 text-center text--secondary text-caption">
                                No items found.
                            </div>
                        </div>
                    </v-expand-transition>
                </v-card>
            </v-tab-item>
        </v-tabs-items>

        <!-- Context Menu -->
        <v-menu v-model="contextMenu.show" :position-x="contextMenu.x" :position-y="contextMenu.y" absolute offset-y>
            <v-list dense>
                <v-list-item v-if="!contextMenu.isResource" @click="editInTypeEditor">
                    <v-list-item-icon class="mr-2">
                        <v-icon small>mdi-pencil</v-icon>
                    </v-list-item-icon>
                    <v-list-item-title class="text-caption">Edit in {{ contextMenu.editorType }} Editor</v-list-item-title>
                </v-list-item>
                <v-list-item @click="handleOpenFile(contextMenu.item?.path)">
                    <v-list-item-icon class="mr-2">
                        <v-icon small>mdi-file-document-edit</v-icon>
                    </v-list-item-icon>
                    <v-list-item-title class="text-caption">Open in Default Editor</v-list-item-title>
                </v-list-item>
                <v-divider></v-divider>
                <v-list-item @click="deleteItem(contextMenu.item)">
                    <v-list-item-icon class="mr-2">
                        <v-icon small color="error">mdi-delete</v-icon>
                    </v-list-item-icon>
                    <v-list-item-title class="text-caption error--text">Delete File</v-list-item-title>
                </v-list-item>
            </v-list>
        </v-menu>

        <!-- Settings Dialog -->
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
                    <v-switch v-model="settings.scanSubpacks" label="Scan for subpacks" dense hide-details class="mt-0 pt-0 mb-4"></v-switch>
                    <v-switch v-model="settings.scanUnknown" label="Scan for unknown files" dense hide-details class="mt-0 pt-0 mb-4"></v-switch>

                    <div class="text-overline mb-2 primary--text font-weight-bold">Developer Settings</div>
                    <v-switch v-model="settings.saveAddonData" label="Save custom addon data (subpack colors, etc.)" dense hide-details class="mt-0 pt-0 mb-4"></v-switch>
                    <v-switch v-model="settings.debugLogging" label="Enable Debug Logging" dense hide-details class="mt-0 pt-0"></v-switch>
                </v-card-text>
            </v-card>
        </v-dialog>
    </v-container>
</template>

<script>
export default {
    components: {
        HelpBtn: window.helpBtn
    },

    data: () => ({
        activeTab: 1,
        showSettings: false,
        scanning: false,
        scanProgress: { message: '', percent: 0 },
        manifest: null,
        elements: { structures: { linked: [], unlinked: [] }, features: { linked: [], unlinked: [] }, unknown: [] },
        resources: { structure_files: { linked: [], unlinked: [] } },
        settings: window.settings || {
            // Scan Controls
            scanOnMount: true,
            scanStructures: true,
            scanFeatures: true,
            scanSubpacks: true,
            scanUnknown: true,
            combineDuplicates: true,
            // Developer Settings
            saveAddonData: true,
            debugLogging: false
        },
        expanded: { structures: true, features: true, unknown: true },
        expandedResources: { structure_files: true },
        contextMenu: { show: false, x: 0, y: 0, item: null, type: null, editorType: '', isResource: false },
        elementInfo: {
            structures: {name: "Structures", icon: "mdi-office-building"},
            features: {name: "Features", icon: "mdi-tree"},
            unknown: {name: "Unknown", icon: "mdi-file-cancel"}
        },
        resourceInfo: {
            structure_files: {name: "Structure Files", icon: "mdi-cube-outline"}
        }
    }),

    computed: {
        manifestVersion: {
            get() { return this.manifest?.header?.version?.join('.') || ''; },
            set(val) { if (this.manifest?.header) this.manifest.header.version = val.split('.').map(v => parseInt(v) || 0); }
        },
        manifestMinEngineVersion: {
            get() { return this.manifest?.header?.min_engine_version?.join('.') || ''; },
            set(val) { if (this.manifest?.header) this.manifest.header.min_engine_version = val.split('.').map(v => parseInt(v) || 0); }
        }
    },

    methods: {
        hasErrors(item) {
            return item?.errors && Object.keys(item.errors).length > 0;
        },

        isLinked(group, item) {
            return item._isLinked !== undefined ? item._isLinked : group.linked.includes(item);
        },

        getFileName(path) {
            return path?.split(/[\\/]/).pop() || '';
        },

        getShortId(identifier) {
            return identifier?.split(':').pop() || '';
        },

        getGroupItemCount(group) {
            if (Array.isArray(group)) return group.length;
            if (this.settings.combineDuplicates) return this.getAllItems(group).length;
            return group.linked.length + group.unlinked.length;
        },

        getAllItems(group) {
            const items = [...group.linked, ...group.unlinked];
            if (!this.settings.combineDuplicates) return items;
            
            const map = new Map();
            for (const item of items) {
                const key = item.identifier || item.path;
                if (!map.has(key)) map.set(key, { ...item, _isLinked: group.linked.includes(item) });
                else if (group.linked.includes(item)) map.get(key)._isLinked = true;
            }
            return Array.from(map.values());
        },

        async scan() { 
            if (this.scanning) return;
            this.scanning = true;
            this.scanProgress = { message: 'Initializing scan...', percent: 0 };
            
            try {
                window.updateScanProgress = (message, percent) => {
                    this.scanProgress = { message, percent: Math.round(percent) };
                };
                
                const result = await window.scanAddon();
                this.manifest = result.manifest;
                this.elements = result.elements;
                this.resources = result.resources;
                this.scanProgress = { message: 'Scan complete!', percent: 100 };
                
                setTimeout(() => {
                    this.scanning = false;
                }, 1000);
            } catch (error) {
                await window.log(`Scan error: ${error.message}`, true);
                this.scanning = false;
            }
        },

        showContextMenu(event, item, type, isResource = false) {
            this.contextMenu = {
                show: true,
                x: event.clientX,
                y: event.clientY,
                item,
                type,
                editorType: isResource ? 'Structure' : (this.elementInfo[type]?.name.slice(0, -1) || 'File'),
                isResource
            };
        },

        async editInTypeEditor() {
            this.contextMenu.show = false;
            if (this.contextMenu.isResource) await this.handleOpenFile(this.contextMenu.item.path);
            else await this.openEditor(this.contextMenu.item, this.contextMenu.type);
        },

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
            if (!editorComponent) return window.log(`Editor component '${info.name.slice(0, -1)}Editor' not found.`, true);

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
                while (currentDir !== this.bridge.projectRoot && currentDir.startsWith(this.bridge.projectRoot)) {
                    const files = await this.bridge.fs.readdir(currentDir);
                    if (files.length > 0) break;
                    await this.bridge.fs.unlink(currentDir);
                    currentDir = this.bridge.path.dirname(currentDir);
                }
                await this.scan();
            } catch (error) { await window.log(`Error deleting ${item.path}: ${error.message}`, true); }
        },

        getFileTree(item) {
            if (!window.addonIndex) return [];
            const index = window.addonIndex;
            const icons = this.treeIcons || (this.treeIcons = { 
                mcstructures: 'mdi-cube-outline', 
                jigsaws: 'mdi-puzzle-outline', 
                template_pools: 'mdi-format-list-bulleted-type', 
                features: 'mdi-tree-outline' 
            });
            
            const findById = (map, identifier) => {
                if (!map) return null;
                for (const info of map.values()) {
                    if (info?.identifier === identifier) return info;
                }
                return null;
            };
            
            const resolve = (id, type) => {
                if (!id || typeof id !== 'string') return null;
                const found = (type && findById(index[type], id)) || 
                             findById(index.features, id) || 
                             findById(index.mcstructures, id) || 
                             findById(index.jigsaws, id) || 
                             findById(index.template_pools, id);
                const resolved = found?.checked || found;
                if (!resolved) {
                    return { name: id, errors: id.startsWith('minecraft:') ? {} : { UNKNOWN_ID: [id] } };
                }
                return { ...resolved, name: id, typeMap: type || (found?.checked ? 'features' : null) };
            };

            const traverse = (item, level = 0, visited = new Set(), depth = 0) => {
                if (depth > 10 || !item) return [];
                const nodes = [];
                
                const addChild = (id, type) => {
                    const child = resolve(id, type);
                    if (!child) return;
                    
                    const key = child.path || child.name;
                    if (visited.has(key)) return;
                    
                    visited.add(key);
                    nodes.push({ 
                        name: child.identifier || child.name, 
                        path: child.path, 
                        level, 
                        hasError: this.hasErrors(child), 
                        errors: child.errors, 
                        icon: icons[type] || icons[child.typeMap] 
                    });
                    nodes.push(...traverse(child, level + 1, visited, depth + 1));
                };
                
                const propTypeMap = {
                    features: 'features',
                    jigsaws: 'jigsaws',
                    elements: undefined,
                    pool_aliases: 'template_pools'
                };
                
                for (const [prop, type] of Object.entries(propTypeMap)) {
                    item[prop]?.forEach(id => addChild(id, type));
                }
                
                if (item.structure) {
                    addChild(item.structure, 'mcstructures');
                    addChild(item.structure, 'jigsaws');
                }
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
        },

        async saveManifest() {
            try {
                const manifestPath = this.bridge.path.join(this.bridge.projectRoot, 'BP', 'manifest.json');
                await this.bridge.fs.writeFile(manifestPath, JSON.stringify(this.manifest, null, '\t'));
                await window.log('Manifest saved successfully');
            } catch (error) {
                await window.log(`Error saving manifest: ${error.message}`, true);
            }        },

        regenerateUUID() {
            this.manifest.header.uuid = crypto.randomUUID();
        },

        addSubpack() {
            if (!this.manifest.subpacks) this.$set(this.manifest, 'subpacks', []);
            this.manifest.subpacks.push({
                folder_name: `subpack_${this.manifest.subpacks.length + 1}`,
                name: `Subpack ${this.manifest.subpacks.length + 1}`,
                memory_tier: this.manifest.subpacks.length
            });
        },

        removeSubpack(index) {
            this.manifest.subpacks.splice(index, 1);
            // Update memory tiers after removal
            this.manifest.subpacks.forEach((sp, i) => sp.memory_tier = i);
        },

        moveSubpack(index, direction) {
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= this.manifest.subpacks.length) return;
            const temp = this.manifest.subpacks[index];
            this.$set(this.manifest.subpacks, index, this.manifest.subpacks[newIndex]);
            this.$set(this.manifest.subpacks, newIndex, temp);
            // Update memory tiers after move
            this.manifest.subpacks.forEach((sp, i) => sp.memory_tier = i);
        }
    },

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
        await this.scan();
    }
};
</script>
<style scoped>
.v-list-group__header { padding-right: 12px !important; }
.text-truncate { min-width: 0; }
.font-mono { font-family: monospace; }
.flex-shrink-1 { flex: 0 1 auto; }
.min-h-48 { min-height: 48px; }
.action-gap { gap: 2px; }
.tree-item { min-height: 32px; }
.item-actions .hover-visible {
    opacity: 0;
    transition: opacity 0.2s;
}
.v-list-item:hover .item-actions .hover-visible,
.v-list-group__header:hover .item-actions .hover-visible {
    opacity: 1;
}
.v-expansion-panel-header {
    min-height: unset !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
}
.v-expansion-panel-content >>> .v-expansion-panel-content__wrap {
    padding: 8px 12px 12px;
}
</style>