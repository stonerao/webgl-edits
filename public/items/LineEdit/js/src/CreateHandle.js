{
    const effectTypes = [];
}
class HandleEffect extends EffectBase {
    constructor(config) {
        super(config);
        EffectBase.call(this, config);
        this.group = new THREE.Group();

        this.Flys = new InitFlys({
            img: './images/point.png'
        });
        this.background = null;

        this.rayArr = []; // 拾取数组

        this.init();

        /*  this.setBackground({
             img: './images/bg.png',
             width: 2004,
             height: 1258
         }) */
    }

    init() {
        this.helps = new THREE.Group();

        this.lines = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({
                color: 0xffffff,
                // depthWrite: false,
                // depthTest: false,
                transparent: true
            })
        );

        this.helpLine = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({
                color: 0x9CB8A7,
                // depthWrite: false,
                // depthTest: false,
           /*      transparent: true,
                opacity: 0.6 */
            })
        );
        this.helpLine.renderOrder = 5;
        this.lines.renderOrder = 5;

        this.lineHelpMaterial = new THREE.LineBasicMaterial({
            color: new THREE.Color("#ff0000"),
            // depthWrite: false,
            // depthTest: false,
            // transparent: true,
            // opacity: 0.9
        });

        this.helps.add(this.lines, this.helpLine);
        this.helps.position.y = 1;
        this.group.add(this.helps);
    }

    // 取消拾取
    quitRay() {
        // this.updateRayLine();
        if (this.rayArr.length > 1) {
            const state = StateManage.state;
            const lines = state.lines;
            const uuid = THREE.Math.generateUUID();
            lines.push({
                uuid: uuid,
                data: this.rayArr,
                options: {
                    img: null, // 粒子图
                    curve: state.flyOpts.curve, // 是否曲线
                    speed: parseFloat(state.flyOpts.speed), // 速度
                    size: parseFloat(state.flyOpts.size), // 粒子大小
                    dpi: parseFloat(state.flyOpts.dpi), // 粒子密度
                    length: parseFloat(state.flyOpts.length), // 粒子长度
                    type: parseFloat(state.flyOpts.type), // 粒子样式类型
                    color: state.flyOpts.color, // 颜色
                }
            });
            this.updateLine();
        }
        this.rayArr = [];
        this.helpLine.geometry.setFromPoints([]);
        this.lines.geometry.setFromPoints([]);
    }


    // 更新线条
    updateLine() {
        const { lines, pointImg } = StateManage.state;

        this.createLineGroup();
        this.Flys.array = [];
        for (let i = 0; i < lines.length; i++) {
            const elem = lines[i];
            const { options, data, uuid } = elem;
            const material = this.lineHelpMaterial.clone();
            const geometry = new THREE.BufferGeometry();

            let _data = data.map((d) => new THREE.Vector3(d.x, d.y, d.z));

            // 曲线
            if (options.curve) {
                const curve = new THREE.CatmullRomCurve3(_data);
                _data = curve.getPoints(_data.length * 10);
            }

            geometry.setFromPoints(_data);

            const line = new THREE.Line(geometry, material);

            line.name = uuid;
            line.renderOrder = 5;
            line.position.y = 1;
            // 点 

            this.linesGroup.add(line);

            const { img, speed, size, dpi, length, type, color } = options;
            let _pimg = null;
            if (pointImg) _pimg = pointImg;
            if (img) _pimg = img;
            const flyMesh = this.Flys.add({
                img: _pimg,
                data: _data,
                speed,
                size,
                dpi,
                length,
                type,
                color: new THREE.Color(color),
                repeat: Infinity,
                material: {
                    depthWrite: false,
                    blending: 2
                },
                onComplete: function () {
                },
                onRepeat(val) {
                }
            });
            flyMesh.name = elem.uuid;
            this.flyGroup.add(flyMesh);
        }
    }

    showLine(uuid) {
        this.linesGroup.children.forEach((elem) => {
            if (elem.name === uuid) {
                elem.material.color = new THREE.Color("#ff5555");
            } else {
                elem.material.color = new THREE.Color("#d1ffbe");
            }
        })
    }

    setFlyImg(img) {
        // 更新飞线材质
        const lines = StateManage.state.lines;
        const notImg = lines.filter(elem => elem.options.img === null).map(elem => elem.uuid);
        const t = new THREE.TextureLoader().load(img);
        this.flyGroup.children.forEach((elem) => {
            if (notImg.includes(elem.name)) {
                elem.material.uniforms.u_map.value = t;
            }
        })
    }

    updateRayLine() {

        this.lines.geometry.setFromPoints(this.rayArr);

    }


    createLineGroup() {
        // 存储展示线条 
        this.linesGroup && this.config.renderers.disposeObj(this.linesGroup);
        this.flyGroup && this.config.renderers.disposeObj(this.flyGroup);

        this.linesGroup = new THREE.Group();
        this.flyGroup = new THREE.Group();

        this.linesGroup.name = "linesGroup";
        this.flyGroup.name = "flyGroup";

        this.group.add(this.linesGroup, this.flyGroup);
    }

    setBackground(opts) {
        if (this.background === null) {
            this.background = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1, 1, 1),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true
                    // side: THREE.DoubleSide
                })
            );
            this.group.add(this.background);
            this.eventArray.push(this.background);
        }
        const map = new THREE.TextureLoader().load(opts.img);
        this.background.material.map = map;
        this.background.renderOrder = 0;
        this.background.scale.set(opts.width, opts.height, 1)

        // 
        this.config.renderers.updateEventArr(this);
        console.log(this.config.renderers.camera)
    }

    // 添加效果 效果参数 
    addEffect(opts) {
        // 判断是否是THREE类型
        const hasType = this.isFunction(THREE[opts.type]);

        if (hasType) {
            const parms = Object.keys(opts.option).map((key) => opts.option[key])
            const funNanem = `new THREE.${opts.type}(${parms})`;

            // const geometry = new THREE[opts.type];
            const geometry = eval(funNanem);

        }
    }
    toFixed(val, num = 2) {
        return parseFloat(parseFloat(val).toFixed(num));
    }
    onMouseIn(e, intersects) {
        // console.log('--onMouseIn--', e, intersects);
        if (StateManage.state.isKeyCtrl && this.rayArr.length > 0) {
            const intersect = intersects[0];
            const point = intersect.point;

            const src = this.rayArr[this.rayArr.length - 1];
            const dst = new THREE.Vector3(point.x, point.y, 1);

            this.helpLine.geometry.setFromPoints([src, dst]);
        }
    }
    onMouseOut(e, intersects, key) {
        // console.log('--onMouseOut--', e, intersects, key);
    }
    onMouseDown(e, intersects) {
        if (e.buttons === 1 && StateManage.state.isKeyCtrl) {
            const intersect = intersects[0];
            const point = intersect.point;
            const vec = new THREE.Vector3(this.toFixed(point.x), this.toFixed(point.y), 1);
            this.rayArr.push(vec);
            this.updateRayLine();
        }
    }
    onDblclick(e, intersects) {
        // console.log('--onDblclick--', e, intersects);
    }
    animate = (dt) => {
        this.Flys.animation(dt);
    }
}
