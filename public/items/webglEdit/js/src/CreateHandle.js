{
    const effectTypes = [];
}
class HandleEffect extends EffectBase {
    constructor(config) {
        super(config);
        EffectBase.call(this, config);
        this.group = new THREE.Group();
        this.init();
        console.log(this);
    }

    init() {

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

    onMouseIn(e, intersects) {
        console.log('--onMouseIn--', e, intersects);
    }
    onMouseOut(e, intersects, key) {
        console.log('--onMouseOut--', e, intersects, key);
    }
    onMouseDown(e, intersects) {
        console.log('--onMouseDown--', e, intersects);
    }
    onDblclick(e, intersects) {
        console.log('--onDblclick--', e, intersects);
    }
    animate = (dt) => {

    }
}
