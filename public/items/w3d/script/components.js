
const scrollCom = {
    template: `
    <template>
        <div ref="scroll" class="full">
            <slot name="main"></slot>
        </div>
    </template>
    `,
    data() {
        return {
            ps: null,
        };
    },
    mounted() {
        const container = this.$refs["scroll"];
        this.ps = new PerfectScrollbar(container, {
            wheelSpeed: 0.5,
            wheelPropagation: true,
            minScrollbarLength: 1,
        });

        setTimeout(() => {
            this.ps.update();
        }, 200);
    },
    methods: {
        update() {
            this.ps.update();
        },
        destroy() {
            this.ps.destroy();
            this.ps = null;
        },
        updateTop() {
            this.$refs["scroll"].scrollTop = 0;
            this.update();
        },
        updateTopEvent(top) {
            this.$refs["scroll"].scrollTop = top;
            this.update();
        }
    }
}


Vue.component("c-tree", {
    template: `
    <template>
        <div class="tree-items"> 
            <div class="tree-name" @click="clickNode"> 
                {{items.name || "undefined"}}
            </div>
            <div class="tree-item">
                <c-tree v-for="(item,index) in items.children" :key="index" :items="item">
                </c-tree>
            </div>
        </div>
    </template>
    `,
    props: {
        items: Object
    },
    data: function () {
        return {

        };
    },
    mounted() {
       
    },
    methods: {
        clickNode() { 
            // 
            Contact.getObjectById(this.items.uuid);
        }
    }
});
