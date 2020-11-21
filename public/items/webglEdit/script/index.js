
/**
 * 处理业务逻辑
 */
const VM = new Vue({
    el: "#app",
    data() {
        return {
            cameraOpts: [
                { name: "透视相机", id: 1 },
                { name: "正交相机", id: 2 }
            ],
            cameraVal: 1,
            // 可以添加的效果列表
            addList: options.effects
        }
    },
    mounted() {
        setTimeout(() => {
            effectHandle.addEffect(this.addList[0]);
        },1000)
    },
    methods: {
        // 添加效果
        addEffect(opts) {
            effectHandle.addEffect(opts);
        }
    },
    components: {
        "c-scroll": scrollCom,
    },
    watch: {
        cameraVal(val) {
            renderers.tabCamera(val);
        }
    },
})