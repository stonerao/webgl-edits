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
        this.isClick = true;

        this.group = new THREE.Group();

        this.modelGroup = new THREE.Group();
        this.labelGroup = new THREE.Group();


        this.box = new THREE.Box3();

        this.currNode = null;


        this.helpBox = null;
        this.helpBoxGroup = new THREE.Group();

        this.group.add(this.helpBoxGroup, this.modelGroup, this.labelGroup);

        this.init();

        // 加载模型
        const models = config.model.map((url) => config.modelUrl + url);
        this.loadModel(models, models);
    }

    init() {

    }

    updateMaterialOption(object) {
        this.currNode = object;

        Contact.selectNode(object);

        Transforms.setAttch(object);
    }

    /**
     * 加载模型，并且循环处理
     * @param {*} models 模型
     */
    loadModel(models, urlName) {
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
                    // 获取其他的uv通道
                    const uvsNames = Contact.getObjectUv(child);
                    // 给材质添加默认效果shdaer
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => {
                            this.handelMaterial(mat, uvsNames);
                        })
                    } else {
                        this.handelMaterial(child.material, uvsNames);
                    }
                }

                // 存储相关数据 用于导出
                child._urlName = urlName;
                child._option = {
                    urlName: urlName,
                    effects: [],
                    commons: []
                };
            });
            obj._urlName = urlName;
            obj._option = {
                urlName: urlName,
                effects: [],
                commons: []
            };
            obj._isTop = true;
            this.modelGroup.add(obj);
            this.pushEvent(eventArr);
            this.loadModel(models);
            Contact.updateTree();
        });
    }

    /**
     * 在材质的加载后修改，加上默认效果，根据type展示效果
     * @param {Object} material 材质
     * @param {Object} box 材质所在物体的box属性
     */
    handelMaterial(material, uvsNames) {
        material.onBeforeCompile = (shader) => {
            material._uniforms = shader.uniforms;
            material._shader = shader;
            Effect.setBeforeCompile(shader, uvsNames);
            material.needsUpdate = true;
        };
    }

    /**
     * 获取物体的大小、中间位置、box
     * @param {Object3D}} obj 物体
     * @returns {Object} 大小 中心 box
     */
    getModelBox(obj) {

        this.box.setFromObject(obj);

        const center = new THREE.Vector3();
        const size = new THREE.Vector3();

        this.box.getSize(size);
        this.box.getCenter(center);

        return {
            size: size,
            center: center,
            box: this.box
        };
    }

    // 款选当前box
    getBoxLine(obj) {
        if (this.helpBox) {
            this.helpBoxGroup.remove(this.helpBox);
            this.helpBox.material.dispose();

            this.helpBox = null;
        }
        const { size, center } = this.getModelBox(obj);
        const geometry = new THREE.BoxBufferGeometry(size.x, size.y, size.z, 1, 1, 1);


        const object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial(0xff0000));
        this.helpBox = new THREE.BoxHelper(object, 0xffff00);
        this.helpBoxGroup.position.copy(center);
        this.helpBoxGroup.rotation.copy(new THREE.Euler())
        this.helpBoxGroup.add(this.helpBox);
    }

    updateBoxLine(obj) {
        const { center } = this.getModelBox(obj);

        this.helpBoxGroup.position.copy(center);
        this.helpBoxGroup.rotation.copy(obj.rotation);
    }


    // 加入拾取数组
    pushEvent(arr) {
        if (!Array.isArray(arr)) return false;
        this.eventArray.push(...arr);
        this.config.renderers.updateEventArr(this);
    }

    getModelConfig() {
        const arr = [];
        this.modelGroup.traverse((child) => {
            if (child.uuid === this.modelGroup.uuid || child._isEffect) return false;
            if (child._option && child._option.effects.length !== 0) {
                child._option.effects.forEach((eff) => {
                    if (eff.type === 'add') {
                        const obj = child.getObjectByName(eff.name);
                        W3dUtils.toRgba(obj.material.color, obj.material.opacity);
                    }
                });
            }
            const option = Object.assign(child._option, {
                parent: child.isTop ? null : child.parent.name, // 父元素name
                name: child.name, // 当前name
                position: child.position.clone(),
                rotation: child.rotation,
                scale: child.scale,
                material: this.getMaterialConfig(child.material)
            });
            arr.push(option);
        });
        return arr;
    }

    getMaterialConfig(material) {
        if (!material) { return false }
        if (Array.isArray(material)) {
            const configs = [];
            material.forEach(mat => {
                configs.push(this.getMaterialOption(mat));
            });
            return configs;
        } else {
            return this.getMaterialOption(material);
        }
    }

    getMaterialOption(mat) {
        return {
            name: mat.name,
            side: mat.side,
            opacity: mat.opacity,
            blending: mat.blending,
            color: mat.color.getStyle(),
            wireframe: mat.wireframe,
            depthWrite: mat.depthWrite,
            depthTest: mat.depthTest,
            transparent: mat.transparent,
            visible: mat.visible
        }
    }


    onMouseIn(e, intersects) {
        // console.log('--onMouseIn--', e, intersects);
    }
    onMouseOut(e, intersects, key) {
        // console.log('--onMouseOut--', e, intersects, key);
    }
    onMouseDown(e, intersects) {
        if (intersects.length === 0) return;
        const obj = intersects[0].object;
        if (this.isClick) {
            this.getBoxLine(obj);
            this.updateMaterialOption(obj);
        }
    }
    onDblclick(e, intersects) {
        // console.log('--onDblclick--', e, intersects);
    }
    animate = (dt) => {
        this.timeVal.value += dt;
    }
}
