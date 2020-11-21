
{
const _Shaders = {
    // 顶点着色器
    BaseVertex: `
        precision lowp float;
        attribute vec2 uv0;
        varying vec2 vUv;
        varying vec2 vUv0;
        void main() {
        vUv = uv;
        vUv0 = uv0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    
    // 片元着色器
    LightningFragment1: `
        precision mediump float;
        uniform float time;
        uniform vec3 color0;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float opacity;
        
        varying vec2 vUv;
        varying vec2 vUv0;
        
        #define TAU 6.28318530718
        
        //伪随机值
        float rands(float p){
            return fract(sin(p) * 10000.0);
        }
        
        float noise(vec2 p){
            float t = time / 20000.0;
            if(t > 1.0) t -= floor(t);
            return rands(p.x * 14. + p.y * sin(t) * 0.5);
        }
       
        vec2 sw(vec2 p){
            return vec2(floor(p.x), floor(p.y));
        }
        vec2 se(vec2 p){
            return vec2(ceil(p.x), floor(p.y));
        }
        vec2 nw(vec2 p){
            return vec2(floor(p.x), ceil(p.y));
        }
        vec2 ne(vec2 p){
            return vec2(ceil(p.x), ceil(p.y));
        }
        float smoothNoise(vec2 p){
            vec2 inter = smoothstep(0.0, 1.0, fract(p));
            float s = mix(noise(sw(p)), noise(se(p)), inter.x);
            float n = mix(noise(nw(p)), noise(ne(p)), inter.x);
            return mix(s, n, inter.y);
        }
        float fbm(vec2 p){
            float z = 2.0;
            float rz = 0.0;
            vec2 bp = p;
            for(float i = 1.0; i < 6.0; i++){
                rz += abs((smoothNoise(p) - 0.5)* 2.0) / z;
                z *= 2.0;
                p *= 2.0;
            }
            return rz;
        }
        
        vec3 hsv2rgb(vec2 st){
                
            float angle = abs(atan(st.y, st.x) / TAU) * 5.;
            
            vec3 rgb = mix(color0, color1, clamp( angle, 0., 1.));
            rgb = mix(rgb, color2, clamp( angle-1., 0., 1.));
            rgb = mix(rgb, color0, clamp( angle-2., 0., 1.));
            
            return rgb;
        }
        
        void main() {
                
            //计算扰动值
            vec2 uv = vUv * 4.;
            float rz = fbm(uv);
            rz *= pow(15., 0.9);
                        
            // vec3 hue = hsv2rgb(vUv0*2. - 1.);
            
            //计算颜色
            gl_FragColor = mix(vec4(color0, opacity) / rz, vec4(color0, 0.1), 0.2);
            
            // 缝合处处理
            if (vUv.x < 0.05) {
                gl_FragColor = mix(vec4(color0, 0.1), gl_FragColor, vUv.x / 0.05);
            }
            if (vUv.x > 0.95){
                gl_FragColor = mix(gl_FragColor, vec4(color0, 0.1), (vUv.x - 0.95) / 0.05);
            }
        }`,
    LightningFragment0:`
        precision mediump float;
        uniform float time;
        uniform vec3 color0;
        uniform vec3 color1;
        uniform vec3 color2;
        
        varying vec2 vUv; // 正常纹理，s轴为一周
        varying vec2 vUv0; // 颜色纹理，t轴为一周（避免了缝隙）
        
        #define TAU 6.28318530718
        //#define MAX_ITER 4 // 密度

        vec3 hsv2rgb(vec2 st){
                
            float angle = abs(atan(st.y, st.x) / TAU) * 5.;
            
            vec3 rgb = mix(color0, color1, clamp( angle, 0., 1.));
            rgb = mix(rgb, color2, clamp( angle-1., 0., 1.));
            rgb = mix(rgb, color0, clamp( angle-2., 0., 1.));
            
            return rgb;
        }

        void main() {
                
        float iTime = time * 0.2 + 23.0;
       
        // 计算纹路
        vec2 p = mod(vUv * TAU, TAU) - 250.0;
        vec2 i = vec2(p);
        float c = 1.; // 强度
        float inten = 0.005;
        for (int n = 0; n < MAX_ITER; n++) {
            float t = iTime * (1.0 - (3.5 / float(n + 1)));
            i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
            c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
        }
        c /= float(MAX_ITER);
        c = 1.17-pow(c, 1.4);
        vec3 colour = vec3(pow(abs(c), 8.0));
	    
	    // 计算颜色
	    vec3 hue = hsv2rgb(vUv0*2. - 1.);
	    
        gl_FragColor = vec4(colour*hue, 1.0 );

        }`
};

// 基础配置项
const baseConfig = {
    blitzball:{

        type: 0,// 类型：0-水纹形，1-闪电形
        radius: 50, // 半径
        wSeg: 50,
        hSeg:50,
        phiLength: Math.PI*2, // 左右半圆参数
        thetaLength: Math.PI*0.5, // 上下半圆参数
        density: 4, // 密度（水纹形）
        color0: '#ff0000', // 颜色1
        color1: '#00ff00', // 颜色2
        color2: '#0000ff', // 颜色3
        opacity: 1
    }
};

function CreatBlitzball(config) {

    config = $.extend(true, {}, baseConfig, config);
    EffectBase.call(this, config);

    let self = this;
    // 时间
    this.aTime = { value: 0 };

    this.main();

    this.animate = function(dt) {

        self.aTime.value += dt;
    };

}

CreatBlitzball.prototype = Object.assign(Object.create(EffectBase.prototype), {

    constructor: CreatBlitzball,

    // onMouseIn: function(e, intersects) {
    // },
    // onMouseOut: function(e, intersects, key) {
    // },
    // onMouseDown: function(e, intersects) {
    // },
    // onDblclick: function(e, intersects) {
    // },

    main: function() {

        const plane = new THREE.Mesh(this.geo.box(20, 20, 20), this.mtl.basic({
            color: 0xffff00, transparent: true, opacity: 0.4
        }));
        plane.position.y += 10;
        this.group.add(plane);

        // 配置项
        const { blitzball } = this.config;

        // mesh
        const mesh = new THREE.Mesh(this.getGeometry(blitzball), this.getMaterial(blitzball));
        // this.eventArray.push(plane);
        this.group.add(mesh);
    },

    getGeometry: function( config ){

        // 配置项
        const { radius, wSeg, hSeg, phiLength, thetaLength } = config;
        // 几何对象
        const geometry = this.geo.sphere(radius, wSeg, hSeg, 0, phiLength, 0, thetaLength);

        // 生产颜色纹理数据
        let uvs0 = [];
        let positions = geometry.attributes.position;
        for(let i=0, len = positions.count; i<len; i++){

            let s = ( positions.getX(i) / radius + 1 ) / 2;
            let t = ( positions.getZ(i) / radius + 1 ) / 2;
            uvs0.push(s, t);
        }
        geometry.addAttribute( 'uv0', new THREE.Float32BufferAttribute( uvs0, 2 ) );

        return geometry;
    },

    getMaterial: function( config ){
        // 配置项
        let { color0, color1, color2, opacity, type, density } = config;

        // shader参数-uniforms
        let uniforms = {
            time: this.aTime,
            density: { value: 4 },
            color0: { value: this.color(color0) },
            color1: { value: this.color(color1) },
            color2: { value: this.color(color2) },
            opacity: { value: opacity }
        };

        const fraS = (type>0?'': '#define MAX_ITER '+density )+_Shaders['LightningFragment'+type];
        // 材质对象-material
        const material = this.mtl.shader({
            uniforms: uniforms,
            blending: THREE.AdditiveBlending,//颜色混合
            transparent: true,//开启透明度通道
            side: THREE.DoubleSide,
            depthTest: false,//关闭深度测试
            vertexShader: _Shaders.BaseVertex, //顶点着色器
            fragmentShader: fraS //片元着色器
        });

        return material;
    }
	
});
}
