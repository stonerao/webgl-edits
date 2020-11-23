class handelPointy extends EffectBase {
    constructor(config) {
        super(config);
        EffectBase.call(this, config);

        this.group = new THREE.Group();


        this.init();
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
        });
        const lineActiveMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
        });

        const lineGeo = new THREE.BufferGeometry();
        const lineActiveGeo = new THREE.BufferGeometry();

        this.line = new THREE.LineSegments(lineGeo, lineMaterial);
        this.lineActive = new THREE.LineSegments(lineActiveGeo, lineActiveMaterial);
        this.group.add(this.line, this.lineActive)
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
        cube.position.y += 2.5;
        cube.name = id;
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
