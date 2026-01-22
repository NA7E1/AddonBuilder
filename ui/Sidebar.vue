<template>
    <v-container>
        <div class="d-flex align-center justify-space-between mb-2">
            <h1 class="text-subtitle-1 font-weight-bold text-truncate flex-grow-1">Addon Builder</h1>
            <v-btn icon small @click="ui.showSettings = true"><v-icon small>mdi-cog</v-icon></v-btn>
        </div>

        <v-btn block color="primary" class="rounded-lg mb-3" depressed @click="scanAddon()" :disabled="scan.scanning" :loading="scan.scanning">
            <v-icon left small>mdi-magnify</v-icon>
            {{ scan.scanning ? 'Scanning...' : 'Scan Project' }}
        </v-btn>
        
        <v-expand-transition>
            <v-card v-show="scan.scanning" outlined class="mb-3 rounded-lg pa-3 background">
                <div class="text-caption grey--text mb-2">{{ scan.progress.message }}</div>
                <v-progress-linear :value="scan.progress.percent" color="primary" rounded height="6"></v-progress-linear>
                <div class="text-caption grey--text text-right mt-1">{{ scan.progress.percent }}%</div>
            </v-card>
        </v-expand-transition>

        <v-tabs v-model="ui.activeTab" grow class="mb-3 rounded-lg" background-color="sidebarNavigation" slider-size="2" height="36">
            <v-tab class="text-caption"><v-icon small left>mdi-package-variant</v-icon>Addon</v-tab>
            <v-tab class="text-caption"><v-icon small left>mdi-file-tree</v-icon>Elements</v-tab>
            <v-tab class="text-caption"><v-icon small left>mdi-folder-multiple</v-icon>Resources</v-tab>
        </v-tabs>

        <v-tabs-items v-model="ui.activeTab">
            <!-- Addon Tab -->
            <v-tab-item class="sidebarNavigation">
                <v-card outlined class="rounded-lg mb-3">
                    <v-card-title class="text-subtitle-2 py-2 sidebarNavigation">Behavior Pack Information</v-card-title>
                    <v-divider></v-divider>
                    <v-card-text v-if="manifest" class="background">
                        <div class="mb-2"><div class="text-caption grey--text">Name</div><v-text-field v-model="manifest.header.name" dense hide-details outlined class="text-body-2 mt-1"></v-text-field></div>
                        <div class="mb-2"><div class="text-caption grey--text">Description</div><v-textarea v-model="manifest.header.description" dense auto-grow hide-details outlined class="text-body-2 mt-1"></v-textarea></div>
                        <div class="mb-2"><div class="text-caption grey--text">Version</div><v-text-field v-model="manifestVersion" dense hide-details outlined class="text-body-2 mt-1"></v-text-field></div>
                        <div class="mb-2">
                            <div class="text-caption grey--text">UUID</div>
                            <div class="d-flex align-center mt-1">
                                <v-text-field v-model="manifest.header.uuid" dense hide-details outlined class="text-caption font-mono" readonly disabled></v-text-field>
                                <v-btn icon small class="ml-2" @click="regenerateUUID" title="Regenerate UUID"><v-icon small>mdi-refresh</v-icon></v-btn>
                            </div>
                        </div>
                        <div v-if="manifest.header?.min_engine_version"><div class="text-caption grey--text">Min Engine Version</div><v-text-field v-model="manifestMinEngineVersion" dense hide-details outlined class="text-body-2 mt-1"></v-text-field></div>
                    </v-card-text>
                    <v-card-text v-else class="text-caption grey--text text-center background">No manifest found</v-card-text>
                </v-card>

                <!-- Subpack Editor -->
                <v-card v-if="manifest" outlined class="rounded-lg mb-3">
                    <v-card-title class="text-subtitle-2 py-2 d-flex align-center justify-space-between sidebarNavigation">
                        Subpacks
                        <v-btn icon x-small @click="addSubpack"><v-icon small>mdi-plus</v-icon></v-btn>
                    </v-card-title>
                    <v-divider></v-divider>
                    <v-card-text class="background pa-2">
                        <div v-if="manifest.subpacks.length" class="position-relative" @drop="onDragDrop">
                            <div v-if="drag.start !== null && drag.target === 0" @dragover.prevent.stop class="d-flex align-center justify-center rounded-lg my-1" style="height: 40px; background: rgba(var(--v-primary-base), 0.08); border: 2px dashed rgba(var(--v-primary-base), 0.4); animation: dropFadeIn 0.2s ease">
                                <span class="caption font-weight-bold primary--text px-2 py-1 rounded-pill" style="background: rgba(var(--v-primary-base), 0.15)">T{{ drag.start < 0 ? 0 : 0 }}</span>
                            </div>
                            <div v-for="(sp, i) in manifest.subpacks" :key="`subpack-${i}`" draggable="true" @dragstart="drag.start = i" @dragover="dragOver(i, $event)" @dragend="drag.start = null; drag.target = null" class="d-flex align-center rounded-lg mb-2 px-2 position-relative" :style="{gap: '8px', paddingTop: '6px', paddingBottom: '6px', background: 'var(--v-sidebarNavigation-base)', cursor: drag.start === i ? 'grabbing' : 'grab', opacity: drag.start === i ? 0.4 : 1, transition: 'all 0.15s ease', animation: drag.movedSubpacks.has(sp.folder_name) ? 'moveFlash 1.5s ease' : 'none'}" @mouseenter="$event.currentTarget.style.background = 'var(--v-background-base)'" @mouseleave="$event.currentTarget.style.background = 'var(--v-sidebarNavigation-base)'">
                                <v-icon small class="flex-shrink-0" style="color: rgba(255, 255, 255, 0.3); cursor: grab">mdi-drag-vertical</v-icon>
                                <v-menu offset-y :close-on-content-click="false">
                                    <template v-slot:activator="{ on }">
                                        <v-btn icon small v-on="on" @click.stop><v-icon small :color="getSubpackColor(i)">mdi-folder</v-icon></v-btn>
                                    </template>
                                    <v-card class="rounded-lg">
                                        <v-card-text class="pa-2">
                                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; width: 160px">
                                                <v-btn v-for="c in subpackColors" :key="c" icon small @click="setSubpackColor(i, c)"><v-icon :color="c">mdi-circle</v-icon></v-btn>
                                                <v-btn icon small @click="clearSubpackColor(i)"><v-icon x-small>mdi-close</v-icon></v-btn>
                                            </div>
                                        </v-card-text>
                                    </v-card>
                                </v-menu>
                                <div class="d-flex flex-column flex-grow-1" style="gap: 2px; min-width: 0">
                                    <input v-model="sp.name" placeholder="Display Name" @click.stop class="text-body-2 font-weight-medium px-1 rounded flex-grow-1" style="background: transparent; border: none; outline: none; color: inherit; font-family: inherit; transition: all 0.15s; border-bottom: 1px dotted transparent" @mouseenter="$event.target.style.borderBottomColor = 'rgba(255, 255, 255, 0.3)'" @mouseleave="$event.target.style.borderBottomColor = 'transparent'" @focus="$event.target.style.background = 'var(--v-background-base)'; $event.target.style.borderBottomColor = 'var(--v-primary-base)'" @blur="$event.target.style.background = 'transparent'; $event.target.style.borderBottomColor = 'transparent'" />
                                    <input :value="sp.folder_name" @input="updateSubpackFolderName(i, $event.target.value)" @focus="trackOriginalFolderName(i, sp.folder_name)" placeholder="Folder Name" @click.stop class="caption px-1 rounded flex-grow-1" style="background: transparent; border: none; outline: none; color: inherit; font-family: inherit; transition: all 0.15s; border-bottom: 1px dotted transparent; opacity: 0.7" @mouseenter="$event.target.style.borderBottomColor = 'rgba(255, 255, 255, 0.3)'" @mouseleave="$event.target.style.borderBottomColor = 'transparent'" @focus="$event.target.style.background = 'var(--v-background-base)'; $event.target.style.borderBottomColor = 'var(--v-primary-base)'" @blur="$event.target.style.background = 'transparent'; $event.target.style.borderBottomColor = 'transparent'" />
                                </div>
                                <span class="caption font-weight-bold mr-1 flex-shrink-0" style="color: rgba(255, 255, 255, 0.3)">T{{ i }}</span>
                                <v-btn icon small @click.stop="removeSubpack(i)"><v-icon small color="error">mdi-delete</v-icon></v-btn>
                                <div v-if="drag.start !== null && drag.target === i + 1" @dragover.prevent.stop class="d-flex align-center justify-center rounded-lg my-1" style="height: 40px; background: rgba(var(--v-primary-base), 0.08); border: 2px dashed rgba(var(--v-primary-base), 0.4); animation: dropFadeIn 0.2s ease">
                                    <span class="caption font-weight-bold primary--text px-2 py-1 rounded-pill" style="background: rgba(var(--v-primary-base), 0.15)">T{{ drag.start < i + 1 ? i : i + 1 }}</span>
                                </div>
                            </div>
                        </div>
                        <div v-else class="text-caption grey--text text-center pa-4">No subpacks defined</div>
                    </v-card-text>
                    <v-divider></v-divider>
                </v-card>
                <v-btn block color="primary" @click="saveManifest">Save Manifest</v-btn>
            </v-tab-item>

            <!-- Elements/Resources Tabs -->
            <v-tab-item v-for="tabType in ['elements', 'resources']" :key="tabType" class="sidebarNavigation">
                <v-text-field :value="filters.search[tabType]" @input="val => filters.search[tabType] = val" dense outlined hide-details placeholder="Search..." prepend-inner-icon="mdi-magnify" clearable class="mb-3 rounded-lg"></v-text-field>

                <div class="d-flex mb-3" style="gap: 8px; flex-wrap: wrap">
                    <v-btn small outlined @click="togglePanel(tabType, 'stats')" title="Statistics"><v-icon small>mdi-chart-bar</v-icon></v-btn>
                    <v-btn small outlined @click="togglePanel(tabType, 'warnings')" :disabled="getWarnings(tabType).length === 0" title="Warnings"><v-icon small :color="getWarnings(tabType).length > 0 ? 'error' : ''">mdi-alert-circle</v-icon></v-btn>
                    <v-btn small outlined @click="togglePanel(tabType, 'recent')" :disabled="getRecentFiles(tabType).length === 0" title="Recent"><v-icon small>mdi-history</v-icon></v-btn>
                    <v-btn small outlined @click="togglePanel(tabType, 'favorites')" :disabled="getFavorites(tabType).length === 0" title="Favorites"><v-icon small>mdi-star</v-icon></v-btn>
                    <v-btn v-if="tabType === 'elements'" small outlined @click="ui.showAdvancedFilters = !ui.showAdvancedFilters" title="Filters"><v-icon small>mdi-filter-variant</v-icon></v-btn>
                </div>

                <!-- Advanced Filters (Elements Only) -->
                <v-expand-transition v-if="tabType === 'elements'">
                    <v-card v-show="ui.showAdvancedFilters" outlined class="mb-3 rounded-lg">
                        <v-card-title class="text-subtitle-2 py-2 d-flex align-center justify-space-between sidebarNavigation">
                            Advanced Filters
                            <v-btn icon x-small @click="ui.showAdvancedFilters = false"><v-icon small>mdi-close</v-icon></v-btn>
                        </v-card-title>
                        <v-divider></v-divider>
                        <v-card-text class="pa-2 background">
                            <v-select v-model="filters.status" :items="[{text: 'All', value: 'all'}, {text: 'Linked Only', value: 'linked'}, {text: 'Unlinked Only', value: 'unlinked'}]" label="Link Status" dense outlined hide-details class="mb-2"></v-select>
                            <v-select v-model="filters.subpack" :items="[{text: 'All Subpacks', value: 'all'}, {text: 'Base Only', value: 'base'}, ...(manifest && manifest.subpacks ? manifest.subpacks.map(s => ({text: s.folder_name, value: s.folder_name})) : [])]" label="Subpack" dense outlined hide-details class="mb-2"></v-select>
                            <v-select v-model="filters.errors" :items="[{text: 'All', value: 'all'}, {text: 'With Errors', value: 'errors'}, {text: 'No Errors', value: 'no-errors'}]" label="Error Status" dense outlined hide-details></v-select>
                        </v-card-text>
                    </v-card>
                </v-expand-transition>

                <!-- Info Panels -->
                <v-expand-transition>
                    <v-card v-if="panelStates[tabType].stats" outlined class="mb-3 rounded-lg">
                        <v-card-title class="text-subtitle-2 py-2 d-flex align-center justify-space-between sidebarNavigation">Statistics<v-btn icon x-small @click="togglePanel(tabType, 'stats')"><v-icon small>mdi-close</v-icon></v-btn></v-card-title>
                        <v-divider></v-divider>
                        <v-card-text class="pa-2 background">
                            <div v-for="(value, key) in getStatsOrdered(tabType)" :key="key" class="text-caption mb-1 d-flex justify-space-between align-center">
                                <span class="grey--text">{{ key }}:</span>
                                <span class="font-weight-bold" :class="key === 'With Errors' ? 'error--text' : key === 'Linked' ? 'success--text' : key === 'Unlinked' ? 'warning--text' : key === 'Scan Time' ? 'grey--text text--lighten-1' : 'primary--text'">{{ value }}</span>
                            </div>
                        </v-card-text>
                    </v-card>
                </v-expand-transition>
                <v-expand-transition>
                    <v-card v-if="panelStates[tabType].warnings" outlined class="mb-3 rounded-lg">
                        <v-card-title class="text-subtitle-2 py-2 d-flex align-center justify-space-between sidebarNavigation"><div><v-icon small color="error" class="mr-2">mdi-alert</v-icon>Warnings</div><v-btn icon x-small @click="togglePanel(tabType, 'warnings')"><v-icon small>mdi-close</v-icon></v-btn></v-card-title>
                        <v-divider></v-divider>
                        <v-card-text class="pa-2 background">
                            <div v-for="(warning, idx) in getWarnings(tabType)" :key="idx" @click="openEditor(warning.item, warning.type)" class="text-caption mb-2 pa-2 rounded cursor-pointer" style="background: rgba(var(--v-error-base), 0.1); border-left: 3px solid var(--v-error-base); transition: all 0.15s" @mouseenter="$event.currentTarget.style.background = 'rgba(var(--v-error-base), 0.2)'" @mouseleave="$event.currentTarget.style.background = 'rgba(var(--v-error-base), 0.1)'">
                                <div class="font-weight-bold error--text mb-1">{{ warning.message }}</div>
                                <div class="grey--text">{{ warning.identifier }}</div>
                            </div>
                            <div v-if="getWarnings(tabType).length === 0" class="text-caption grey--text text-center py-2">No warnings</div>
                        </v-card-text>
                    </v-card>
                </v-expand-transition>
                <v-expand-transition>
                    <v-card v-if="panelStates[tabType].recent" outlined class="mb-3 rounded-lg">
                        <v-card-title class="text-subtitle-2 py-2 d-flex align-center justify-space-between sidebarNavigation">Recent Files<v-btn icon x-small @click="togglePanel(tabType, 'recent')"><v-icon small>mdi-close</v-icon></v-btn></v-card-title>
                        <v-divider></v-divider>
                        <v-card-text class="pa-2 background">
                            <div v-for="(file, idx) in getRecentFiles(tabType)" :key="idx" @click="openEditorByRecent(file)" class="d-flex align-center pa-2 rounded mb-1 cursor-pointer" style="transition: all 0.15s" @mouseenter="$event.currentTarget.style.background = 'var(--v-sidebarNavigation-base)'" @mouseleave="$event.currentTarget.style.background = 'transparent'">
                                <v-icon small class="mr-2" color="primary">{{ getInfo(tabType)[file.type]?.icon || 'mdi-file' }}</v-icon>
                                <div class="flex-grow-1 text-truncate">
                                    <div class="text-caption font-weight-medium text-truncate">{{ file.identifier }}</div>
                                </div>
                            </div>
                            <div v-if="getRecentFiles(tabType).length === 0" class="text-caption grey--text text-center py-2">No recent files</div>
                        </v-card-text>
                    </v-card>
                </v-expand-transition>
                <v-expand-transition>
                    <v-card v-if="panelStates[tabType].favorites" outlined class="mb-3 rounded-lg">
                        <v-card-title class="text-subtitle-2 py-2 d-flex align-center justify-space-between sidebarNavigation">
                            <div class="d-flex align-center">
                                <v-icon small color="warning" class="mr-2">mdi-star</v-icon>
                                <span>Favorites</span>
                            </div>
                            <v-btn icon x-small @click="togglePanel(tabType, 'favorites')"><v-icon small>mdi-close</v-icon></v-btn>
                        </v-card-title>
                        <v-divider></v-divider>
                        <v-card-text class="pa-2 background">
                            <div v-for="(fav, idx) in getFavorites(tabType)" :key="idx" @click="openEditorByFavorite(fav)" class="d-flex align-center pa-2 rounded mb-1 cursor-pointer" style="transition: all 0.15s" @mouseenter="$event.currentTarget.style.background = 'var(--v-sidebarNavigation-base)'" @mouseleave="$event.currentTarget.style.background = 'transparent'">
                                <v-icon small class="mr-2" color="primary">{{ getInfo(tabType)[fav.type]?.icon || 'mdi-file' }}</v-icon>
                                <div class="flex-grow-1 text-truncate">
                                    <div class="text-caption font-weight-medium text-truncate">{{ fav.identifier }}</div>
                                </div>
                                <v-btn icon x-small @click.stop="toggleFavorite(fav.identifier, fav.type)"><v-icon small color="warning">mdi-star</v-icon></v-btn>
                            </div>
                            <div v-if="getFavorites(tabType).length === 0" class="text-caption grey--text text-center py-2">No favorites</div>
                        </v-card-text>
                    </v-card>
                </v-expand-transition>

                <!-- Groups -->
                <v-card v-for="(group, key) in getFiltered(tabType)" :key="key" outlined class="rounded-lg overflow-hidden mb-3">
                    <div class="d-flex align-center py-1 px-3 select-none cursor-pointer sidebarNavigation" @click="expanded[key] = !expanded[key]">
                        <v-icon class="mr-3" color="primary">{{ getInfo(tabType)[key].icon }}</v-icon>
                        <div class="d-flex flex-column flex-grow-1 text-truncate">
                            <span class="text-subtitle-1 font-weight-bold text-truncate">{{ getInfo(tabType)[key].name }}</span>
                            <span class="text-caption grey--text text-truncate">{{ getGroupItemCount(group) }} items</span>
                        </div>
                        <v-btn v-if="tabType === 'elements' && key !== 'unknown'" small outlined class="mr-2" @click.stop="importElement(key)"><v-icon small>mdi-upload</v-icon></v-btn>
                        <v-btn v-if="tabType === 'elements' && key !== 'unknown'" small color="primary" class="mr-2" @click.stop="createElement(key)"><v-icon left small>mdi-plus</v-icon>New</v-btn>
                        <v-btn v-if="tabType === 'resources'" small outlined class="mr-2" @click.stop="importResource(key)"><v-icon small>mdi-upload</v-icon></v-btn>
                        <v-icon color="grey">{{ expanded[key] ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                    </div>
                    <v-divider></v-divider>
                    <v-expand-transition>
                        <div v-show="expanded[key]" class="background">
                            <template v-if="!Array.isArray(group)">
                                <v-list v-if="getGroupItemCount(group)" dense color="transparent" class="pa-0">
                                    <template v-for="item in [...group.linked, ...group.unlinked]">
                                        <!-- Item with file tree -->
                                        <v-list-group v-if="getFileTree(item).length > 0" :key="item.identifier" no-action append-icon="mdi-chevron-down">
                                            <template v-slot:activator>
                                                <v-list-item-content @click="openEditor(item, key)" @contextmenu.prevent="showContextMenu($event, item)" class="cursor-pointer">
                                                    <v-list-item-title class="d-flex align-center text-truncate" :class="group.linked.includes(item) ? 'primary--text font-weight-bold' : 'grey--text'">
                                                        <v-tooltip bottom v-if="hasAnyErrors(item)" key="error-tooltip"><template v-slot:activator="{ on, attrs }"><v-icon small color="error" v-bind="attrs" v-on="on" class="mr-1 flex-shrink-0">mdi-alert-circle</v-icon></template><div class="d-flex flex-column text-left"><div v-for="(inst, idx) in getItemInstances(item)" :key="getInstanceKey(inst, idx)"><div v-if="inst.errors && Object.keys(inst.errors).length"><strong>{{ inst.subpack || 'Base' }}:</strong><div v-for="(errors, type) in inst.errors" :key="type" class="ml-2">{{ type }}: {{ Array.isArray(errors) ? errors.join(', ') : errors }}</div></div></div></div></v-tooltip>
                                                        <span class="text-truncate flex-shrink-1">{{ getShortId(item.identifier) }}</span>
                                                        <v-icon v-if="!group.linked.includes(item)" x-small color="grey" class="ml-1 flex-shrink-0">mdi-link-off</v-icon>
                                                    </v-list-item-title>
                                                    <v-list-item-subtitle class="d-flex align-center text-caption text--secondary font-italic" style="gap: 4px">
                                                        <v-btn v-for="(inst, idx) in getItemInstances(item)" :key="getInstanceKey(inst, idx)" icon x-small :color="getFileButtonColor(inst.subpack)" @click.stop="handleOpenFile(inst.path)" :title="`Open ${inst.subpack || 'base'} file`" class="mx-n1"><v-icon x-small>mdi-file-document-outline</v-icon></v-btn>
                                                        <v-tooltip bottom v-if="getFirstFileName(item)"><template v-slot:activator="{ on, attrs }"><span class="text-truncate" v-bind="attrs" v-on="on">{{ getFirstFileName(item) }}</span></template><div v-for="(inst, idx) in getItemInstances(item)" :key="getInstanceKey(inst, idx)"><strong>{{ inst.subpack || 'Base' }}:</strong> {{ getFileName(inst.path) }}</div></v-tooltip>
                                                    </v-list-item-subtitle>
                                                </v-list-item-content>
                                                <v-menu v-model="item.showContextMenu" :position-x="item.menuX" :position-y="item.menuY" absolute offset-y :close-on-content-click="true"><template v-slot:activator="{ }"><span></span></template><v-list dense class="menu"><v-list-item @click="duplicateItem(item, key); item.showContextMenu = false"><v-list-item-icon><v-icon small>mdi-content-copy</v-icon></v-list-item-icon><v-list-item-title>Duplicate</v-list-item-title></v-list-item><v-list-item @click="selectAndExport(item, key); item.showContextMenu = false"><v-list-item-icon><v-icon small>mdi-download</v-icon></v-list-item-icon><v-list-item-title>Export</v-list-item-title></v-list-item><v-list-item @click="toggleFavorite(item.identifier, key); item.showContextMenu = false"><v-list-item-icon><v-icon small>{{ isFavorite(item.identifier, key) ? 'mdi-star' : 'mdi-star-outline' }}</v-icon></v-list-item-icon><v-list-item-title>{{ isFavorite(item.identifier, key) ? 'Remove from Favorites' : 'Add to Favorites' }}</v-list-item-title></v-list-item><v-divider></v-divider><v-list-item @click="deleteItem(item); item.showContextMenu = false" class="error--text"><v-list-item-icon><v-icon small color="error">mdi-delete</v-icon></v-list-item-icon><v-list-item-title>Delete</v-list-item-title></v-list-item></v-list></v-menu>
                                                <v-list-item-action class="d-flex flex-row align-center mr-n8" style="gap: 4px">
                                                    <v-btn icon small @click.stop="toggleFavorite(item.identifier, key)" :title="isFavorite(item.identifier, key) ? 'Remove from favorites' : 'Add to favorites'" class="hover-visible"><v-icon small :color="isFavorite(item.identifier, key) ? 'warning' : 'grey'">{{ isFavorite(item.identifier, key) ? 'mdi-star' : 'mdi-star-outline' }}</v-icon></v-btn>
                                                    <v-btn icon small @click.stop="selectAndExport(item, key)" title="Export Element" class="hover-visible"><v-icon small>mdi-download</v-icon></v-btn>
                                                    <v-btn icon small color="error" @click.stop="deleteItem(item)" title="Delete Element" class="hover-visible"><v-icon small>mdi-trash-can-outline</v-icon></v-btn>
                                                </v-list-item-action>
                                            </template>

                                            <!-- File tree children -->
                                            <v-list-item v-for="(child, idx) in getFileTree(item)" :key="`${item.identifier}-child-${idx}`" :style="{ paddingLeft: (child.level * 16 + 8) + 'px' }" class="tree-item py-0">
                                                <v-list-item-content class="text-truncate" @click="child.instances && child.instances[0]?.path && handleOpenFile(child.instances[0].path)" :class="{ 'cursor-pointer': child.instances && child.instances[0]?.path }">
                                                    <v-list-item-title class="text-caption d-flex align-center">
                                                        <v-tooltip bottom v-if="child.hasError" key="child-error"><template v-slot:activator="{ on, attrs }"><v-icon small color="error" class="mr-1" v-bind="attrs" v-on="on">mdi-alert-circle</v-icon></template><div class="text-left text-caption"><div v-for="(inst, idx) in child.instances" :key="getInstanceKey(inst, idx)"><div v-if="inst.errors && Object.keys(inst.errors).length"><strong>{{ inst.subpack || 'Base' }}:</strong><div v-for="(errors, type) in inst.errors" :key="type" class="ml-2">{{ type }}: {{ Array.isArray(errors) ? errors.join(', ') : errors }}</div></div></div></div></v-tooltip>
                                                        <v-icon v-else small :color="getFileButtonColor(child.subpack)" class="mr-1" key="child-icon">{{ child.icon || 'mdi-file-outline' }}</v-icon>
                                                        <span class="grey--text text--lighten-1 text-truncate flex-grow-1">{{ child.name }}</span>
                                                    </v-list-item-title>
                                                </v-list-item-content>
                                                <v-list-item-action v-if="child.instances" class="d-flex flex-row align-center ml-2" style="gap: 4px">
                                                    <v-btn icon x-small @click.stop="exportFile(child)" title="Export file" class="hover-visible"><v-icon x-small>mdi-download</v-icon></v-btn>
                                                    <v-btn v-for="(inst, idx) in child.instances" :key="getInstanceKey(inst, idx)" icon x-small :color="getFileButtonColor(inst.subpack)" @click.stop="handleOpenFile(inst.path)" :title="`Open ${inst.subpack || 'base'} file`"><v-icon x-small>mdi-open-in-new</v-icon></v-btn>
                                                </v-list-item-action>
                                            </v-list-item>
                                        </v-list-group>

                                        <!-- Simple item without tree -->
                                        <v-list-item v-else :key="item.identifier" @click="openEditor(item, key)" @contextmenu.prevent="showContextMenu($event, item)" class="px-3" style="min-height: 40px">
                                            <v-list-item-content class="text-truncate cursor-pointer">
                                                <v-list-item-title class="d-flex align-center text-truncate" :class="group.linked.includes(item) ? 'primary--text font-weight-bold' : 'grey--text'">
                                                    <v-tooltip bottom v-if="hasAnyErrors(item)" key="item-error"><template v-slot:activator="{ on, attrs }"><v-icon small color="error" v-bind="attrs" v-on="on" class="mr-1 flex-shrink-0">mdi-alert-circle</v-icon></template><div class="d-flex flex-column text-left"><div v-for="(inst, idx) in getItemInstances(item)" :key="getInstanceKey(inst, idx)"><div v-if="inst.errors && Object.keys(inst.errors).length"><strong>{{ inst.subpack || 'Base' }}:</strong><div v-for="(errors, type) in inst.errors" :key="type" class="ml-2">{{ type }}: {{ Array.isArray(errors) ? errors.join(', ') : errors }}</div></div></div></div></v-tooltip>
                                                    <span class="text-truncate flex-shrink-1">{{ getShortId(item.identifier) }}</span>
                                                    <v-icon v-if="!group.linked.includes(item)" x-small color="grey" class="ml-1 flex-shrink-0">mdi-link-off</v-icon>
                                                </v-list-item-title>
                                                <v-list-item-subtitle class="d-flex align-center text-caption text--secondary font-italic" style="gap: 4px">
                                                    <v-btn v-for="(inst, idx) in getItemInstances(item)" :key="getInstanceKey(inst, idx)" icon x-small :color="getFileButtonColor(inst.subpack)" @click.stop="handleOpenFile(inst.path)" :title="`Open ${inst.subpack || 'base'} file`" class="mx-n1"><v-icon x-small>mdi-file-document-outline</v-icon></v-btn>
                                                    <v-tooltip bottom v-if="getFirstFileName(item)"><template v-slot:activator="{ on, attrs }"><span class="text-truncate" v-bind="attrs" v-on="on">{{ getFirstFileName(item) }}</span></template><div v-for="(inst, idx) in getItemInstances(item)" :key="getInstanceKey(inst, idx)"><strong>{{ inst.subpack || 'Base' }}:</strong> {{ getFileName(inst.path) }}</div></v-tooltip>
                                                </v-list-item-subtitle>
                                            </v-list-item-content>
                                            <v-menu v-model="item.showContextMenu" :position-x="item.menuX" :position-y="item.menuY" absolute offset-y :close-on-content-click="true"><template v-slot:activator="{ }"><span></span></template><v-list dense class="menu"><v-list-item @click="duplicateItem(item, key); item.showContextMenu = false"><v-list-item-icon><v-icon small>mdi-content-copy</v-icon></v-list-item-icon><v-list-item-title>Duplicate</v-list-item-title></v-list-item><v-list-item @click="selectAndExport(item, key); item.showContextMenu = false"><v-list-item-icon><v-icon small>mdi-download</v-icon></v-list-item-icon><v-list-item-title>Export</v-list-item-title></v-list-item><v-list-item @click="toggleFavorite(item.identifier, key); item.showContextMenu = false"><v-list-item-icon><v-icon small>{{ isFavorite(item.identifier, key) ? 'mdi-star' : 'mdi-star-outline' }}</v-icon></v-list-item-icon><v-list-item-title>{{ isFavorite(item.identifier, key) ? 'Remove from Favorites' : 'Add to Favorites' }}</v-list-item-title></v-list-item><v-divider></v-divider><v-list-item @click="deleteItem(item); item.showContextMenu = false" class="error--text"><v-list-item-icon><v-icon small color="error">mdi-delete</v-icon></v-list-item-icon><v-list-item-title>Delete</v-list-item-title></v-list-item></v-list></v-menu>
                                            <v-list-item-action class="d-flex flex-row align-center" style="gap: 4px">
                                                <v-btn icon small @click.stop="toggleFavorite(item.identifier, key)" :title="isFavorite(item.identifier, key) ? 'Remove from favorites' : 'Add to favorites'" class="hover-visible"><v-icon small :color="isFavorite(item.identifier, key) ? 'warning' : 'grey'">{{ isFavorite(item.identifier, key) ? 'mdi-star' : 'mdi-star-outline' }}</v-icon></v-btn>
                                                <v-btn icon small @click.stop="selectAndExport(item, key)" title="Export Element" class="hover-visible"><v-icon small>mdi-download</v-icon></v-btn>
                                                <v-btn icon small color="error" @click.stop="deleteItem(item)" title="Delete Element" class="hover-visible"><v-icon small>mdi-trash-can-outline</v-icon></v-btn>
                                            </v-list-item-action>
                                        </v-list-item>
                                    </template>
                                </v-list>
                                <div v-else class="pa-4 text-center text--secondary text-caption">No items found.</div>
                            </template>
                            <template v-else>
                                <v-list v-if="group.length" dense color="transparent" class="pa-0">
                                    <v-list-item v-for="item in group" :key="item.path" class="px-3" style="min-height: 40px">
                                        <v-list-item-content @click="handleOpenFile(item.path)" class="cursor-pointer text-truncate">
                                            <v-list-item-title class="error--text font-weight-medium text-caption text-truncate">{{ getFileName(item.path) }}</v-list-item-title>
                                            <v-list-item-subtitle class="text-caption grey--text text-truncate">{{ item.errors ? Object.keys(item.errors).join(', ') : 'Unknown Error' }}</v-list-item-subtitle>
                                        </v-list-item-content>
                                        <v-list-item-action class="flex-shrink-0">
                                            <v-btn icon small color="error" @click.stop="handleOpenFile(item.path)"><v-icon small>mdi-file-document-outline</v-icon></v-btn>
                                        </v-list-item-action>
                                    </v-list-item>
                                </v-list>
                                <div v-else class="pa-4 text-center text--secondary text-caption">No items found.</div>
                            </template>
                        </div>
                    </v-expand-transition>
                </v-card>
            </v-tab-item>
        </v-tabs-items>

        <!-- Subpack Selector Dialog -->
        <v-dialog v-model="ui.showSubpackSelector" max-width="450">
            <v-card class="rounded-lg">
                <v-card-title class="text-subtitle-1 py-3 px-4 primary--text">{{ subpacks.selector.title }}</v-card-title>
                <v-divider></v-divider>
                <v-radio-group v-model="subpacks.selector.selected" class="ma-0">
                    <v-list class="py-2">
                        <v-list-item v-for="(option, idx) in subpacks.selector.options" :key="idx" @click="subpacks.selector.selected = option.value" class="cursor-pointer px-4">
                            <v-list-item-action class="mr-3"><v-radio :value="option.value"></v-radio></v-list-item-action>
                            <v-list-item-icon v-if="idx === 0" class="mr-2"><v-icon small color="primary">mdi-layers-triple</v-icon></v-list-item-icon>
                            <v-list-item-content>
                                <v-list-item-title :class="idx === 0 ? 'font-weight-bold primary--text' : ''">{{ option.label }}</v-list-item-title>
                                <v-list-item-subtitle v-if="option.fileName" class="text-caption">{{ option.fileName }}</v-list-item-subtitle>
                            </v-list-item-content>
                        </v-list-item>
                    </v-list>
                </v-radio-group>
                <v-divider></v-divider>
                <v-card-actions class="py-2 px-3">
                    <v-spacer></v-spacer>
                    <v-btn small text @click="ui.showSubpackSelector = false; subpacks.selector.selected = null">Cancel</v-btn>
                    <v-btn small color="primary" @click="confirmSubpackSelection" :disabled="subpacks.selector.selected === null">OK</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Settings Dialog -->
        <v-dialog v-model="ui.showSettings" max-width="600" scrollable>
            <v-card>
                <v-card-title class="text-h6 primary white--text py-3">
                    <v-icon color="white" class="mr-2">mdi-cog</v-icon>
                    Addon Builder Settings
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text class="pa-4 background" style="max-height: 500px">
                    <!-- Scan Behavior -->
                    <div class="mb-4">
                        <div class="text-overline primary--text font-weight-bold mb-3 d-flex align-center">
                            <v-icon small color="primary" class="mr-2">mdi-radar</v-icon>
                            Scan Behavior
                        </div>
                        <v-switch v-model="window.settings.scanOnMount" label="Automatically scan when sidebar loads" dense hide-details class="mt-0 mb-3"></v-switch>
                        <v-switch v-model="window.settings.autoScanAfterChanges" label="Auto-scan after import/delete operations" dense hide-details class="mt-0 mb-3"></v-switch>
                    </div>
                    <v-divider class="mb-4"></v-divider>
                    
                    <!-- Scan Content -->
                    <div class="mb-4">
                        <div class="text-overline primary--text font-weight-bold mb-3 d-flex align-center">
                            <v-icon small color="primary" class="mr-2">mdi-file-search</v-icon>
                            Scan Content
                        </div>
                        <v-switch v-model="window.settings.scanStructures" label="Scan for structures" dense hide-details class="mt-0 mb-3"></v-switch>
                        <v-switch v-model="window.settings.scanFeatures" label="Scan for features" dense hide-details class="mt-0 mb-3"></v-switch>
                        <v-switch v-model="window.settings.scanSubpacks" label="Scan for subpacks" dense hide-details class="mt-0 mb-3"></v-switch>
                        <v-switch v-model="window.settings.scanUnknown" label="Scan for unknown files" dense hide-details class="mt-0 mb-3"></v-switch>
                    </div>
                    <v-divider class="mb-4"></v-divider>
                    
                    <!-- Data Persistence -->
                    <div class="mb-4">
                        <div class="text-overline primary--text font-weight-bold mb-3 d-flex align-center">
                            <v-icon small color="primary" class="mr-2">mdi-content-save</v-icon>
                            Data Persistence
                        </div>
                        <v-switch v-model="window.settings.saveSessions" label="Save session data" dense hide-details class="mt-0 mb-3"></v-switch>
                        <v-switch v-model="window.settings.saveAddonData" label="Save custom addon data" dense hide-details class="mt-0 mb-3"></v-switch>
                    </div>
                    <v-divider class="mb-4"></v-divider>
                    
                    <!-- Developer Options -->
                    <div class="mb-2">
                        <div class="text-overline warning--text font-weight-bold mb-3 d-flex align-center">
                            <v-icon small color="warning" class="mr-2">mdi-code-braces</v-icon>
                            Developer Options
                        </div>
                        <v-switch v-model="window.settings.debugLogging" label="Enable debug logging" dense hide-details class="mt-0 mb-3"></v-switch>
                        <v-switch v-model="window.settings.disableScanCache" label="Disable scan cache" dense hide-details class="mt-0 mb-3"></v-switch>
                    </div>
                </v-card-text>
                <v-divider></v-divider>
                <v-card-actions class="pa-3 background">
                    <v-spacer></v-spacer>
                    <v-btn color="primary" text @click="ui.showSettings = false">Close</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-container>
</template>

<script>
export default {
    components: {},
    data: () => ({
        ui: {
            activeTab: 1,
            showSettings: false,
            showAdvancedFilters: false,
            showSubpackSelector: false,
        },
        
        scan: {
            scanning: false,
            progress: { message: '', percent: 0 },
            startTime: null,
            duration: null,
        },
        
        manifest: null,
        elements: {
            structures: { linked: [], unlinked: [] },
            features: { linked: [], unlinked: [] },
            unknown: []
        },
        resources: {
            structure_files: { linked: [], unlinked: [] }
        },
        addonData: { subpackColors: {}, favorites: [] },
        
        elementInfo: {
            structures: { name: "Structures", icon: "mdi-office-building" }, 
            features: { name: "Features", icon: "mdi-tree" }, 
            unknown: { name: "Unknown", icon: "mdi-file-cancel" }
        },
        resourceInfo: {
            structure_files: { name: "Structure Files", icon: "mdi-cube-outline" }
        },
        subpackColors: ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA', '#FB8C00', '#00ACC1', '#D81B60', '#6D4C41', '#546E7A', '#7CB342'],
        
        expanded: { structures: true, features: true, unknown: true, structure_files: true },
        panelStates: {
            elements: { stats: false, warnings: false, recent: false, favorites: false },
            resources: { stats: false, warnings: false, recent: false, favorites: false }
        },
        
        filters: {
            search: { elements: '', resources: '' },
            status: 'all',
            subpack: 'all',
            errors: 'all',
        },
        
        drag: {
            start: null,
            target: null,
            movedSubpacks: new Set(),
        },
        
        recentFiles: [],
        favorites: [],
        
        notifications: {
            active: new Map(),
            changeNotification: null,
            changeNotificationTimeout: null,
        },
        
        subpacks: {
            originalNames: {},
            selector: {
                title: '',
                options: [],
                callback: null,
                selected: null,
                instances: [],
            },
        },
        
        bridge: null,
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
        trackOriginalFolderName(index, folderName) {
            if (this.subpacks.originalNames[index] === undefined) {
                this.subpacks.originalNames[index] = folderName;
            }
        },

        updateSubpackFolderName(index, newName) {
            this.$set(this.manifest.subpacks[index], 'folder_name', newName);
        },

        getInfo(type) { return type === 'elements' ? this.elementInfo : this.resourceInfo; },
        
        getFiltered(type) {
            const data = type === 'elements' ? this.elements : this.resources;
            const filter = this.filters.search[type]?.toLowerCase() || '';
            let result = {};
            
            for (const [key, group] of Object.entries(data)) {
                if (Array.isArray(group)) {
                    result[key] = filter ? group.filter(item => item.path?.toLowerCase().includes(filter)) : [...group];
                } else {
                    result[key] = {
                        linked: (group.linked || []).filter(item => !filter || item.identifier?.toLowerCase().includes(filter)),
                        unlinked: (group.unlinked || []).filter(item => !filter || item.identifier?.toLowerCase().includes(filter))
                    };
                }
            }
            
            if (type === 'elements' && (this.filters.status !== 'all' || this.filters.subpack !== 'all' || this.filters.errors !== 'all')) {
                for (const [key, group] of Object.entries(result)) {
                    if (!Array.isArray(group)) {
                        if (this.filters.status === 'linked') group.unlinked = [];
                        else if (this.filters.status === 'unlinked') group.linked = [];
                        
                        const filterItems = (items) => items.filter(item => {
                            const instances = this.getItemInstances(item);
                            if (this.filters.subpack !== 'all') {
                                const hasMatch = instances.some(inst => this.filters.subpack === 'base' ? !inst.subpack : inst.subpack === this.filters.subpack);
                                if (!hasMatch) return false;
                            }
                            if (this.filters.errors === 'errors' && !this.hasAnyErrors(item)) return false;
                            if (this.filters.errors === 'no-errors' && this.hasAnyErrors(item)) return false;
                            return true;
                        });
                        group.linked = filterItems(group.linked || []);
                        group.unlinked = filterItems(group.unlinked || []);
                    }
                }
            }
            
            return result;
        },
        getWarnings(type) {
            const data = type === 'elements' ? this.elements : this.resources;
            const warnings = [];
            for (const [key, group] of Object.entries(data)) {
                if (!Array.isArray(group)) {
                    [...(group.linked || []), ...(group.unlinked || [])].forEach(item => {
                        if (this.hasAnyErrors(item)) {
                            this.getItemInstances(item).forEach(inst => {
                                if (inst.errors && Object.keys(inst.errors).length) {
                                    for (const [errType, errors] of Object.entries(inst.errors)) {
                                        warnings.push({ identifier: item.identifier, message: `${errType}: ${Array.isArray(errors) ? errors.join(', ') : errors}`, type: key, item });
                                    }
                                }
                            });
                        }
                    });
                }
            }
            return warnings;
        },
        getRecentFiles(type) { return this.recentFiles.filter(f => f.type in this.getInfo(type)); },

        getFavorites(type) { return this.favorites.filter(f => f.type in this.getInfo(type)); },

        getStatsOrdered(type) {
            const stats = this.getStats(type);
            const { Total, ...rest } = stats;
            return { ...rest, Total };
        },
        
        getStats(type) {
            const data = this.getFiltered(type);
            const info = this.getInfo(type);
            const stats = {};
            let total = 0;
            let linkedTotal = 0;
            let unlinkedTotal = 0;
            let errorsTotal = 0;
            
            for (const [key, group] of Object.entries(data)) {
                const count = this.getGroupItemCount(group);
                if (count > 0) {
                    stats[info[key]?.name || key] = count;
                    total += count;
                    
                    if (!Array.isArray(group)) {
                        const linked = group.linked?.length || 0;
                        const unlinked = group.unlinked?.length || 0;
                        linkedTotal += linked;
                        unlinkedTotal += unlinked;
                        
                        const errors = [...(group.linked || []), ...(group.unlinked || [])].filter(item => this.hasAnyErrors(item)).length;
                        errorsTotal += errors;
                    }
                }
            }
            
            stats['Total'] = total;
            if (linkedTotal > 0) stats['Linked'] = linkedTotal;
            if (unlinkedTotal > 0) stats['Unlinked'] = unlinkedTotal;
            if (errorsTotal > 0) stats['With Errors'] = errorsTotal;
            if (this.scan.duration !== null) stats['Scan Time'] = `${this.scan.duration}s`;
            
            return stats;
        },

        togglePanel(type, panel) { this.panelStates[type][panel] = !this.panelStates[type][panel]; },

        showContextMenu(event, item) {
            event.preventDefault();
            this.$set(item, 'menuX', event.clientX);
            this.$set(item, 'menuY', event.clientY);
            this.$set(item, 'showContextMenu', false);
            this.$nextTick(() => this.$set(item, 'showContextMenu', true));
        },

        getFileName(path) { return path?.split(/[\\/]/).pop() || ''; },

        getShortId(identifier) { return identifier?.split(':').pop() || ''; },

        getGroupItemCount(group) { return Array.isArray(group) ? group.length : (group.linked?.length || 0) + (group.unlinked?.length || 0); },

        getItemInstances(item) { return item.instances || [item]; },

        hasAnyErrors(item) { return this.getItemInstances(item).some(inst => inst.errors && Object.keys(inst.errors).length > 0); },

        getInstanceKey(inst, index) { return inst.subpack || inst.path || `inst-${index}`; },
        getFileButtonColor(subpack) { return subpack ? this.getSubpackColorByName(subpack) : 'grey'; },
        getFirstFileName(item) {
            const instances = this.getItemInstances(item);
            return instances[0]?.path ? this.getFileName(instances[0].path) : '';
        },

        async scanAddon() { 
            if (this.scan.scanning) return;
            this.scan.scanning = true;
            this.scan.startTime = Date.now();
            this.scan.progress = { message: 'Initializing scan...', percent: 0 };
            try {
                window.updateScanProgress = (msg, pct) => this.scan.progress = { message: msg, percent: Math.round(pct) };
                window.disableScanCache = window.settings.disableScanCache;
                const result = await window.performScan();
                Object.assign(this, result);
                
                this.subpacks.originalNames = {};
                if (this.manifest?.subpacks) {
                    this.manifest.subpacks.forEach((subpack, index) => {
                        this.subpacks.originalNames[index] = subpack.folder_name;
                    });
                }
                
                this.scan.duration = ((Date.now() - this.scan.startTime) / 1000).toFixed(2);
                this.scan.progress = { message: 'Scan complete!', percent: 100 };
                setTimeout(() => this.scan.scanning = false, 1000);
            } catch { this.scan.scanning = false; this.scan.duration = null; }
        },

        async saveSettings() {
            await this.bridge.fs.writeFile("./extensions/AddonBuilder/resources/settings.json", JSON.stringify(window.settings, null, 4));
        },

        async renameDirectory(oldPath, newPath) {
            const fs = this.bridge.fs;
            const path = this.bridge.path;
            
            async function copyRecursive(src, dest) {
                const entries = await fs.readdir(src);
                
                for (const name of entries) {
                    const srcPath = path.join(src, name);
                    const destPath = path.join(dest, name);
                    
                    const isDir = Array.isArray(await fs.readdir(srcPath).catch(() => false));
                    
                    if (isDir) {
                        await copyRecursive(srcPath, destPath);
                    } else {
                        const content = await fs.readFile(srcPath);
                        const data = typeof content === 'string' ? content : await content.arrayBuffer();
                        await fs.writeFile(destPath, data);
                    }
                }
            }
            
            async function deleteRecursive(dirPath) {
                const entries = await fs.readdir(dirPath);
                
                for (const name of entries) {
                    const fullPath = path.join(dirPath, name);
                    const isDir = Array.isArray(await fs.readdir(fullPath).catch(() => false));
                    
                    if (isDir) {
                        await deleteRecursive(fullPath);
                    } else {
                        await fs.unlink(fullPath);
                    }
                }
                
                await fs.unlink(dirPath);
            }
            
            await copyRecursive(oldPath, newPath);
            await deleteRecursive(oldPath);
        },

        async saveManifest() {
            try {
                await this.bridge.fs.writeFile(this.bridge.path.join(this.bridge.projectRoot, 'BP', 'manifest.json'), JSON.stringify(this.manifest, null, '\t'));
                
                let hasRenamedFolders = false;
                const subpacks = this.manifest.subpacks || [];
                for (let i = 0; i < subpacks.length; i++) {
                    const subpack = subpacks[i];
                    const originalName = this.subpacks.originalNames[i];
                    const currentName = subpack.folder_name;
                    
                    if (originalName && originalName !== currentName) {
                        const oldPath = this.bridge.path.join(this.bridge.projectRoot, 'BP', 'subpacks', originalName);
                        const newPath = this.bridge.path.join(this.bridge.projectRoot, 'BP', 'subpacks', currentName);
                        
                        try {
                            await this.renameDirectory(oldPath, newPath);
                            hasRenamedFolders = true;
                        } catch (err) {
                            await window.log(`Failed to rename subpack folder: ${err.message}`, true);
                        }

                        if (this.addonData.subpackColors[originalName]) {
                            const color = this.addonData.subpackColors[originalName];
                            this.$delete(this.addonData.subpackColors, originalName);
                            this.$set(this.addonData.subpackColors, currentName, color);
                        }

                        this.subpacks.originalNames[i] = currentName;
                    }
                }

                await this.saveAddonData();
                if (hasRenamedFolders) {
                    await this.showChangeNotification('Manifest saved! Subpack folders renamed.');
                } else {
                    const notif = this.bridge.notification.create({ icon: 'mdi-check', message: 'Manifest saved!', color: 'success' });
                    setTimeout(() => { try { notif.dispose(); } catch (e) {} }, 30000);
                }
            } catch (error) { await window.log(`Error saving manifest: ${error.message}`, true); }
        },

        regenerateUUID() { this.manifest.header.uuid = crypto.randomUUID(); },

        addSubpack() {
            if (!this.manifest.subpacks) this.$set(this.manifest, 'subpacks', []);
            const folder = `subpack_${this.manifest.subpacks.length + 1}`;
            this.manifest.subpacks.push({ folder_name: folder, name: `Subpack ${this.manifest.subpacks.length + 1}`, memory_tier: this.manifest.subpacks.length });
        },

        removeSubpack(index) {
            const folder = this.manifest.subpacks[index]?.folder_name;
            this.manifest.subpacks.splice(index, 1);
            this.manifest.subpacks.forEach((sp, i) => sp.memory_tier = i);
            if (folder) {
                this.$delete(this.addonData.subpackColors, folder);
                this.saveAddonData();
            }
        },

        dragOver(index, event) {
            if (this.drag.start === null) return;
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            this.drag.target = event.clientY < rect.top + rect.height / 2 ? index : index + 1;
        },

        onDragDrop(event) {
            event.preventDefault();
            if (this.drag.start === null || this.drag.target === null) return;
            const items = [...this.manifest.subpacks];
            items.splice(this.drag.start < this.drag.target ? this.drag.target - 1 : this.drag.target, 0, ...items.splice(this.drag.start, 1));
            this.manifest.subpacks = items;
            items.forEach((sp, i) => sp.memory_tier = i);
            this.drag.movedSubpacks = new Set(items.map(sp => sp.folder_name));
            setTimeout(() => this.drag.movedSubpacks.clear(), 1500);
            this.drag.start = this.drag.target = null;
        },

        getSubpackColor(index) {
            const folder = this.manifest.subpacks[index]?.folder_name;
            if (!folder) return this.subpackColors[0];
            if (this.addonData.subpackColors?.[folder]) return this.addonData.subpackColors[folder];
            const used = new Set(Object.values(this.addonData.subpackColors || {}));
            const color = this.subpackColors.find(c => !used.has(c)) || this.subpackColors[index % this.subpackColors.length];
            if (!this.addonData.subpackColors) this.$set(this.addonData, 'subpackColors', {});
            this.$set(this.addonData.subpackColors, folder, color);
            this.saveAddonData();
            return color;
        },

        getSubpackColorByName(folderName) {
            if (!folderName) return this.subpackColors[0];
            if (this.addonData.subpackColors?.[folderName]) return this.addonData.subpackColors[folderName];
            const subpackIndex = this.manifest?.subpacks?.findIndex(sp => sp.folder_name === folderName);
            if (subpackIndex >= 0) return this.getSubpackColor(subpackIndex);
            return this.subpackColors[0];
        },

        setSubpackColor(index, color) {
            this.$set(this.addonData.subpackColors, this.manifest.subpacks[index].folder_name, color);
            this.saveAddonData();
        },

        clearSubpackColor(index) {
            this.$delete(this.addonData.subpackColors, this.manifest.subpacks[index].folder_name);
            this.saveAddonData();
        },

        async handleOpenFile(path) {
            if (!path) return;
            try { await this.bridge.tab.openFilePath(path.slice(this.bridge.projectRoot.length + 1), true); } 
            catch (error) { await window.log(`Error opening file ${path}: ${error.message}`, true); }
        },

        async createElement(type) {
            try { await this.openEditor({ identifier: `${await this.bridge.env.getProjectPrefix()}:new_${type.slice(0, -1)}` }, type); } 
            catch (error) { await window.log(`Error creating element: ${error.message}`, true); }
        },

        async openEditor(item, type) {
            const info = this.elementInfo[type];
            const editorComponent = this.bridge.ui[`${info.name.slice(0, -1)}Editor`];
            if (!editorComponent) return window.log(`Editor component '${info.name.slice(0, -1)}Editor' not found.`, true);

            const instances = this.getItemInstances(item);
            if (instances.length > 0 && instances[0].path) {
                this.addToRecentFiles(item.identifier, type, instances[0].path);
                if (type in this.elementInfo) this.panelStates.elements.recent = true;
                else if (type in this.resourceInfo) this.panelStates.resources.recent = true;
            }

            class ElementEditor extends this.bridge.tab.ContentTab {
                component = editorComponent;
                type = 'NA7E.addonBuilder.elementEditorV2';
                id = item.identifier;
                item = item;
                isTemporary = false;
                constructor(tabSystem) { super(tabSystem, item.identifier, true); }
                is(other) { return other && (other.id === this.id || other === this); }
                isFor(other) { return other && (other.id === this.id || other === this); }
                get icon() { return info.icon; }
                get iconColor() { return 'primary'; }
                get name() { return this.id.split(':').pop(); }
            }
            
            await this.bridge.tab.addTab(new ElementEditor(this.bridge.tab.getCurrentTabSystem()));
        },
        
        async deleteItem(item) {
            try {
                const instances = this.getItemInstances(item);
                if (instances.length === 0) return;
                
                this.currentItem = item;
                await this.showSubpackSelectorDialog('Select Subpack(s) to Delete', instances, async (selectedInstances) => {
                    for (const inst of selectedInstances) {
                        if (!inst || !inst.path) continue;
                        await this.bridge.fs.unlink(inst.path);
                        let currentDir = this.bridge.path.dirname(inst.path);
                        while (currentDir !== this.bridge.projectRoot && currentDir.startsWith(this.bridge.projectRoot)) {
                            const files = await this.bridge.fs.readdir(currentDir);
                            if (files.length > 0) break;
                            await this.bridge.fs.unlink(currentDir);
                            currentDir = this.bridge.path.dirname(currentDir);
                        }
                    }
                    if (window.settings.autoScanAfterChanges) await this.scanAddon();
                    else await this.showChangeNotification('Delete');
                });
            } catch (error) { await window.log(`Error deleting item: ${error.message}`, true); }
        },

        getFileTree(item) {
            if (!window.addonIndex) return [];
            const index = window.addonIndex;
            const icons = { mcstructures: 'mdi-cube-outline', jigsaws: 'mdi-puzzle-outline', template_pools: 'mdi-format-list-bulleted-type', features: 'mdi-tree-outline', processor_lists: 'mdi-hammer-wrench' };
            
            const findById = (map, identifier) => {
                if (!map) return null;
                for (const info of map.values()) if (info?.identifier === identifier) return info;
                return null;
            };
            
            const resolve = (id, type) => {
                if (!id || typeof id !== 'string') return null;
                const found = (type && findById(index[type], id)) || findById(index.features, id) || findById(index.mcstructures, id) || findById(index.jigsaws, id) || findById(index.template_pools, id) || findById(index.processor_lists, id);
                const resolved = found?.checked || found;
                if (!resolved) return { name: id, errors: id.startsWith('minecraft:') ? {} : { UNKNOWN_ID: [id] } };
                return { ...resolved, name: id, typeMap: type || (found?.checked ? 'features' : null) };
            };

            const traverse = (item, level = 0, visited = new Set(), depth = 0, parentSubpacks = null) => {
                if (depth > 10 || !item) return [];
                const nodes = [];
                
                const addChild = (id, type, referencingSubpacks) => {
                    const child = resolve(id, type);
                    if (!child) return;
                    const key = child.identifier || child.name;
                    if (visited.has(key)) return;
                    visited.add(key);
                    const childInstances = child.instances || (child.path ? [child] : null);
                    const usedSubpacks = referencingSubpacks.length === 1 ? referencingSubpacks[0] : null;
                    nodes.push({ name: child.identifier || child.name, instances: childInstances, level, hasError: childInstances ? childInstances.some(inst => inst.errors && Object.keys(inst.errors).length) : (child.errors && Object.keys(child.errors).length > 0), icon: icons[type] || icons[child.typeMap], subpack: usedSubpacks });
                    nodes.push(...traverse(child, level + 1, visited, depth + 1, referencingSubpacks));
                };
                
                const instances = this.getItemInstances(item);
                const propTypeMap = { features: 'features', jigsaws: 'jigsaws', elements: undefined, pool_aliases: 'template_pools', processor_lists: 'processor_lists' };
                const idToSubpacks = new Map();
                
                for (const inst of instances) {
                    const subpack = inst.subpack || null;
                    for (const [prop, type] of Object.entries(propTypeMap)) {
                        inst[prop]?.forEach(id => {
                            const key = JSON.stringify({ id, type });
                            if (!idToSubpacks.has(key)) idToSubpacks.set(key, []);
                            idToSubpacks.get(key).push(subpack);
                        });
                    }
                    if (inst.structure) {
                        ['mcstructures', 'jigsaws'].forEach(type => {
                            const key = JSON.stringify({ id: inst.structure, type });
                            if (!idToSubpacks.has(key)) idToSubpacks.set(key, []);
                            idToSubpacks.get(key).push(subpack);
                        });
                    }
                    ['start_pool', 'fallback_pool'].forEach(prop => {
                        if (inst[prop]) {
                            const key = JSON.stringify({ id: inst[prop], type: 'template_pools' });
                            if (!idToSubpacks.has(key)) idToSubpacks.set(key, []);
                            idToSubpacks.get(key).push(subpack);
                        }
                    });
                    if (inst.feature) {
                        const key = JSON.stringify({ id: inst.feature, type: 'features' });
                        if (!idToSubpacks.has(key)) idToSubpacks.set(key, []);
                        idToSubpacks.get(key).push(subpack);
                    }
                }
                
                idToSubpacks.forEach((subpacks, key) => {
                    const { id, type } = JSON.parse(key);
                    addChild(id, type, subpacks);
                });
                
                return nodes;
            };

            const visited = new Set();
            this.getItemInstances(item).forEach(inst => { if (inst.identifier) visited.add(inst.identifier); });
            return traverse(item, 1, visited);
        },

        async loadAddonData() {
            try {
                const addonDataPath = this.bridge.path.join(this.bridge.projectRoot, '.bridge', 'addonBuilder.json');
                if (await this.bridge.fs.fileExists(addonDataPath)) {
                    const raw = await this.bridge.fs.readFile(addonDataPath, 'utf8');
                    const content = typeof raw === 'string' ? raw : (await raw?.text?.()) || '{}';
                    const data = JSON.parse(content);
                    this.addonData = { subpackColors: data.subpackColors || {}, favorites: data.favorites || [] };
                    this.favorites = this.addonData.favorites || [];
                    await window.log('Addon data loaded successfully');
                } else await window.log('No addon data file found, using defaults');
            } catch (error) {
                await window.log(`Error loading addon data: ${error.message}`, true);
                this.addonData = { subpackColors: {}, favorites: [] };
                this.favorites = [];
            }
        },

        async saveAddonData() {
            if (!window.settings.saveAddonData) return;
            try {
                await this.bridge.fs.writeFile(this.bridge.path.join(this.bridge.projectRoot, '.bridge', 'addonBuilder.json'), JSON.stringify(this.addonData, null, 2));
            } catch (error) { await window.log(`Error saving addon data: ${error.message}`, true); }
        },

        async saveSessionData() {
            const serializeIndex = (idx) => idx ? Object.fromEntries(Object.entries(idx).map(([k, v]) => [k, Array.from(v?.entries() || [])])) : null;
            await window.saveSession({ manifest: this.manifest, elements: this.elements, resources: this.resources, addonIndex: serializeIndex(window.addonIndex) });
        },

        async importFile(type, isResource = false) {
            try {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = isResource ? '.mcstructure' : '.json';
                input.multiple = true;
                const validExt = isResource ? 'mcstructure' : 'json';
                input.onchange = async (e) => {
                    const files = Array.from(e.target.files);
                    for (const file of files) {
                        const ext = file.name.split('.').pop().toLowerCase();
                        if (ext !== validExt) {
                            this.bridge.notification.create({ icon: 'mdi-alert', message: `Invalid file type: ${file.name}. Only .${validExt} files are allowed.`, color: 'error' });
                            continue;
                        }
                        if (isResource) {
                            await this.processImportedResource(file, type);
                        } else {
                            const text = await file.text();
                            const data = await window.parseJSON(file.name);
                            if (!data || Object.keys(data).length === 0) {
                                const cleaned = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/,\s*([}\]])/g, '$1');
                                const parsedData = JSON.parse(cleaned);
                                await this.processImportedFile(parsedData, file.name, type);
                            } else await this.processImportedFile(data, file.name, type);
                        }
                    }
                    if (window.settings.autoScanAfterChanges) await this.scanAddon();
                    else await this.showChangeNotification('Import');
                };
                input.click();
            } catch (error) { await window.log(`Error importing file: ${error.message}`, true); }
        },
        
        async importElement(type) { await this.importFile(type, false); },
        async importResource(type) { await this.importFile(type, true); },

        async processImportedFile(data, filename, type) {
            try {
                const projectRoot = await this.bridge.env.getCurrentProject();
                let targetPath = '';
                let identifier = '';

                if (data['minecraft:structure_set']) {
                    identifier = data['minecraft:structure_set'].description.identifier;
                    targetPath = this.bridge.path.join(projectRoot, 'BP/worldgen/structure_sets', `${identifier.split(':').pop()}.json`);
                } else if (data['minecraft:jigsaw']) {
                    identifier = data['minecraft:jigsaw'].description.identifier;
                    targetPath = this.bridge.path.join(projectRoot, 'BP/worldgen/structures', `${identifier.split(':').pop()}.json`);
                } else if (data['minecraft:template_pool']) {
                    identifier = data['minecraft:template_pool'].description.identifier;
                    targetPath = this.bridge.path.join(projectRoot, 'BP/worldgen/template_pools', `${identifier.split(':').pop()}.json`);
                } else if (data['minecraft:feature']) {
                    identifier = data.description?.identifier || data['minecraft:feature']?.description?.identifier;
                    targetPath = this.bridge.path.join(projectRoot, 'BP/features', `${identifier.split(':').pop()}.json`);
                } else targetPath = this.bridge.path.join(projectRoot, 'BP', filename);

                const exists = await this.bridge.fs.fileExists(targetPath);
                if (exists) {
                    const confirmed = confirm(`Element "${identifier || filename}" already exists. Do you want to replace it?`);
                    if (!confirmed) {
                        const notification = await require('@bridge/notification');
                        notification.create({ icon: 'mdi-information', message: 'Import cancelled', color: 'info' });
                        return;
                    }
                }

                await this.bridge.fs.writeFile(targetPath, JSON.stringify(data, null, 2));
            } catch (error) { await window.log(`Error processing imported file: ${error.message}`, true); }
        },

        async processImportedResource(file, type) {
            try {
                const projectRoot = await this.bridge.env.getCurrentProject();
                const ext = file.name.split('.').pop().toLowerCase();
                if (ext !== 'mcstructure') {
                    await window.log('Only .mcstructure files can be imported as resources', true);
                    return;
                }
                const targetPath = this.bridge.path.join(projectRoot, 'BP/structures', file.name);
                const exists = await this.bridge.fs.fileExists(targetPath);
                if (exists) {
                    const confirmed = confirm(`File "${file.name}" already exists. Do you want to replace it?`);
                    if (!confirmed) return;
                }
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                await this.bridge.fs.writeFile(targetPath, uint8Array);
            } catch (error) { await window.log(`Error processing imported resource: ${error.message}`, true); }
        },

        async exportItem(item, type) {
            try {
                const instances = this.getItemInstances(item);
                if (instances.length === 0) {
                    const notification = await require('@bridge/notification');
                    notification.create({ icon: 'mdi-alert', message: 'No files to export', color: 'warning' });
                    return;
                }
                if (instances.length === 1 && instances[0].path) await this.exportFile({ instances: [instances[0]], name: item.identifier });
                else {
                    for (const inst of instances) {
                        if (inst.path) await this.exportFile({ instances: [inst], name: `${item.identifier}_${inst.subpack || 'base'}` });
                    }
                }
            } catch (error) { await window.log(`Error exporting item: ${error.message}`, true); }
        },

        async exportFile(child) {
            try {
                const instances = child.instances || [child];
                for (const inst of instances) {
                    if (!inst.path) continue;
                    const content = await this.bridge.fs.readFile(inst.path, 'utf8');
                    const text = typeof content === 'string' ? content : await content.text();
                    const filename = this.getFileName(inst.path);
                    const blob = new Blob([text], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } catch (error) { await window.log(`Error exporting file: ${error.message}`, true); }
        },

        isFavorite(identifier, type) { return this.favorites.some(fav => fav.identifier === identifier && fav.type === type); },

        toggleFavorite(identifier, type) {
            const index = this.favorites.findIndex(fav => fav.identifier === identifier && fav.type === type);
            if (index >= 0) this.favorites.splice(index, 1);
            else {
                this.favorites.push({ identifier, type });
                if (type in this.elementInfo) this.panelStates.elements.favorites = true;
                else if (type in this.resourceInfo) this.panelStates.resources.favorites = true;
            }
            this.addonData.favorites = this.favorites;
            this.saveAddonData();
        },

        openEditorByReference(ref) {
            const dataSource = ref.type in this.elementInfo ? this.elements : this.resources;
            const group = dataSource[ref.type];
            if (!group || Array.isArray(group)) return;
            const item = [...(group.linked || []), ...(group.unlinked || [])].find(i => i.identifier === ref.identifier);
            if (item) this.openEditor(item, ref.type);
        },
        
        openEditorByFavorite(fav) { this.openEditorByReference(fav); },
        openEditorByRecent(file) { this.openEditorByReference(file); },

        addToRecentFiles(identifier, type, path) {
            const existing = this.recentFiles.findIndex(f => f.identifier === identifier);
            if (existing >= 0) this.recentFiles.splice(existing, 1);
            this.recentFiles.unshift({ identifier, type, path, timestamp: Date.now() });
            if (this.recentFiles.length > 20) this.recentFiles.pop();
        },

        scrollToGroup(groupKey) {
            if (!this.expanded[groupKey]) this.expanded[groupKey] = true;
        },

        async duplicateItem(item, type) {
            try {
                const instances = this.getItemInstances(item);
                if (instances.length === 0 || !instances[0].path) return;
                this.currentItem = item;
                await this.showSubpackSelectorDialog('Select Subpack(s) to Duplicate', instances, async (selectedInstances) => {
                    for (const inst of selectedInstances) {
                        if (!inst || !inst.path) continue;
                        const srcPath = inst.path;
                        const content = await this.bridge.fs.readFile(srcPath, 'utf8');
                        const text = typeof content === 'string' ? content : await content.text();
                        const data = await window.parseJSON(srcPath) || JSON.parse(text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));
                        const oldId = item.identifier;
                        let newId;
                        const copyMatch = oldId.match(/^(.+?)(_copy\d*)$/);
                        if (copyMatch) {
                            const base = copyMatch[1];
                            const existingSuffix = copyMatch[2];
                            if (existingSuffix === '_copy') newId = `${base}_copy2`;
                            else {
                                const num = parseInt(existingSuffix.replace('_copy', '')) || 2;
                                newId = `${base}_copy${num + 1}`;
                            }
                        } else newId = `${oldId}_copy`;
                        
                        if (data['minecraft:structure_set']) data['minecraft:structure_set'].description.identifier = newId;
                        else if (data['minecraft:jigsaw']) data['minecraft:jigsaw'].description.identifier = newId;
                        else if (data['minecraft:template_pool']) data['minecraft:template_pool'].description.identifier = newId;
                        else if (data['format_version'] && data['minecraft:feature_rule']) await window.log(`Skipping identifier update for feature rule: ${srcPath}`, false);
                        else {
                            let updated = false;
                            for (const key of Object.keys(data)) {
                                if (key.startsWith('minecraft:') && data[key]?.description?.identifier) {
                                    data[key].description.identifier = newId;
                                    updated = true;
                                    break;
                                }
                            }
                            if (!updated && data.description?.identifier) {
                                data.description.identifier = newId;
                                updated = true;
                            }
                            if (!updated) await window.log(`Warning: Could not find identifier field in ${srcPath}`, true);
                        }
                        const filename = `${newId.split(':').pop()}.json`;
                        const dirPath = this.bridge.path.dirname(srcPath);
                        const newPath = this.bridge.path.join(dirPath, filename);
                        await this.bridge.fs.writeFile(newPath, JSON.stringify(data, null, 2));
                    }
                    await this.showChangeNotification('Duplicate');
                });
            } catch (error) { await window.log(`Error duplicating element: ${error.message}`, true); }
        },

        async selectAndExport(item, type) {
            try {
                const instances = this.getItemInstances(item);
                if (instances.length === 0) {
                    const notification = await require('@bridge/notification');
                    notification.create({ icon: 'mdi-alert', message: 'No files to export', color: 'warning' });
                    return;
                }
                this.currentItem = item;
                await this.showSubpackSelectorDialog('Select Subpack(s) to Export', instances, async (selectedInstances) => {
                    for (const inst of selectedInstances) {
                        if (inst && inst.path) await this.exportFile({ instances: [inst], name: `${item.identifier}_${inst.subpack || 'base'}` });
                    }
                });
            } catch (error) { await window.log(`Error exporting element: ${error.message}`, true); }
        },
        
        async showChangeNotification(action) {
            if (this.notifications.changeNotification) {
                try { this.notifications.changeNotification.dispose(); } catch (e) { }
            }
            if (this.notifications.changeNotificationTimeout) clearTimeout(this.notifications.changeNotificationTimeout);
            const notification = await require('@bridge/notification');
            this.notifications.changeNotification = notification.create({
                icon: 'mdi-check',
                message: `${action} complete. Scan to see changes.`,
                color: 'success',
                disposeOnMiddleClick: true,
                onClick: async () => {
                    if (this.notifications.changeNotification) {
                        try { this.notifications.changeNotification.dispose(); } catch (e) { }
                        this.notifications.changeNotification = null;
                    }
                    await this.scanAddon();
                }
            });
            this.notifications.changeNotificationTimeout = setTimeout(() => {
                if (this.notifications.changeNotification) {
                    try { this.notifications.changeNotification.dispose(); } catch (e) { }
                    this.notifications.changeNotification = null;
                }
            }, 30000);
        },
        
        async showSubpackSelectorDialog(title, instances, callback) {
            if (!instances || instances.length === 0) return;
            if (instances.length === 1) {
                await callback(instances);
                return;
            }
            const options = [{ label: 'All Subpack Files', value: 'all' }, ...instances.map((inst, idx) => ({ label: inst.subpack || 'Base', value: idx, fileName: this.getFileName(inst.path) }))];
            this.subpacks.selector.title = title.replace('Select subpacks to', 'Select Subpack File(s) to').replace('Select subpack files to', 'Select Subpack File(s) to');
            this.subpacks.selector.options = options;
            this.subpacks.selector.callback = callback;
            this.subpacks.selector.instances = instances;
            this.subpacks.selector.selected = 'all';
            this.ui.showSubpackSelector = true;
        },
        
        async confirmSubpackSelection() {
            this.ui.showSubpackSelector = false;
            if (!this.subpacks.selector.callback) return;
            const instances = this.subpacks.selector.selected === 'all' ? this.subpacks.selector.instances : [this.subpacks.selector.instances[this.subpacks.selector.selected]];
            await this.subpacks.selector.callback(instances);
            this.subpacks.selector.selected = null;
            this.subpacks.selector.instances = [];
        }
    },

    mounted() {
        (async () => {
            const env = await require('@bridge/env');
            const projectRoot = await env.getCurrentProject();
            this.bridge = { fs: await require('@bridge/fs'), path: await require('@bridge/path'), tab: await require('@bridge/tab'), ui: await require('@bridge/ui'), notification: await require('@bridge/notification'), env, projectRoot };
            await this.loadAddonData();
            const sessionData = await window.loadSession();
            await window.log('Sidebar mounted.');
            const isValidSession = sessionData?.manifest?.header && sessionData?.projectRoot === projectRoot;
            if (isValidSession) {
                this.manifest = sessionData.manifest;
                this.elements = sessionData.elements || this.elements;
                this.resources = sessionData.resources || this.resources;
                window.addonIndex = sessionData.addonIndex ? Object.fromEntries(Object.entries(sessionData.addonIndex).map(([k, v]) => [k, new Map(v)])) : {};
                this.$nextTick(() => {
                    const favoritesElementsCount = this.favorites.filter(f => f.type in this.elementInfo).length;
                    const recentFilesElementsCount = this.recentFiles.filter(f => f.type in this.elementInfo).length;
                    const favoritesResourcesCount = this.favorites.filter(f => f.type in this.resourceInfo).length;
                    const recentFilesResourcesCount = this.recentFiles.filter(f => f.type in this.resourceInfo).length;
                    if (favoritesElementsCount > 0) this.panelStates.elements.favorites = true;
                    if (recentFilesElementsCount > 0) this.panelStates.elements.recent = true;
                    if (favoritesResourcesCount > 0) this.panelStates.resources.favorites = true;
                    if (recentFilesResourcesCount > 0) this.panelStates.resources.recent = true;
                });
            } else {
                window.addonIndex = {};
                this.$nextTick(() => {
                    const favoritesElementsCount = this.favorites.filter(f => f.type in this.elementInfo).length;
                    const favoritesResourcesCount = this.favorites.filter(f => f.type in this.resourceInfo).length;
                    if (favoritesElementsCount > 0) this.panelStates.elements.favorites = true;
                    if (favoritesResourcesCount > 0) this.panelStates.resources.favorites = true;
                });
                if (window.settings.scanOnMount) await this.scanAddon();
            }
        })();
    },

    watch: {
        settings: { handler() { this.saveSettings(); }, deep: true }
    }
};
</script>

<style scoped>
.hover-visible { opacity: 0; transition: opacity 0.2s; }
.v-list-item:hover .hover-visible, .v-list-group__header:hover .hover-visible { opacity: 1; }
.tree-item:hover { background: rgba(255, 255, 255, 0.05); }
.hover-bg:hover { background: rgba(255, 255, 255, 0.08); }
.cursor-pointer { cursor: pointer; }
@keyframes moveFlash {
    0%, 100% { background: var(--v-sidebarNavigation-base); }
    50% { background: rgba(var(--v-primary-base), 0.2); }
}
@keyframes dropFadeIn {
    from { opacity: 0; transform: scaleY(0.5); }
    to { opacity: 1; transform: scaleY(1); }
}
</style>