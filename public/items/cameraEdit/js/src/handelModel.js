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

        this.group = new THREE.Group();

        this.modelGroup = new THREE.Group();
        this.labelGroup = new THREE.Group();

        this.group.add(this.modelGroup, this.labelGroup);

        this.init();

        // 加载模型
        const models = config.model.map((url) => config.modelUrl + url);
        this.loadModel(models);
    }

    init() {

    }

    // 加载模型
    loadModel(models) {
        if (models.length === 0) {
            // 加载所有模型完毕
            return false
        };
        const url = models.shift();
        loadFbx(url, (obj) => {
            this.modelGroup.add(obj);
            const eventArr = [];
            obj.traverse((child) => {
                if (child.geometry) {
                    eventArr.push(child);
                }
            });
            this.pushEvent(eventArr);
            this.loadModel(models);
        });
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
         
        if (e.button === 2 && intersects.length != 0) {
            store.setState({
                intersect: intersects[0]
            });
            VM.features.isDel = false;
            VM.featuresEvent(e, intersects[0])
            
        } else {
            VM.features.state = false;
        }
    }
    onDblclick(e, intersects) {
        // console.log('--onDblclick--', e, intersects);
    }
    animate = (dt) => {

    }
}
