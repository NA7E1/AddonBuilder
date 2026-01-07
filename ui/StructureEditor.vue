<template>
    <v-container>
        <v-card class="mb-4 rounded-lg overflow-hidden" outlined>
            <v-card-title @click="expanded.type = 'structure_set'">
                <v-icon left>mdi-castle</v-icon>Structure Set
                <div v-if="expanded.type !== 'structure_set'">{{data.structure_set['minecraft:structure_set'].description.identifier}}</div>
            </v-card-title>
            <v-expand-transition>
                <v-card-text v-if="expanded.type === 'structure_set'">
                    <v-text-field label="Identifier" v-model="data.structure_set['minecraft:structure_set'].description.identifier" :rules="[requiredRule]">
                        <template v-slot:append><help-btn :text="helpText.structure_set.identifier" /></template>
                    </v-text-field>
                </v-card-text>
            </v-expand-transition>
        </v-card>

        <div v-if="['jigsaw','structure_set'].includes(expanded.type)">
            <v-btn v-for="jigsaw in data.jigsaws" :key="jigsaw['minecraft:jigsaw'].description.identifier" color="primary" class="rounded-lg" large @click="expanded = {type: 'jigsaw', identifier: jigsaw['minecraft:jigsaw'].description.identifier}"><v-icon left>mdi-puzzle</v-icon>{{jigsaw['minecraft:jigsaw'].description.identifier}}</v-btn>
            <v-btn color="primary" class="rounded-lg" large depressed @click="data.newJigsaw().then(j => { expanded = { type: 'jigsaw', identifier: j['minecraft:jigsaw'].description.identifier } })"><v-icon left>mdi-plus</v-icon>Create New</v-btn>
        </div>

        <v-card class="mb-4 rounded-lg overflow-hidden" outlined>
            <v-card-title @click="expanded.type = 'jigsaw'">
                <v-icon left>mdi-puzzle</v-icon>Jigsaw
                <div v-if="expanded.type !== 'jigsaw' && data.jigsaws.find(j => j['minecraft:jigsaw']?.description?.identifier === expanded.identifier)">
                    {{ data.jigsaws.find(j => j['minecraft:jigsaw']?.description?.identifier === expanded.identifier)['minecraft:jigsaw'].description.identifier }}
                </div>
            </v-card-title>
            <v-expand-transition>
                <v-card-text v-if="expanded.type === 'jigsaw'">
                    <v-text-field label="Identifier" v-model="data.jigsaws.find(j => j['minecraft:jigsaw'].description.identifier === expanded.identifier)['minecraft:jigsaw'].description.identifier" :rules="[requiredRule]">
                        <template v-slot:append><help-btn :text="helpText.jigsaw.identifier" /></template>
                    </v-text-field>

                    <div v-for="element in data.jigsaws.find(j => j['minecraft:jigsaw'].description.identifier === expanded.identifier)['minecraft:jigsaw'].elements" :key="element['minecraft:jigsaw'].description.identifier" @click="expanded = {type: 'element', identifier: element['minecraft:jigsaw'].description.identifier}">
                        <v-btn color="primary" class="rounded-lg" large depressed><v-icon left>mdi-puzzle</v-icon>{{element['minecraft:jigsaw'].description.identifier}}</v-btn>
                        <v-btn color="primary" class="rounded-lg" large depressed @click="data.newTemplatePool().then(p => { expanded = { type: 'element', identifier: p['minecraft:template_pool'].description.identifier } })"><v-icon left>mdi-plus</v-icon>Create New</v-btn>
                    </div>
                </v-card-text>
            </v-expand-transition>
        </v-card>

        <div v-if="['template_pool','jigsaw'].includes(expanded.type)">
            <v-btn v-for="templatePool in data.template_pools" :key="templatePool['minecraft:template_pool'].description.identifier" color="primary" class="rounded-lg" large @click="expanded = {type: 'template_pool', identifier: templatePool['minecraft:template_pool'].description.identifier}"><v-icon left>mdi-puzzle</v-icon>{{templatePool['minecraft:template_pool'].description.identifier}}</v-btn>
            <v-btn color="primary" class="rounded-lg" large depressed @click="data.newTemplatePool().then(p => { expanded = { type: 'template_pool', identifier: p['minecraft:template_pool'].description.identifier } })"><v-icon left>mdi-plus</v-icon>Create New</v-btn>
        </div>

        <v-card class="mb-4 rounded-lg overflow-hidden" outlined v-if="expanded.type !== 'structure_set'">
            <v-card-title @click="expanded.type = 'template_pool'">
                <v-icon left>mdi-library-shelves</v-icon>Template Pool
                <div v-if="expanded.type !== 'template_pool' && data.template_pools.find(tp => tp['minecraft:template_pool']?.description?.identifier === expanded.identifier)">
                    {{ data.template_pools.find(tp => tp['minecraft:template_pool']?.description?.identifier === expanded.identifier)['minecraft:template_pool'].description.identifier }}
                </div>
            </v-card-title>
            <v-expand-transition>
                <v-card-text v-if="expanded.type === 'template_pool'">
                    <v-text-field label="Identifier" v-model="data.template_pools.find(tp => tp['minecraft:template_pool'].description.identifier === expanded.identifier)['minecraft:template_pool'].description.identifier" :rules="[requiredRule]">
                        <template v-slot:append><help-btn :text="helpText.template_pool.identifier" /></template>
                    </v-text-field>
                </v-card-text>
            </v-expand-transition>
        </v-card>

        <div>
            <v-btn block color="primary" class="rounded-lg" depressed large @click="save(true)"><v-icon left>mdi-content-save</v-icon>Save</v-btn>
            <v-btn block color="primary" class="rounded-lg" depressed large @click="save(false)"><v-icon left>mdi-content-save</v-icon>Save and Exit</v-btn>
        </div>
    </v-container>
