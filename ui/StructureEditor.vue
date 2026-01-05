<template>
    <v-container>
        <v-card class="mb-4 rounded-lg" outlined>
            <v-card-title><v-icon left>mdi-information</v-icon>Structure Set</v-card-title>
            <v-card-text>
                <v-text-field label="Identifier" v-model="data.structure_set['minecraft:structure_set'].description.identifier" :rules="[value => !!value || 'Required']">
                    <template v-slot:append><help-btn :text="helpText.global.identifier" /></template>
                </v-text-field>
            </v-card-text>
        </v-card>
        <v-btn block color="primary" class="rounded-lg" depressed large @click="save()"><v-icon left>mdi-content-save</v-icon>Save</v-btn>
    </v-container>
</template>

<script>
export default {
    props: { tab: { type: Object, required: true } },
    data() {
        return {
            info: JSON.parse(JSON.stringify(this.tab.item)),
            data: { structure_set: { 'minecraft:structure_set': { description: { identifier: '' } } }, jigsaws: [], template_pools: [] },
            helpText: window.helpText
        };
    },
    watch: {
        tab: { immediate: true, handler() { this.info = JSON.parse(JSON.stringify(this.tab.item)); this.load(); } }
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
    methods: {
        async load() {
            try {
                const parseJSON = window.parseJSON, mergeJSON = window.mergeJSON, resourcePath = './extensions/AddonBuilder/resources/';
                const loadFile = async (defaultFile, filePath) => await mergeJSON(await parseJSON(resourcePath + defaultFile), await parseJSON(filePath));
                const index = window.addonIndex || {};
                
                this.data.structure_set = await loadFile('default_structure_set.json', this.info.path);
                this.data.jigsaws = []; this.data.template_pools = [];
                
                for (let { structure: identifier } of this.data.structure_set['minecraft:structure_set']?.structures || []) {
                    if (!index.jigsaws?.has(identifier)) continue;
                    const jigsaw = await loadFile('default_jigsaw.json', index.jigsaws.get(identifier).path);
                    this.data.jigsaws.push(jigsaw);
                    
                    const poolIds = [jigsaw['minecraft:jigsaw']?.start_pool, ...(jigsaw['minecraft:jigsaw']?.pool_aliases || [])].filter(Boolean);
                    for (let poolId of poolIds) {
                        if (index.template_pools?.has(poolId)) 
                            this.data.template_pools.push(await loadFile('default_template_pool.json', index.template_pools.get(poolId).path));
                    }
                }
            } catch (error) { window.log(error, true) }
        },
        
        async save() {
            try {
                const env = await require('@bridge/env'), fs = await require('@bridge/fs'), path = await require('@bridge/path'), notify = await require('@bridge/notification');
                const projectRoot = await env.getCurrentProject(), structureSet = this.data.structure_set['minecraft:structure_set'], name = structureSet.description.identifier.split(':').pop();
                
                await fs.writeJSON(path.join(projectRoot, 'BP/worldgen/structure_sets', `${name}.json`), { format_version: this.data.structure_set.format_version, 'minecraft:structure_set': structureSet });
                
                let jigsawSavePath = 'structures', poolSavePath = 'template_pools';
                if (this.data.jigsaws.length > 1) { 
                    jigsawSavePath = path.join(jigsawSavePath, name); 
                    poolSavePath = path.join(poolSavePath, name); 
                }
                
                for (let jigsaw of this.data.jigsaws) {
                    const jigsawData = jigsaw['minecraft:jigsaw'], jigsawName = jigsawData.description.identifier.split(':').pop();
                    await fs.writeJSON(path.join(projectRoot, 'BP/worldgen', jigsawSavePath, `${jigsawName}.json`), { format_version: jigsaw.format_version, 'minecraft:jigsaw': jigsawData });
                }
                
                for (let pool of this.data.template_pools) {
                    const poolData = pool['minecraft:template_pool'], poolName = poolData.description.identifier.split(':').pop();
                    await fs.writeJSON(path.join(projectRoot, 'BP/worldgen', poolSavePath, `${poolName}.json`), { format_version: pool.format_version, 'minecraft:template_pool': poolData });
                }
                
                notify.create({ title: 'Success', body: 'Structure saved' });
            } catch (error) { window.log(error, true) }
        }
    }
};
</script>
