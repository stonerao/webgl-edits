/**
* 飞线
* THREE = r98
*/
class InitFlys {
    constructor({ img } = opts) {
        if (!THREE) {
            return console.error("THREE! THREE! THREE!");
        }

        if (img) {
            this.texture = new THREE.TextureLoader().load(img)
        }

        this.array = []; // 存储线条
    }

    add(opts = {}) {
        // 传递属性
        const {
            color = new THREE.Color(), // 颜色 
            opacity = 1,  // 透明度
            data = [], // 线条数据
            size = 1, // 粒子大小
            length = 1, // 粒子展示长度
            repeat = 1, // 飞线循环次数
            speed = 1, // 速度
            dpi = 1, // 速度
            type = 1, // 飞线样式类型
            img, // 材质贴图
            onComplete = () => { }, // 飞线结束
            onRepeat = () => { }, // 飞线单次结束
        } = opts;

        const _material = opts.material || {}; // 外部传递材质属性 优先级第一

        const shader = this.getShader(type); // type shader

        const geometry = new THREE.BufferGeometry();

        // 材质贴图
        const _data = this.tranformPath(data, dpi);
        const indexArr = _data.map((e, i) => i);

        const texture = !!img ? new THREE.TextureLoader().load(img) : this.texture;
        const total = parseFloat(indexArr.length) + parseFloat(length);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                u_map: { value: texture },
                u_size: { value: size },
                u_length: { value: length },
                u_opacity: { value: opacity },
                u_color: { value: color },
                u_total: { value: total },
            },
            transparent: true,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader
        });


        const mesh = new THREE.Points(geometry, material);


        geometry.setFromPoints(_data);
        geometry.addAttribute("a_index", new THREE.Float32BufferAttribute(indexArr, 1));

        mesh._time = 0; // 当前时间
        mesh._been = 0; // 当前次数
        mesh._speed = speed * 10.0; // 速度
        mesh._total = total; // 总时间
        mesh._repeat = repeat; // 总次数
        mesh._onRepeat = onRepeat; // 单次完结回调
        mesh._onComplete = onComplete; // 结束回调
        mesh.name = THREE.Math.generateUUID();

        this.array.push(mesh);

        // 替换属性
        for (const key in _material) {
            if (material.hasOwnProperty(key)) {
                material[key] = _material[key];
            }
        }

        return mesh;
    }
    /**
    * [remove 删除]
    * @param   {Object}  mesh  [当前飞线]
    */
    remove(mesh) {
        mesh.material.dispose();
        mesh.geometry.dispose();
        this.array = this.array.filter(elem => elem.name != mesh.name);
        mesh.parent.remove(mesh);
        mesh = null;
    }
    /**
    * 根据线条组生成路径
    * @param {*} arr 需要生成的线条组
    * @param {*} dpi 密度
    */
    tranformPath(arr, dpi = 1) {
        const vecs = [];
        for (let i = 1; i < arr.length; i++) {
            let src = arr[i - 1];
            let dst = arr[i];
            let s = new THREE.Vector3(src.x, src.y, src.z);
            let d = new THREE.Vector3(dst.x, dst.y, dst.z);
            let length = s.distanceTo(d) * dpi;
            let len = Math.round(length);
            for (let i = 0; i <= len; i++) {
                vecs.push(s.clone().lerp(d, i / len))
            }
        }
        return vecs;
    }
    /**
     * [animation 动画]
     * @param   {Number}  delta  [执行动画间隔时间]
     */
    animation(dt = 0.015) {
        for (let i = 0; i < this.array.length; i++) {
            const mesh = this.array[i];

            if (mesh._been >= mesh._repeat) {
                mesh._onComplete();
                this.remove(mesh);
                return false;
            }

            if (mesh._time >= mesh._total) {
                mesh._time = 0;
                mesh._been++;
                mesh._onRepeat(mesh._been);
            }

            mesh.material && (mesh.material.uniforms.time.value = mesh._time);
            mesh._time += dt * mesh._speed;
        }
    }

    /**
    * [getTotal 获取当前数据的总长度]
    * @param   {Array}  data  [数据]]
    */
    getTotal(data) {
        let total = 0;
        for (let i = 0; i < data.length - 1; i++) {
            const elem = (new THREE.Vector3()).copy(data[i]);
            const next = (new THREE.Vector3()).copy(data[i + 1]);

            total += elem.distanceTo(next);
        };
        return total;
    }

    // 获取当前类型的shader
    getShader(type) {
        let vertex, fragment;
        switch (type) {
            case 1:
                vertex = `
            float size = u_size;
            float index = mod(time, u_total);
            if (a_index < index && a_index > index - u_length) {
                float val = (a_index - (index - u_length)) / u_length;
                v_opacity = val;
                size = size * 0.5 + val * u_size * 0.5;
            } else {
                v_opacity = 0.0;
            }`;
                fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity)  * _map;
            
             `
                break;
            case 2:
                vertex = `
            float size = u_size;
            float index = mod(time, u_total);
            if (a_index < index && a_index > index - u_length) {
                v_opacity = 1.0; 
            } else {
                v_opacity = 0.0;
            }`;
                fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
                break;
            case 3:
                vertex = `
            float size = u_size;
            float index = mod(time, u_total);
            if (a_index < index && a_index > index - u_length) {
                float val = (a_index - (index - u_length)) / u_length;
                v_opacity = val + 0.1;
                size = size * 0.5 + val * u_size * 0.5;
            } else {
                v_opacity = 0.02;
                size = u_size * 0.8;
            }`;
                fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
                break;
            case 4:
                vertex = `
            float size = u_size;
            float index = mod(time, u_total);
            float PI = 3.1415926;
            if (a_index < index && a_index > index - u_length) {
                float val = (a_index - (index - u_length)) / u_length;
                v_opacity = sin(val * PI);
                size =  sin(val * PI) * size;
            } else {
                v_opacity = 0.0;
            }`;
                fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
                break;
            case 5:
                vertex = `
            float size = u_size;
            float index = mod(time, u_total);
            float PI = 3.1415926;
            if (a_index < index && a_index > index - u_length) {
                v_opacity = 0.1;
                size =  0.8 * u_size;
                if (a_index < index && a_index > index - 1.0) {
                    v_opacity = 1.0; 
                    size = u_size;
                }
            } else {
                v_opacity = 0.0;
            }`;
                fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
                break;
            case 6:
                vertex = `
            float size = u_size;
            float index = mod(time, u_total); 
            float PI = 3.1415926;
            if (a_index < index && a_index > index - u_length) {
                v_opacity = 0.1;
                size =  0.8 * u_size;
                float i = (a_index - (index - u_length));
                if (mod(i, 15.0) < 0.9) { 
                    size = u_size;
                    v_opacity = 0.5;
                }
                if (a_index < index && a_index > index - 1.0) {
                    v_opacity = 1.0; 
                    size = u_size;
                }
            } else {
                v_opacity = 0.0;
            }`;
                fragment = `
            vec4 _map = texture2D(u_map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
            gl_FragColor = vec4(u_color, u_opacity * v_opacity) * _map;
             `
                break;
            default:
        }
        const vertexShader = `uniform float time;
        uniform float u_size;
        uniform float u_length;
        uniform float u_total;

        attribute float a_index;

        varying float v_opacity;
        void main() {
            ${vertex}
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = size * 300.0 / (-mvPosition.z);
        }`;
        const fragmentShader = `uniform float u_opacity;
        uniform vec3 u_color;
        uniform sampler2D u_map;

        varying float v_opacity;

        void main() {
            ${fragment}
        }`;
        return {
            vertexShader,
            fragmentShader
        }
    }

}