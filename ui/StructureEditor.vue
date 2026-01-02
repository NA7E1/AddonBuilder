<template>
    <div class="background d-flex">
        <v-card>
            <v-card-title>
                <v-icon left>mdi-information</v-icon>
                Structure Set
            </v-card-title>
            <v-card-text>
                <v-text-field
                    label="Identifier"
                    prepend-icon="mdi-rename-box"
                    v-model="data.identifier"
                    :rules="[requiredRule, identifierRule]"
                    :hint="helpText.global.identifier"
                    persistent-hint
                ></v-text-field>
                <v-divider></v-divider>

            </v-card-text>
        </v-card>
    </div>
</template>

<script>

export default {
    name: 'StructureEditor',
    props: {
        item: { type: Object, default: null }
    },

    data() {
        return {
            data: JSON.parse(JSON.stringify(this.item || { identifier: '' })),

            requiredRule: v => !!v || 'Required.',
            identifierRule: v => /^[a-zA-Z0-9_:]+$/.test(v) || 'Invalid identifier (use namespace:name).',
            helpText: window.helpText
        };
    }
}
</script>
