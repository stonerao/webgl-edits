class handelPointy extends EffectBase {
    constructor(config) {
        super(config);
        EffectBase.call(this, config);

        this.group = new THREE.Group();

        this.dfSize = 1;
        this.init();

        this.timeOut = null;
    }

    init() {
        this.basicMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            depthWrite: false
        });
        this.activeMaterial = new THREE.MeshBasicMaterial({
            color: 0xff8888,
            depthWrite: false
        });

        this.nodeGeo = new THREE.BoxGeometry(1, 1, 1);

        // 连线
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            depthTest: false
        });
        const lineActiveMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            depthTest: false
        });

        const lineGeo = new THREE.BufferGeometry();
        const lineActiveGeo = new THREE.BufferGeometry();

        this.line = new THREE.LineSegments(lineGeo, lineMaterial);
        this.lineActive = new THREE.LineSegments(lineActiveGeo, lineActiveMaterial);
        this.group.add(this.line, this.lineActive)

        this.line.renderOrder = 50;
        this.lineActive.renderOrder = 50;
    }

    updateLine(data) {
        const points = [];
        data.forEach((elem) => {
            for (let i = 0; i < elem.length - 1; i++) {
                const curr = (new THREE.Vector3()).copy(elem[i]);
                const next = (new THREE.Vector3()).copy(elem[i + 1])
                points.push(curr, next);
            }
        });
        this.line.geometry.setFromPoints(points);
    }

    updateActiveLine(data) {
        const points = [];
        for (let i = 0; i < data.length - 1; i++) {
            const curr = (new THREE.Vector3()).copy(data[i]);
            const next = (new THREE.Vector3()).copy(data[i + 1])
            points.push(curr, next);
        }
        this.lineActive.geometry.setFromPoints(points);
    }

    addPoint(position, id) {
        var cube = new THREE.Mesh(this.nodeGeo, this.basicMaterial);
        cube._isPoint = true;
        this.group.add(cube);
        this.eventArray.push(cube);
        cube.position.copy(position);
        cube.position.y += this.dfSize / 2;
        cube.name = id;
        cube.scale.set(this.dfSize, this.dfSize, this.dfSize);
        this.config.renderers.updateEventArr(this);
    }
    delPoint(uuid) {
        const children = this.group.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const elem = children[i];
            if (elem.name == uuid) {
                this.group.remove(elem);
                i = 0;
            }
        };

        this.eventArray = this.eventArray.filter(elem => elem.name != uuid);
        this.config.renderers.updateEventArr(this);
    }
    setPointSize(size) {
        this.dfSize = size;
        this.eventArray.forEach((child) => {
            child.position.y = size / 2;
            child.scale.set(size, size, size);
        })
    }
    showPoint(uuid) {
        const children = this.group.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const elem = children[i];
            if (elem.name == uuid) {
                elem.material = this.activeMaterial;

            } else {
                elem.material = this.basicMaterial;
            }
        };
    }

    onMouseIn(e, intersects) {
        // console.log('--onMouseIn--', e, intersects);
        clearTimeout(this.timeOut);
        if (intersects.length != 0 && intersects[0].object._isPoint) {

            renderers.renderer.domElement.style.cursor = "pointer"
        }
        this.timeOut = setTimeout(() => {
            renderers.renderer.domElement.style.cursor = "default"
        }, 1000);

    }
    onMouseOut(e, intersects, key) {
        // console.log('--onMouseOut--', e, intersects, key);

    }

    onMouseDown(e, intersects) {
        if (e.button === 2 && intersects.length != 0 && intersects[0].object._isPoint) {
            VM.features.isDel = true;
            store.setState({
                intersect: intersects[0]
            });
            VM.featuresEvent(e, intersects[0])
        } else {
            if (e.button === 0 && intersects[0].object._isPoint) {
                VM.selectNodes(e, intersects[0]);
            }
            VM.features.state = false;
        }
    }
    onDblclick(e, intersects) {
        // console.log('--onDblclick--', e, intersects);
    }
    animate = (dt) => {

    }
}
