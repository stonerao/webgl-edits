/**
 * 处理业务逻辑
 */
let clearOut;
console.log(window.EffectCom)
const VM = new Vue({
    el: "#app",
    data() {
        return {
            layers: [],// 图层
            importShow: false, // 是否现在导入框
            importText: `{"comments":[{"id":0,"name":"光罩","icon":"","func":"CreatBlitzball","zIndex":1,"options":{"blitzball":[{"type":0,"points":[[0,0,0]],"radius":120,"wSeg":50,"hSeg":50,"phiLength":6.283185307179586,"thetaLength":1.5707963267948966,"density":4,"colors":["#ff3879","#a8ff4e","#68ebff"],"opacity":1}]},"position":{"x":178.72297854718462,"y":99.65451005980854,"z":161.13730843978092}},{"id":1,"name":"光罩1","icon":"","func":"CreatBlitzball","zIndex":1,"options":{"blitzball":[{"type":1,"points":[[0,0,0]],"radius":120,"wSeg":50,"hSeg":50,"phiLength":6.283185307179586,"thetaLength":1.5707963267948966,"density":4,"colors":["#ff3879","#a8ff4e","#68ebff"],"opacity":1}]},"position":{"x":-201.25416202809444,"y":99.38719688167635,"z":225.7263386879874}}],"model":[{"urlName":"01.FBX","effects":[],"commons":[],"parent":"","name":"001","position":{"x":-13.231704711914062,"y":58.6907958984375,"z":-11.675125122070312},"rotation":{"_x":-1.5707963267948963,"_y":0,"_z":0,"_order":"XYZ"},"scale":{"x":1,"y":1,"z":1},"material":false},{"urlName":"01.FBX","effects":[],"commons":[],"parent":"001","name":"环球中兴02","position":{"x":0.8805084228515625,"y":-4.0449981689453125,"z":-58.6907958984375},"rotation":{"_x":0,"_y":0,"_z":0,"_order":"XYZ"},"scale":{"x":1,"y":1,"z":1},"material":[{"name":"_环球中心Material__25","side":0,"opacity":1,"blending":1,"color":"rgb(149,149,149)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"Material #25","side":0,"opacity":1,"blending":1,"color":"rgb(149,149,149)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"21 - Default","side":0,"opacity":1,"blending":1,"color":"rgb(244,221,69)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"白色顶","side":0,"opacity":1,"blending":1,"color":"rgb(255,255,255)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"Material #152","side":0,"opacity":1,"blending":1,"color":"rgb(149,149,149)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"Material #177","side":0,"opacity":1,"blending":1,"color":"rgb(149,149,149)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"Material #190","side":0,"opacity":1,"blending":1,"color":"rgb(149,149,149)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"Material #271","side":0,"opacity":1,"blending":1,"color":"rgb(149,149,149)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"Material #565","side":0,"opacity":1,"blending":1,"color":"rgb(149,149,149)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true}]},{"urlName":"01.FBX","effects":[{"id":2,"type":"add","name":"边框线","color":"rgba(126,219,255, 1)"}],"commons":[],"parent":"001","name":"环球中兴01","position":{"x":0.8805084228515625,"y":-4.0449981689453125,"z":-58.6907958984375},"rotation":{"_x":0,"_y":0,"_z":0,"_order":"XYZ"},"scale":{"x":1,"y":1,"z":1},"material":[{"name":"_环球中心Material__63","side":0,"opacity":1,"blending":1,"color":"rgb(255,0,0)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"白色顶","side":0,"opacity":1,"blending":1,"color":"rgb(255,7,7)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"21 - Default","side":0,"opacity":1,"blending":1,"color":"rgb(244,221,69)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"15 - Default","side":0,"opacity":1,"blending":1,"color":"rgb(240,16,16)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"09 - Default","side":0,"opacity":1,"blending":1,"color":"rgb(219,230,208)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"Material #296","side":0,"opacity":1,"blending":1,"color":"rgb(149,149,149)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"10 - Default","side":0,"opacity":1,"blending":1,"color":"rgb(191,214,248)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"Material #626","side":0,"opacity":1,"blending":1,"color":"rgb(149,149,149)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true},{"name":"Material #25ss","side":0,"opacity":1,"blending":1,"color":"rgb(149,149,149)","wireframe":false,"depthWrite":true,"depthTest":true,"transparent":false,"visible":true}]}]}`, // 导入框文本
            currUUid: null,
            currObject: null,
            objOpts: {
                name: "",
                scale: { x: 1, y: 1, z: 1 },
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                size: { x: 0, y: 0, z: 0 },// 展示当前box的大小 无法修改
                visible: true,
                effect: 0,
                script: ``,// 注入代码
                userData: ``// 自定义数据
            },
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
            },
            treeData: [],

            ctrlType: 1,
            layerType: 3,

            effectComs: window.EffectCom,
            exportEffectComs: [],// 存储导出组件效果库
        }
    },
    mounted() {

    },
    methods: {
        // 导出json
        exportEvent() { 
            const data = {
                comments: this.exportEffectComs,
                model: Models.getModelConfig()
            };
            console.log(JSON.stringify(data))
            console.log(data)
            // download("data.json", JSON.stringify(data));
        },
        // 导入数据
        importEvent() {
            try {
                const data = JSON.parse(this.importText);
                if (data) {
                    this.exportEffectComs.push(...data.comments);
                    Parse.parse(data)
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
            var dataURL = URL.createObjectURL(f);
            Models.loadModel([dataURL], f.name);
        },
        // 加载关闭弹框
        exportClose() {
            this.$confirm('确认关闭？')
                .then(_ => {
                    done();
                })
                .catch(_ => { });
        },
        updateSelectNode(object) {
            this.currObject = object;
            // 更新信息到变量objOpts中
            W3dUtils.setObjectVal(this.objOpts, {
                name: object.name,
                scale: object.scale,
                position: object.position,
                rotation: object.rotation,
                size: { x: 0, y: 0, z: 0 },// 展示当前box的大小 无法修改
                visible: object.visible,
                effect: object._effect || 0,
                script: object._script || ``,// 注入代码
                userData: object.userData// 自定义数据
            });
        },
        updatedMaterial(meshName, materials, uuid, uvs) {
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
                    uvs: uvs,
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

        },
        // 更新树列表
        updateTree(tree) {
            this.treeData = tree;
        },
        EffectComEvent() {

        },
        // 在模型shader中添加效果
        EffectEffectvent(option) {
            if (!Models.currNode) {
                return
            }

            Effect.setObjectEffect(Models.currNode, option);
        },
        uploadUvTexture(fileinput, uv) {
            this.fileImg(fileinput, (opts) => {
                const map = new THREE.TextureLoader().load(opts.img);
                this.materialsArr.forEach(mat => {
                    if (mat._uniforms) {
                        mat._uniforms[`u_map_${uv}`].value = map;
                        mat._uniforms[`_${uv}`].value = 1.0;
                        console.log(mat);
                    }
                })
            });
        },
        // 上传图片
        fileImg(fileinput, callback) {
            const file = fileinput.target;
            // getBase64()
            if (!file.files[0]) return false;
            var dataURL = URL.createObjectURL(file.files[0])    // 创建URL对象

            getBase64(dataURL, (opts) => {
                callback(opts);
            })
        }, 
        // drag
        drag(event, data) { 
            event.dataTransfer.setData("data", JSON.stringify(data));
           
        },
        drop(event) {
            event.preventDefault();
            const data = event.dataTransfer.getData("data");
            try {
                const tdata = JSON.parse(data);
                // 获取
                const inters = renderers._Events.getIntersects(event);
                const position = new THREE.Vector3();
                if (inters.length !== 0) {
                    const point = inters[0].point;
                    position.copy(point);
                }; 
               
                Effect.createCommEffect(tdata, position);

                this.exportEffectComs.push(Object.assign(tdata, {
                    position: position.clone()
                }));

            } catch (err) {

            }
        },
        allowDrop(event) {
            event.preventDefault(); 
        }
    },
    components: {
        "c-scroll": scrollCom,
        // "c-tree": treeCom,
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




function getBase64(url, callback) {
    //通过构造函数来创建的 img 实例，在赋予 src 值后就会立刻下载图片，相比 createElement() 创建 <img> 省去了 append()，也就避免了文档冗余和污染
    var Img = new Image(),
        dataURL = '';
    Img.src = url;
    Img.onload = function () { //要先确保图片完整获取到，这是个异步事件
        var canvas = document.createElement("canvas"), //创建canvas元素
            width = Img.width, //确保canvas的尺寸和图片一样
            height = Img.height;
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(Img, 0, 0, width, height); //将图片绘制到canvas中
        dataURL = canvas.toDataURL('image/png'); //转换图片为dataURL
        callback({
            img: dataURL,
            width: width,
            height: height
        })
    };
}
