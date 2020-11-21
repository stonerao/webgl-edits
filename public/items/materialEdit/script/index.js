/**
 * 处理业务逻辑
 */
let clearOut;
const VM = new Vue({
    el: "#app",
    data() {
        return {
            layers: [],// 图层
            importShow: false, // 是否现在导入框
            importText: "", // 导入框文本
            currUUid: null,
            materials: [], // 材质
            materialsArr: [], // 存储model的材质
            // 可以更改的材质参数
            matOpts: {
                side: "Number",
                opacity: "Number",
                blending: "Number",
                // color: "Object",
                wireframe: "Boolean",
                depthWrite: "Boolean",
                depthTest: "Boolean",
                transparent: "Boolean",
                visible: "Boolean"
            },

            // 灯光设置
            lightShow: false,
            light: {
                Ambient: { // 环境光
                    color: '#ededed', strength: 0.8
                },
            }
        }
    },
    mounted() {

    },
    methods: {
        // 导出json
        exportEvent() {
            download("data.json", JSON.stringify(this.layers));
        },
        // 导入数据
        importEvent() {
            try {
                const data = JSON.parse(this.importText);
                if (data) {

                }
            } catch (err) {
                console.error(err);
            }
        },
        // 加载模型
        exportModel(file) {
            const target = file.target;
            const f = target.files[0];
            if (!f) return false;
            var dataURL = URL.createObjectURL(f)
            Models.loadModel([dataURL])
        },
        // 加载关闭弹框
        exportClose() {
            this.$confirm('确认关闭？')
                .then(_ => {
                    done();
                })
                .catch(_ => { });
        },
        updatedMaterial(meshName, materials, uuid) {
            // 读取传入材质的可修改信息
            this.materials = [];
            const keys = Object.keys(this.matOpts);
            for (let i = 0; i < materials.length; i++) {
                const elem = materials[i];
                const mat = {
                    mName: meshName,
                    name: elem.name,
                    type: elem.type,
                    uuid: elem.uuid,
                    color: elem.color.getStyle()
                };
                keys.forEach((key) => {
                    if (elem.hasOwnProperty(key)) {
                        mat[key] = elem[key];
                    }
                });
                this.materials.push(mat);
            }
            this.materialsArr = materials;

            this.currUUid = uuid;
            const uuids = this.layers.map((elem) => elem.uuid);
            if (!uuids.includes(uuid)) {
                this.layers.push({
                    uuid: uuid,
                    material: this.materials
                });
            }
        },
        updateMaterialVal() {
            const keys = Object.keys(this.matOpts);
            this.materialsArr.forEach((elem, i) => {
                const material = this.materials[i];
                keys.forEach((key) => {
                    if (elem.hasOwnProperty(key)) {
                        if (this.matOpts[key] === "Number") {
                            elem[key] = parseFloat(material[key]);
                        } else {
                            elem[key] = material[key];
                        }
                    }
                });
                // 监测颜色 设置颜色
                if (material.hasOwnProperty("color")) {
                    elem.color.setStyle(material.color);
                };
               
            });

            // 图层是否修改效果
            

            // 找到对应图层修改
            for (let i = 0; i < this.layers.length; i++) {
                const elem = this.layers[i];
                if (elem.uuid === this.currUUid) {
                    elem.material = JSON.parse(JSON.stringify(this.materials));
                    i = this.layers.length;
                }
            }
            
        }
    },
    components: {
        "c-scroll": scrollCom,
    },
    watch: {

    },
})

function download(filename, text) {

    var element = document.createElement('a');

    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';

    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

