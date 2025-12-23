<template>
    <v-container>
        <header class="d-flex align-center">
            <div>
                <h1 class="text-h6 mb-1">Addon Builder</h1>
                <p class="text-body-2 mb-3">Create and manage your addon elements.</p>
            </div>
            <v-btn icon color="tertiary" class="ml-auto align-self-start">
                <v-icon>mdi-cog</v-icon>
            </v-btn>
        </header>

        <v-btn color="primary" class="mb-4" @click="scan()">Scan Project</v-btn>

        <v-row>
            <v-col v-for="(items, key) in elements" :key="key" cols="12">
                <v-card outlined>
                    <v-card-title class="d-flex align-center ga-2 border-b-sm">
                        <v-icon class="mr-2">{{ elementInfo[key].icon }}</v-icon>
                        <h2 class="text-body-1 font-weight-semibold">{{ elementInfo[key].name }}</h2>
                        <v-spacer></v-spacer>
                        <v-btn small color="primary">Create New</v-btn>
                    </v-card-title>

                    <v-card-text>
                        <p>Blah</p>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

    </v-container>
</template>

<script>
export default  {
    data: () => ({
        elements: {
            structures: [],
            features: [],
            unlinked: []
        },
        elementInfo: {
            structures: {name: "Structures", icon: "mdi-office-building"},
            features: {name: "Features", icon: "mdi-tree"},
            unlinked: {name: "Unlinked", icon: "mdi-link-variant-off"}
        }
    }),

    async mounted() {
        await window.appendLog("Sidebar mounted");
        this.elements = await window.scanAddon();
    },

    methods: {
        async scan() {
            this.elements = await window.scanAddon();
        }
    }
};
</script>