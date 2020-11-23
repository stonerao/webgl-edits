/**
 * 处理业务逻辑
 */
let clearOut;
const VM = new Vue({
    el: "#app",
    data() {
        return {
            cameraOpts: [
                { name: "透视相机", id: 1 },
                { name: "正交相机", id: 2 }
            ],
            cameraVal: 1,
            scenePosition: { x: 0, y: 0, z: 0 },
            // 可以添加的效果列表
            addList: options.effects,
            currData: [],
            currType: 1,
            types: [
                { name: "相机", id: 1 }
            ],
            models: [
                { name: "视角", id: 0 },
                { name: "打点", id: 1 }
            ],
            modelId: 0,
            speed: 100,
            layers: [],// 图层
            isEdit: false,
            editId: null,
            importShow: false,
            importText: "",
            featuresCss: {
                left: 0,
                top: 0
            },
            features: {
                state: false,
                isDel: false
            },
            editNameUuid: null,
            isKeyDown: false,
            keyDownPoint: [],// 按下ctrl后点击的点
        }
    },
    mounted() {
        setTimeout(() => {
            console.log(Models)
        }, 1000);

        window.addEventListener("keydown", (e) => {
            if (e.keyCode == 17) {
                this.isKeyDown = true;
            }
        })
        window.addEventListener("keyup", (e) => {
            this.isKeyDown = false;
            if (this.keyDownPoint.length > 1) {
                this.addLinkLine();
            }
        })
    },
    methods: {
        cameraAdd() {
            const position = renderers.camera.position.clone();
            const target = renderers.controls.target.clone();
            this.currData.push({
                position,
                target
            });
            if (this.currData.length > 1) {
                Cameras.updateShowLine(this.currData);
            }
        },
        cameraSave() {
            if (Cameras.data.length < 2) return false;
            this.layers.push({
                uuid: THREE.Math.generateUUID(),
                data: Cameras.data,
                type: "camera",
                name: "camera" + (this.layers.length + 1)
            });
            this.currData = [];
            // 清空
            Cameras.dispose();
        },
        cameraReplay() {
            Cameras.startCamera(this.currData);
        },
        // 编辑相机
        cameraEdit() {
            // 修改当前相机  
            let isEdit = false;
            for (let i = 0; i < this.layers.length; i++) {
                const elem = this.layers[i];
                if (elem.uuid === this.editId) {
                    isEdit = true;
                    elem.data = Cameras.data;
                    this.currData = [];
                    Cameras.dispose();
                }
            }
            // 如果无法找到 则重新添加
            if (!isEdit) {
                this.cameraSave();
            }
            this.isEdit = false;
        },
        exportEvent() {
            download("data.json", JSON.stringify(this.layers))
        },
        exportEventLine() {
            download("data.json", JSON.stringify(this.layers.filter(e => e.type == 'line')));
        },
        // 修改
        editItem(item) {
            // 清空
            Cameras.dispose();
            this.currData = item.data;
            this.editId = item.uuid;
            if (item.data.length > 1) {
                Cameras.updateShowLine(item.data);
            }
            this.isEdit = true;
        },
        // 删除
        delItem(index) {
            const item = this.layers[index];
            if (item.type == "point") {
                this.delPoint(item.uuid);
            }
            this.layers.splice(index, 1);

            if (item.type == "line") {
                this.updateLine();
            }
        },
        exportClose() {
            this.$confirm('确认关闭？')
                .then(_ => {
                    done();
                })
                .catch(_ => { });
        },
        importEvent() {
            try {
                const data = JSON.parse(this.importText);
                if (data) {
                    this.layers = data;
                    this.importShow = false;
                    for (let i = 0; i < data.length; i++) {
                        const elem = data[i];
                        if (elem.type === "point") {
                            Points.addPoint(elem.data, elem.uuid);
                        } else if (elem.type === "line") {
                            this.updateLine();
                        }
                    }
                }
            } catch (err) {
                console.error(err);
            }
        },
        // 添加点位
        addPoint() {
            this.features.state = false;
            const intersect = store.state.intersect;
            const uuid = THREE.Math.generateUUID();
            this.layers.push({
                uuid: uuid,
                data: intersect.point.clone(),
                type: "point",
                name: "point" + (this.layers.length + 1)
            });

            Points.addPoint(intersect.point, uuid);
        },
        // 添加连线
        addLinkLine() {
            const line = this.keyDownPoint.map((point) => {
                return point;
            });
            const uuid = THREE.Math.generateUUID();
            this.layers.push({
                uuid: uuid,
                data: line,
                type: "line",
                name: "line" + (this.layers.length + 1)
            });

            this.updateLine();

            Points.updateActiveLine([]);
            this.keyDownPoint = [];
        },
        // 更新线条数据
        updateLine() {
            const lines = this.layers
                .filter((layer) => layer.type === "line")
                .map((layer) => layer.data);
            Points.updateLine(lines);
        },
        // 按下ctrl选中节点
        selectNodes(e, intersect) {
            this.keyDownPoint.push(intersect.object.position.clone());
            Points.updateActiveLine(this.keyDownPoint);
        },
        featuresEvent(e, intersect) {
            this.featuresCss = {
                left: e.x + "px",
                top: e.y + "px"
            };
            this.features.state = true;
            clearTimeout(clearOut);
            clearOut = setTimeout(() => {
                this.features.state = false;
            }, 2000);

            // 
        },
        delPoint(uuid) {
            let isUpdateLayer = false;
            if (!uuid) {
                const intersect = store.state.intersect;
                uuid = intersect.object.name;
                isUpdateLayer = true;
            }
            if (uuid) {
                Points.delPoint(uuid);
                if (isUpdateLayer) {
                    this.layers = this.layers.filter(elem => elem.uuid != uuid)
                }
            }
            this.features.state = false;
        },
        exportModel(file) {
            const target = file.target;
            const f = target.files[0];
            if (!f) return false;
            var dataURL = URL.createObjectURL(f)
            Models.loadModel([dataURL]);

        },
        setItemName(item) {
            this.editNameUuid = item.uuid;
        },
        selectPoint(item) {
            Points.showPoint(item.uuid);
        }
    },
    components: {
        "c-scroll": scrollCom,
    },
    watch: {
        cameraVal(val) {
            renderers.tabCamera(val);
        },
        speed(val) {
            if (val) {
                Cameras.speed = val;
            }
        },
        ['scenePosition.x'](val) {
            if (isNaN(parseFloat(val))) return false;
            renderers.scene.position.x = parseFloat(val);
        },
        ['scenePosition.y'](val) {
            if (isNaN(parseFloat(val))) return false;
            renderers.scene.position.y = parseFloat(val);
        },
        ['scenePosition.z'](val) {
            if (isNaN(parseFloat(val))) return false;
            renderers.scene.position.z = parseFloat(val);
        },
        modelId(val) {
            switch (val) {
                case 0:

                    break;
                case 1:
                    this.cameraSave();
                    break;
            }
            this.features.state = false;
        },
        ['features.state'](val) {
            if (val == false) {
                this.features.isDel = false;
            }
        }
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