</template>

<script>
export default {
    props: { tab: { type: Object, required: true } },
    data() {
        return {
            expanded: {
                type: 'structure_set',
                identifier: 'structure_set'
            },
            info: JSON.parse(JSON.stringify(this.tab.item)),
            data: {
                structure_set: {},
                jigsaws: [],
                template_pools: [],

                newJigsaw: async function() {
                    let jigsaw = await window.parseJSON('./extensions/AddonBuilder/resources/default_jigsaw.json');
                    this.jigsaws.push(jigsaw);
                    return jigsaw;
                },

                newTemplatePool: async function() {
                    let templatePool = await window.parseJSON('./extensions/AddonBuilder/resources/default_template_pool.json');
                    this.template_pools.push(templatePool);
                    return templatePool;
                },

                newElement: async function(pool) {
                    pool.elements.push({
                        "element": {
                            "element_type": "minecraft:single_pool_element",
                            "location": null
                        },
                        "weight": 1
                    });
                    return pool.elements[pool.elements.length - 1];
                }
            },
            helpText: window.helpText,

            requiredRule: value => !!value || 'Required'
        };
    },

    watch: {
        tab: {
            immediate: true,
            handler() {
                this.info = JSON.parse(JSON.stringify(this.tab.item));
                this.load();
            }
        }
    },

    components: {
        HelpBtn: {
            props: ['text'],
            template: `<v-menu open-on-hover bottom offset-y max-width="300">
                <template v-slot:activator="{ on }"><v-btn icon x-small v-on="on"><v-icon color="grey lighten-1">mdi-help-circle-outline</v-icon></v-btn></template>
                <v-card outlined><v-card-text class="pa-2">{{text}}</v-card-text></v-card>
            </v-menu>`
        }
    },

    async mounted() {
        this.bridge = {
            env: await require('@bridge/env'),
            fs: await require('@bridge/fs'),
            path: await require('@bridge/path'),
            notification: await require('@bridge/notification')
        };
    },

    methods: {
        
        async load() {
            try {
                const parseJSON = window.parseJSON,
                mergeJSON = window.mergeJSON,
                resourcePath = './extensions/AddonBuilder/resources/';

                const loadFile = async (defaultFile, filePath) => await mergeJSON(await parseJSON(resourcePath + defaultFile), await parseJSON(filePath));
                const index = window.addonIndex || {};
                
                this.data.structure_set = await loadFile('default_structure_set.json', this.info.path);
                this.data.jigsaws = [];
                this.data.template_pools = [];
                
                for (let { structure: identifier } of this.data.structure_set['minecraft:structure_set']?.structures || []) {
                    if (!index.jigsaws?.has(identifier)) continue;
                    const path = index.jigsaws.get(identifier).path;
                    const jigsaw = await loadFile('default_jigsaw.json', path);
                    jigsaw._path = path; // Track original path
                    this.data.jigsaws.push(jigsaw);
                    
                    const poolIds = [jigsaw['minecraft:jigsaw']?.start_pool, ...(jigsaw['minecraft:jigsaw']?.pool_aliases || [])].filter(Boolean);
                    for (let poolId of poolIds) {
                        if (index.template_pools?.has(poolId)) {
                            // Fix: Prevent duplicate pools
                            if (!this.data.template_pools.find(p => p['minecraft:template_pool']?.description?.identifier === poolId)) {
                                const pPath = index.template_pools.get(poolId).path;
                                const pool = await loadFile('default_template_pool.json', pPath);
                                pool._path = pPath; // Track original path
                                this.data.template_pools.push(pool);
                            }
                        }
                    }
                }
            } catch (error) { window.log(error, true) }
        },
        
        async save(exit) {
            try {
                const projectRoot = await this.bridge.env.getCurrentProject()

                // Save Structure Set
                const structureSet = this.data.structure_set['minecraft:structure_set']
                const structureSetId = structureSet.description.identifier;
                await this.bridge.fs.writeJSON(this.bridge.path.join(projectRoot, 'BP/worldgen/structure_sets', `${structureSetId}.json`), { 
                    format_version: this.data.structure_set.format_version || "1.21.20", 
                    'minecraft:structure_set': structureSet 
                });
                
                const subfolder = this.data.jigsaws.length > 1 ? structureSetId : '';
                
                // Save Jigsaws
                for (let jigsaw of this.data.jigsaws) {
                    const jigsawData = jigsaw['minecraft:jigsaw'], jigsawName = jigsawData.description.identifier.split(':').pop();
                    const savePath = jigsaw._path || this.bridge.path.join(projectRoot, 'BP/worldgen/structures', subfolder, `${jigsawName}.json`);
                    await this.bridge.fs.writeJSON(savePath, { 
                        format_version: jigsaw.format_version || "1.21.20", 
                        'minecraft:jigsaw': jigsawData 
                    });
                }
                
                // Save Template Pools
                for (let pool of this.data.template_pools) {
                    const poolData = pool['minecraft:template_pool'], poolName = poolData.description.identifier.split(':').pop();
                    const savePath = pool._path || this.bridge.path.join(projectRoot, 'BP/worldgen/template_pools', subfolder, `${poolName}.json`);
                    await this.bridge.fs.writeJSON(savePath, { 
                        format_version: pool.format_version || "1.21.20", 
                        'minecraft:template_pool': poolData 
                    });
                }
                
                this.bridge.notification.create({
                    icon: 'mdi-check',
                    message: 'Structure saved successfully',
                    color: 'success'
                });

                if (exit) this.$emit('exit');
            } catch (error) { window.log(error, true) }
        }
    }
};
</script>