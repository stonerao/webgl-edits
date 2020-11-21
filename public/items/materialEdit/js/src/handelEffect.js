class handelEffect extends EffectBase {
    constructor(config) {
        super(config);
        EffectBase.call(this, config);

        this.group = new THREE.Group();
        this.timeVal = { value: 0 };

        this.init();
    }

    init() {

    }
    // 设置材质效果
    setMaterialEffect(material) {
        material.onBeforeCompile = (shader) => {
            shader.uniforms.time = this.timeVal;
        }
        material.setValues({
            color: new THREE.Color("#fff")
        });
        material.clone();
    }

    setBeforeCompile(shader) {

        shader.uniforms.time = this.timeVal; // time
        shader.uniforms.u_type = { value: 0 }; // 类型
        shader.uniforms.u_radius = { value: 0 }; // 半径
        shader.uniforms.u_height = { value: 0 }; // 高度
        shader.uniforms.u_center = { value: new THREE.Vector3() }; // 散播 雷达类中心点

        // 更换头部，注册uniforms
        const fragmentHeader = `
        uniform float time;
        uniform float u_type;
        uniform float u_radius;
        uniform vec3 u_center;
        void main() {
        `;
        // 更换头部，注册uniforms
        const fragmentColor = `
        int dType = int(u_type); // type

        vec3 lastColor = outgoingLight;
        float lastOpacity = diffuseColor.a;

        // 根据类型在图形中增加效果
        if (dType == 1) {
            
        }

        gl_FragColor = vec4( lastColor, lastOpacity );
        `;

        shader.fragmentShader = shader.fragmentShader.replace(
            "void main() {",
            fragmentHeader
        )
        shader.fragmentShader = shader.fragmentShader.replace(
            "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
            fragmentColor
        );

        console.log(shader)
    }

    onMouseIn(e, intersects) {
    }
    onMouseOut(e, intersects, key) {

    }
    onMouseDown(e, intersects) {

    }
    onDblclick(e, intersects) {
        // console.log('--onDblclick--', e, intersects);
    }
    animate = (dt) => {
        this.timeVal.value += dt;
    }
}
