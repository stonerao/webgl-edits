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

        this.planeArr = [];

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
            color: new THREE.Color("#8f8f8f"),
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

        let thm = this;


        this.Flys.array = [];

        const ImgsType = [101];
        for (let i = 0; i < lines.length; i++) {
            const elem = lines[i];
            const { options, data, uuid } = elem;
            const { img, speed, size, dpi, length, type, color } = options;

            let _pimg = null;
            if (pointImg) _pimg = pointImg;
            if (img) _pimg = img;

            let _data = data.map((d) => new THREE.Vector3(d.x, d.y, d.z));

            // 曲线
            if (options.curve) {
                const curve = new THREE.CatmullRomCurve3(_data);
                _data = curve.getPoints(_data.length * 10);
            }


            const material = thm.lineHelpMaterial.clone();
            const geometry = new THREE.BufferGeometry();
            geometry.setFromPoints(_data);

            const line = new THREE.Line(geometry, material);
            thm.linesGroup.add(line);


            if (ImgsType.includes(type)) {
                const map = new THREE.TextureLoader().load(_pimg);
                const w = size * 2;
                const _geometry = new THREE.PlaneGeometry(w, w);
                const _material = new THREE.MeshBasicMaterial({
                    side: THREE.DoubleSide,
                    transparent: true,
                    color: new THREE.Color(color),
                    map: map
                });
                const plane = new THREE.Mesh(_geometry, _material);


                const totals = [];
                totals[0] = 0;
                for (let j = 1; j < _data.length; j++) {
                    totals[j] = _data[j - 1].distanceTo(_data[j]);
                }
                const g = new THREE.Group();

                g._data = _data;
                g._totals = totals;
                g._time = 0;
                g._index = 0;
                g._type = "plane";
                g._speed = speed;
                g.position.set(_data[0].x, _data[0].y, 1);

                g.add(plane);
                g.lookAt(new THREE.Vector3(_data[1].x, _data[1].y, 1));

                plane.rotation.y = -Math.PI / 2;
                plane.rotation.z = -Math.PI / 2;

                plane.renderOrder = 10;

                thm.planeArr.push(g);

                thm.flyGroup.add(g);

            } else {
                line.name = uuid;
                line.renderOrder = 5;
                line.position.y = 1;
                // 点 


                const flyMesh = thm.Flys.add({
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
                thm.flyGroup.add(flyMesh);
            }
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
        this.flyGroup && this.flyGroup.children.forEach((elem) => {
            if (notImg.includes(elem.name)) {
                elem.material.uniforms.u_map.value = t;
            }
        })
        this.planeArr && this.planeArr.forEach((elem) => {
            elem.children[0] && (elem.children[0].material.map = t);
        })
    }

    updateRayLine() {

        this.lines.geometry.setFromPoints(this.rayArr);

    }


    createLineGroup() {
        // 存储展示线条 
        this.planeArr = [];
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
        this.planeArr.forEach((elem) => {
            elem._time += dt * elem._speed;
            const index = elem._index % (elem._totals.length - 1);
            const nextI = elem._totals[index + 1];

            const curr = elem._data[index];
            const next = elem._data[index + 1];
            if (next) {
                const p = curr.clone().lerp(next, elem._time / nextI);
                const n = curr.clone().lerp(next, elem._time / nextI + 0.1);
                elem.position.copy(p);
                elem.lookAt(n);
                if (elem._time >= nextI) {
                    elem._index++;
                    elem._time = 0;
                }; 
            }
        })
    }
}
