class handelCamera extends EffectBase {
    constructor(config) {
        super(config);
        EffectBase.call(this, config);
        this.HelperObjects = [];
        this.group = new THREE.Group();

        this.data = [];

        this.init();
        this.isStart = false;
        this.aoptions = {
            index: 0,
            speed: 1,
            total: 0,
            position: [],
            target: []
        }
        this.time = { value: 0 };
        this.speed = 100;


        this.drag();
    }


    init() {
        this.editHlep = this.addShowGroup();

        this.dragMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color("#ff9999"),
            depthWrite:false,
            depthTest:false
        })
        this.dragMaterial1 = new THREE.MeshBasicMaterial({
            color: new THREE.Color("#999"),
            depthWrite: false,
            depthTest: false
        })
        this.dragGroup = new THREE.Group();

        this.group.add(this.editHlep, this.dragGroup);
    }

    drag() {
        const _this = this;
        function render() {
            renderers.renderer.render(renderers.scene, renderers.camera)
        }

        this.transformControl = null;


        renderers.controls.damping = 0.2;
        renderers.controls.addEventListener('change', render);

        renderers.controls.addEventListener('start', function () {
            cancelHideTransform();
        });

        renderers.controls.addEventListener('end', function () {
            delayHideTransform();
        });


        this.transformControl = new THREE.TransformControls(renderers.camera, renderers.renderer.domElement);
        this.transformControl.addEventListener('change', render);
        this.transformControl.addEventListener('dragging-changed', function (event) {
            _this.dragUpdateLine();
            renderers.controls.enabled = !event.value;

        });

        this.group.add(this.transformControl);
        // ----------
        var dragcontrols = new THREE.DragControls(this.HelperObjects, renderers.camera, renderers.renderer.domElement); //
        dragcontrols.enabled = false;
        dragcontrols.addEventListener('hoveron', (event) => {
            _this.dragUpdateLine();
            this.transformControl.attach(event.object);
            cancelHideTransform();

        });

        dragcontrols.addEventListener('hoveroff', () => {
            _this.dragUpdateLine();
            delayHideTransform();

        });

        var hiding;

        function delayHideTransform() {

            cancelHideTransform();
            hideTransform();

        }

        function hideTransform() {

            hiding = setTimeout(() => {
                /*  console.log(f) */
                _this.transformControl.detach();
            }, 2500);

        }

        function cancelHideTransform() {

            if (hiding) clearTimeout(hiding);

        }
    }

    // 添加显示组
    addShowGroup() {
        const group = new THREE.Group();

        // 相机position连线
        const cgeometry = new THREE.BufferGeometry();
        const cmaterial = new THREE.LineBasicMaterial({
            color: 0xff5555,
            transparent: true,
            depthWrite: false,
            depthTest: false
        });
        const cline = new THREE.Line(cgeometry, cmaterial);
        cline.name = "position";
        cline.renderOrder = 10;

        const tgeometry = new THREE.BufferGeometry();
        const tmaterial = new THREE.LineBasicMaterial({
            color: 0x5555ff,
            transparent: true,
            depthWrite: false,
            depthTest: false
        });
        const tline = new THREE.Line(tgeometry, tmaterial);
        tline.name = "target";
        tline.renderOrder = 10;

        group.add(cline, tline);

        return group;
    }
    getCurve(data) {

        const curve = new THREE.CatmullRomCurve3(data);

        const points = curve.getPoints(data.length * 20);

        return points;
    }
    dragUpdateLine() {
        const child = this.dragGroup.children;
        for (let i = 0; i < child.length; i++) {
            const elem = child[i];
            const index = elem._index;
            const type = elem._type;
            if (type === 1) {
                this.data[index].position = elem.position;

            } else {
                this.data[index].target = elem.position;
            }


        }
        this.updateShowGroup(this.data, this.editHlep);
    }

    updateShowGroup(data, group) {

        const cposition = [];
        const tposition = [];
        for (let i = 0; i < data.length; i++) {
            const elem = data[i];
            cposition.push((new THREE.Vector3()).copy(elem.position));
            tposition.push((new THREE.Vector3()).copy(elem.target));
        }

        group.children.forEach((child) => {
            if (child.name === "position") {
                child.geometry.setFromPoints(this.getCurve(cposition));
            } else if (child.name === "target") {
                child.geometry.setFromPoints(this.getCurve(tposition));
            }
        });

    }


    updateShowLine(data) {
        this.data = data;
        this.updateShowGroup(data, this.editHlep);

        this.addDragBox(data);
    }

    startCamera(data) {
        const cposition = [];
        const tposition = [];
        for (let i = 0; i < data.length; i++) {
            const elem = data[i];
            cposition.push((new THREE.Vector3()).copy(elem.position));
            tposition.push((new THREE.Vector3()).copy(elem.target));
        }
        this.aoptions.position = this.getCurve(cposition);
        this.aoptions.target = this.getCurve(tposition);
        this.isStart = true;
    }

    updateCamera() {

        const { index, position, target, speed } = this.aoptions;
        const cur = Math.floor(index) % position.length;
        const next = index + 1;
        if (position.length === next) {
            this.isStart = false;
            this.aoptions.index = 0;
            this.time.value = 0;
            return false;
        };
        const length = position[cur].distanceTo(position[next]);
        let _i = this.time.value / length;
        if (_i > 1) {
            this.aoptions.index++;
            this.time.value -= length;
        }
        _i = _i > 1 ? 1 : _i;
        const p = position[cur].clone().lerp(position[next], _i);
        const t = target[cur].clone().lerp(target[next], _i);
        renderers.camera.position.copy(p)
        renderers.controls.target.copy(t)
    }


    addDragBox(data) {
        this.transformControl.detach();
        const child = this.dragGroup.children;

        for (let i = child.length - 1; i >= 0; i--) {
            child[i].geometry.dispose();
            this.dragGroup.remove(child[i]);
            this.HelperObjects.pop();
        };
        for (let i = 0; i < this.HelperObjects.length; i++) {
            this.HelperObjects.pop();

        }

        const geometry = new THREE.BoxGeometry(10, 10, 10);

        for (let i = 0; i < data.length; i++) {
            const elem = data[i];
            const ccube = new THREE.Mesh(geometry, this.dragMaterial);
            ccube.position.copy(elem.position);
            ccube._name = "ccube";
            ccube._index = i;
            ccube._type = 1;

            const tcube = new THREE.Mesh(geometry, this.dragMaterial1);
            tcube.position.copy(elem.target);
            tcube._name = "tcube";
            tcube._index = i;
            tcube._type = 2;

            this.HelperObjects.push(ccube, tcube);
            this.dragGroup.add(ccube, tcube);
        }

    }


    dispose() {
        this.data = [];
        this.transformControl.detach();
        const child = this.dragGroup.children;
        for (let i = child.length - 1; i >= 0; i--) {
            child[i].geometry.dispose();
            this.dragGroup.remove(child[i]);
            this.HelperObjects.pop();
        };
        for (let i = 0; i < this.HelperObjects.length; i++) {
            this.HelperObjects.pop();

        }
        this.editHlep.children.forEach((child) => {
            child.geometry.setFromPoints([]);
        });
        this.isStart = false;
    }


    animate = (dt) => {
        if (this.isStart) {
            this.updateCamera();
            this.time.value += dt * this.speed;
        }
    }
}
