/**
解析数据 生成
*/
class handelParse extends EffectBase {
    constructor(config) {
        super(config);
        EffectBase.call(this, config);

        this.group = new THREE.Group();

    }

    init() {

    }

    parse(data) {
        const { model, comments = [] } = data;
        comments.forEach((d) => {
            Effect.createCommEffect(d, d.position);
        });
        console.log(Models.modelGroup)
        Models.modelGroup.traverse((child) => {
            if (child.uuid === Models.modelGroup.uuid) return false;
            model.forEach((mode) => {
                if (mode.urlName === child._urlName && child.parent.name === mode.parent) {
                    child.position.copy(mode.position);
                    child.rotation.copy(mode.rotation);
                    child.scale.copy(mode.scale);
                    // 材质
                    if (Array.isArray(child.material) && Array.isArray(mode.material)) {
                        console.log(mode)
                        mode.material.forEach((mat) => {
                            child.material.forEach((cmat) => {
                                this.setMaterial(cmat, mat);
                            })
                        })
                    }
                    if (child.material && !Array.isArray(child.material) && !Array.isArray(mode.material)) {
                        this.setMaterial(child.material, mode.mat);
                    }
                }
            })

        });
    }

    setMaterial(cmat, mat) {
        if (cmat.name === mat.name) {
            console.log(mat.color)
            cmat.setValues({
                transparent: mat.transparent,
                wireframe: mat.wireframe,
                visible: mat.visible,
                side: mat.side,
                opacity: mat.opacity,
                depthWrite: mat.depthWrite,
                depthTest: mat.depthTest,
                blending: mat.blending,
                color: new THREE.Color(mat.color)
            })
        }
    }

    animate = (dt) => {
    }
}
