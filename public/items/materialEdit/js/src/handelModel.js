function loadFbx(url, callback) {
    const loader = new THREE.FBXLoader();
    loader.load(url, function (obj) {
        callback(obj);
    });
}

class handelModel extends EffectBase {
    constructor(config) {
        super(config);
        EffectBase.call(this, config);

        this.timeVal = { value: 0 };

        this.group = new THREE.Group();

        this.modelGroup = new THREE.Group();
        this.labelGroup = new THREE.Group();

        this.helpBox = null;
        this.helpBoxGroup = new THREE.Group();

        this.group.add(this.helpBoxGroup, this.modelGroup, this.labelGroup);

        this.init();

        // 加载模型
        const models = config.model.map((url) => config.modelUrl + url);
        this.loadModel(models);
    }

    init() {

    }

    updateMaterialOption(object) {
        const { material, name, uuid } = object;
        const materials = [];
        if (Array.isArray(material)) {
            material.forEach((mat) => {
                materials.push(mat);
            })
        } else {
            materials.push(material);
        }

        VM.updatedMaterial(name, materials, uuid);
    }

    /**
     * 加载模型，并且循环处理
     * @param {*} models 模型
     */
    loadModel(models) {
        if (models.length === 0) {
            // 加载所有模型完毕
            return false
        };
        const url = models.shift();
        loadFbx(url, (obj) => {
            const eventArr = [];
            obj.traverse((child) => {
                if (child.geometry) {
                    eventArr.push(child);
                }

                if (child.material) {
                    // 给材质添加默认效果shdaer
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => {
                            this.handelMaterial(mat);
                        })
                    } else {
                        this.handelMaterial(child.material);
                    }
                }
            });
            this.modelGroup.add(obj);
            this.pushEvent(eventArr);
            this.loadModel(models);
        });
    }

    /**
     * 在材质的加载后修改，加上默认效果，根据type展示效果
     * @param {Object} material 材质
     * @param {Object} box 材质所在物体的box属性
     */
    handelMaterial(material, box) {
        material.onBeforeCompile = (shader) => {
            material._uniforms = shader.uniforms;
            Effect.setBeforeCompile(shader);
        };
    }

    /**
     * 获取物体的大小、中间位置、box
     * @param {Object3D}} obj 物体
     * @returns {Object} 大小 中心 box
     */
    getModelBox(obj) {
        const box = new THREE.Box3();
        box.setFromObject(obj);

        const center = new THREE.Vector3();
        const size = new THREE.Vector3();

        box.getSize(size);
        box.getCenter(center);

        return {
            size: size,
            center: center,
            box: box
        };
    }

    // 加入拾取数组
    pushEvent(arr) {
        if (!Array.isArray(arr)) return false;
        this.eventArray.push(...arr);
        this.config.renderers.updateEventArr(this);
    }

    onMouseIn(e, intersects) {
        // console.log('--onMouseIn--', e, intersects);
    }
    onMouseOut(e, intersects, key) {
        // console.log('--onMouseOut--', e, intersects, key);
    }
    onMouseDown(e, intersects) {
        if (intersects.length === 0) return;
        if (this.helpBox) {
            this.helpBoxGroup.remove(this.helpBox);
            this.helpBox.material.dispose();
            this.helpBox = null;
        }
        const obj = intersects[0].object;

        const object = new THREE.Mesh(obj.geometry, new THREE.MeshBasicMaterial(0xff0000));
        this.helpBox = new THREE.BoxHelper(object, 0xffff00);
        const local = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();

        obj.localToWorld(local);
        obj.getWorldScale(scale);
        obj.getWorldQuaternion(quaternion);

        this.helpBoxGroup.setRotationFromQuaternion(quaternion);

        this.helpBoxGroup.position.copy(local);
        this.helpBoxGroup.scale.copy(scale);
        // this.helpBoxGroup.rotation.add(obj.rotation);

        this.helpBoxGroup.add(this.helpBox);

        this.updateMaterialOption(obj);
    }
    onDblclick(e, intersects) {
        // console.log('--onDblclick--', e, intersects);
    }
    animate = (dt) => {
        this.timeVal.value += dt;
    }
}
