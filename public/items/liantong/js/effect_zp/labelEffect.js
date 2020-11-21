// 标注效果  扩散圈+光柱+图标+文字
// import { EffectBase } from './EffectBase.js';
{
var _Shaders_label = {
    SpreadVShader: [`
        uniform float u_time;
        uniform float u_size;
        uniform float u_index;

        attribute vec3 cUv;
        attribute vec2 cRatio;
        attribute vec4 cColor;

        varying vec4 vColor;
        varying vec4 vUv;

        const float PI = 3.14159265;
        void main() {
            float k = cRatio.y + u_time;
            k = k >= 1.0 ? k - 1.0 : k;
            
            float k2 = 1.0, k3 = 0.0;
            if (u_index < cUv.z && u_index > (cUv.z - 1.0)) {
                k2 = u_index - floor(u_index);
                k3 = 1.0;
            }

            vUv = vec4(cUv, u_index + k3);
            vColor = vec4(cColor.xyz, cColor.w * sin(PI * k) * k2);

            vec3 vofft = vec3(cUv.x < 0.5? -1.0: 1.0, 0.0, cUv.y < 0.5? -1.0: 1.0);
            vec3 vPos = position - vofft * cRatio.x * u_size * (1.0 - k * k2);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(vPos, 1.0);
        }
    `].join("\n"),
    
    LightrayVShader: [`
        uniform float u_index;

        attribute vec3 cUv;
        attribute vec4 cColor;

        varying vec4 vColor;
        varying vec4 vUv;
        void main() {
            float k2 = 1.0, k3 = 0.0;
            if (u_index < cUv.z && u_index > (cUv.z - 1.0)) {
                k2 = u_index - floor(u_index);
                k3 = 1.0;
            }
            vColor = vec4(cColor.xyz, cColor.w * k2);
            vUv = vec4(cUv.x, 1.0 - cUv.y, cUv.z, u_index + k3);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `].join("\n"),
    
    SpreadFShader: [`
        uniform sampler2D u_txue;
        varying vec4 vColor;
        varying vec4 vUv;
        void main() {
            if (vUv.z > vUv.w) discard;
            gl_FragColor = vColor * texture2D(u_txue, vUv.xy);
        }
    `].join("\n"),

    TopPointVShader: [`
        uniform float u_time;
        uniform float u_index;
        uniform vec2 u_radian;
        uniform vec4 u_ratio;

        attribute vec3 cUv;
        attribute vec3 cRatio;
        attribute vec4 cColor;

        varying vec4 vColor;
        varying vec4 vUv;
        varying float vRatio;

        const float PI = 6.2831853072;

        mat2 getMat2(float rad) {
            float c = cos(rad), s = sin(rad);
            return mat2(c, -s, s, c);
        }
        void main() {
            float k = cRatio.y + u_time;
            k = k >= 1.0 ? k - 1.0 : k;
            
            vec2 rUv = cUv.xy;
            if (cRatio.z < 0.5) {
                vec2 center = vec2(0.5, 0.5);
                rUv = (rUv - center) * getMat2(PI * k) + center;
            }
            float k0 = 1.0, k1 = 0.0;
            if (cRatio.z > 1.5) {
                k0 = u_ratio.z;
                k1 = u_ratio.w + 0.5 + k0;
            }

            float k2 = 1.0, k3 = u_index;
            if (u_index < cUv.z && u_index > (cUv.z - 1.0)) {
                k2 = u_index - floor(u_index);
                k3 = u_index + 1.0;
            }

            vRatio = cRatio.z;
            vUv = vec4(rUv, cUv.z, k3);
            vColor = vec4(cColor.xyz, cColor.w * k2);

            float sizeRt = u_ratio.x * cRatio.x, ofty = sizeRt + u_ratio.y * cRatio.x;
            vec2 posxy = vec2(cUv.x < 0.5? -k0: k0, cUv.y < 0.5? -k0: k0) * sizeRt;

            float radian = atan(u_radian.y - position.z, u_radian.x - position.x);
            radian = (radian < 0.0? radian + PI: radian) + PI * 0.25;
            vec2 posxz = vec2(posxy.x, 0.0) * getMat2(radian);
            vec3 vPos = position + vec3(posxz.x, posxy.y + ofty + sizeRt * k1, posxz.y);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(vPos, 1.0);
        }
    `].join("\n"),

    TopPointFShader: [`
        uniform sampler2D u_txue;
        uniform sampler2D u_txue1;
        uniform sampler2D u_txue2;

        varying vec4 vColor;
        varying vec4 vUv;
        varying float vRatio;
        void main() {
            if (vUv.z > vUv.w) discard;
            vec4 txue;
            if (vRatio < 0.5) {
                txue = texture2D(u_txue, vUv.xy);
            } else if (vRatio > 1.5) {
                txue = texture2D(u_txue2, vUv.xy);
            } else {
                txue = texture2D(u_txue1, vUv.xy);
            }
            gl_FragColor = vColor * txue;
        }
    `].join("\n")
};

// 测试配置项
var _test_config_label = {
    texture: {
        txuePath: '', //路径
        common: { //常规纹理
            spread: null, // 底部扩散纹理
            lightray: null, // 中间光柱纹理
            topOut: null, // 顶部外圈纹理
            topIn: null, // 顶部内圈纹理
            fontbg: null // 文字背景纹理
        }
    },
    data: [ // [ x坐标, y坐标, z坐标-高度, text内容, 大小系数, colorsArr取值-空则colorType]
        // [-100, 0, 10, '测试1', 1, 0],
        // [100, 0, 10, '测试2', 1, 0]
    ],
    size: 6, // 底部扩散平面大小
    width: 0.5, // 中间光柱宽度
    height: 12, // 中间光柱高度
    topSize: 4, // 顶部图标 大小
    fontSize: 12, // 字体大小
    fontColor: '#ffffff', // 字体颜色，为null取colorsArr[i][2]
    fontOffsetY: 0, // 文字上下偏移量
    renderOrder: 5, // 渲染层级
    stxue: 'spread', //底部贴图名称， 对应 texture
    ltxue: 'lightray', //光柱贴图名称， 对应 texture
    totxue: 'topOut', //顶部外圈贴图名称， 对应 texture
    titxue: 'topIn', //顶部内圈贴图名称， 对应 texture
    fbtxue: 'fontbg', //文字背景贴图名称， 对应 texture
    visible: -1, // >0:初始显示个数 -1:全部显示
    lightCross: true, // 是否有光柱
    topPoint: true, // 是否有顶部效果
    colorType: 1, // 0-随机取色， 1-循环取色
    colorsArr: [ // 颜色组，[底面颜色， 光柱颜色，顶部颜色(文字颜色)]
        ['#ffffff', '#ffffff', '#ffffff']
        // ['#E27943', '#E27943', '#E27943'],
        // ['#2FAFF4', '#2FAFF4', '#2FAFF4']
    ]
};

function labelEffect(config) {
    config = $.extend(true, {}, _test_config_label, config);
    
    // ----------- 连续动画参数
    const DefaultAmtOpts = { // 连续动画参数
        allIndex: 0, // 所有长度
        crtIndex: 0, // 当前序号
        showIndex: -1, // 显示序号
        speed: 1, // 动画速度
        delay: 0, // 延迟执行下一个

        dTrans: -1, // 延迟过渡
        isStop: true  // 是否暂停
    };
    this.inAmtOpts = $.extend(true, {}, DefaultAmtOpts, config.amtOpts || {});
    // ----------- 连续动画 end

    EffectBase.call(this, config);

    this.effectInit();

    const _this = this;
    this.animate = function(dt) {
        _this.group.traverse((node) => {
            // 入场效果
            if (node._inAnimate && _this.isInAmt()) {
                _this.inManage(dt, (key) => {
                    node.material.uniforms['u_index'].value = key;
                }, (opts) => {
                    _this.textArr.forEach((tNode) => {
                        if (tNode && tNode.isMesh && tNode._index < opts.showIndex)
                            tNode.visible = true;
                    });
                });
            }
            // 扩散
            if (node._isSpread && _this.inAmtOpts.crtIndex > 0) {
                _this.nodeFunc(dt, node);
            }
            // 旋转
            if (node._isRotation && _this.inAmtOpts.crtIndex > 0) {
                _this.nodeFunc(dt, node);
            }
        });
    };
}

labelEffect.prototype = Object.assign(Object.create(EffectBase.prototype), {

    constructor: labelEffect,

    onMouseIn: function(e, intersects) {
        // console.log( '--onMouseIn--', e, intersects);
    },
    onMouseOut: function(e, intersects, key) {
        // console.log( '--onMouseOut--', e, intersects, key);
    },
    onMouseDown: function(e, intersects) {
        // console.log( '--onMouseDown--', e, intersects);
        const node = intersects[0]
        if (node) {
            const [fIdx, uData, di = uData.eventIdx[fIdx]] = [
                node.faceIndex, node.object.userData];
            if (di <= this.inAmtOpts.showIndex) {
                console.log('--', uData.data[di], di);
            }
        }
    },
    onDblclick: function(e, intersects) {
        // console.log( '--onDblclick--', e, intersects);
    },

    // -------------
    // 入口
    effectInit: function() {
        const spreads = this.creatSpreads(this.config);
        this.eventArray.push(spreads);
        this.group.add(spreads);
    },

    // 坐标转换
    handleVec3: function(dArr, params) {
        const [scale, center] = [
            params.basic[params.dataTans].vScale,
            params.basic[params.dataTans].center
        ];
        const [vx, vy, vz] = [
            (dArr[0] - center[0]) * scale,
            (center[1] - dArr[1]) * scale,
            (dArr[2] - (center[2] || 0)) * scale
        ];
        return { vx, vy, vz };
    },

    // 创建 buffer
    spreadsBuffer: function(dArr, Buffer, params, index) {
        const { vx, vy, vz } = this.handleVec3(dArr, params);
        const [s, pi, hlfWidth] = [dArr[4] || 1, Math.PI, params.width * 0.5];
        const [col0, col1, col2] = [params.sci[0], params.sci[1], params.sci[2]];
        const [bs, ts, num] = [params.size * s, params.topSize * s, 3];

        for (let i = 0; i < num; i ++) {
            const [k, ratioy = (params.randomC + k) % 1] = [i / num];
            Buffer.s_ratio.push(s, ratioy, s, ratioy, s, ratioy, s, ratioy);
            Buffer.s_uv.push(0, 0, index, 1, 0, index, 0, 1, index, 1, 1, index);

            this.pushColor(Buffer.s_color, col0, col0, col0, col0);
            // Buffer.s_position.push(vx, vz, vy, vx, vz, vy, vx, vz, vy, vx, vz, vy);

            Buffer.s_position.push(
                vx - bs, vz, vy - bs, vx + bs, vz, vy - bs, 
                vx - bs, vz, vy + bs, vx + bs, vz, vy + bs
            );
            
            // 光柱
            if (params.lightCross) {
                this.pushColor(Buffer.l_color, col1, col1, col1, col1);

                const [nx1, nx2, ny1, ny2] = [
                    hlfWidth * Math.cos(pi * k) * s, hlfWidth * Math.cos(pi * k + pi) * s,
                    hlfWidth * Math.sin(pi * k) * s, hlfWidth * Math.sin(pi * k + pi) * s
                ];
                Buffer.l_position.push(
                    vx + nx1, vz + params.height * s, vy + ny1,
                    vx + nx2, vz + params.height * s, vy + ny2,
                    vx + nx1, vz, vy + ny1, vx + nx2, vz, vy + ny2
                );
            }

            // 顶部
            if (params.topPoint) {
                Buffer.t_ratio.push(s, params.randomC, i, s, params.randomC, i, 
                    s, params.randomC, i, s, params.randomC, i);
                this.pushColor(Buffer.t_color, col2, col2, col2, col2);
                Buffer.t_position.push(vx, vz, vy, vx, vz, vy, vx, vz, vy, vx, vz, vy);
            }
            
            // 构面
            const a = Buffer.ofs + 4 * i;
            Buffer.s_indices.push(a, a + 2, a + 3, a, a + 3, a + 1);

            Buffer.eventIdx.push(index, index);
        }
        Buffer.ofs += num * 4;
    },

    // 创建 顶部 文字
    creatText: function(dArr, params, index) {
        const { vx, vy, vz } = this.handleVec3(dArr, params);
        const [t, s] = [`${dArr[3] || ''}`, dArr[4] || 1];
        let [cvs, _w, ctx = cvs.getContext('2d')] = [
            document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas'), 2 ];
        cvs.width = cvs.height = _w;

        ctx.font = `bold ${params.fontSize * 2}px Arial`;
        const _tw = ctx.measureText(t).width + 4;
        _w = Math.max(64, THREE.Math.ceilPowerOfTwo(_tw));
        cvs.width = cvs.height = _w;

        ctx.font = `normal ${params.fontSize * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowBlur = 1;
        ctx.shadowColor = '#F2F2F2';

        ctx.fillStyle = params.fontColor || this.getStyle(params.sci[2]);
        ctx.fillText(t, _w / 2, _w / 2);

        // - 生成纹理
        const [txue, scale, wh = s * params.topSize * params.fontSize * 0.2 * scale] = [
            new THREE.Texture(cvs), _w / 128,
        ];
        txue.needsUpdate = true;
        txue._scale = scale;
        cvs = ctx = null;

        // - 文字对象
        const tPlane = new THREE.Mesh(this.geo.plane(wh, wh), this.mtl.basic({
            side: THREE.DoubleSide, transparent: true, depthWrite: false, map: txue
        }));
        // - 同步顶点效果位置 TopPointVShader
        const [sizeRt, k1, ofty = sizeRt + params.height * s] = [params.topSize * s,
            0.5 + params.fontSize * 0.1 + params.fontOffsetY * 0.1
        ];
        tPlane.position.set(vx, vz + ofty + sizeRt * k1, vy);
        tPlane._unEvent = true; //不执行事件
        tPlane._index = index; // 序号
        tPlane.name = t;

        // 跟随相机旋转 xz轴
        tPlane.onBeforeRender = function(renderer, scene, camera) {
            this.lookAt(camera.position.x, this.position.y, camera.position.z);
        };

        return tPlane;
    },

    // 创建 顶部点
    creatTopPoint: function(Buffer, params) {
        const tGeo = this.geo.buf();
        tGeo.setIndex(Buffer.s_indices);
        tGeo.addAttribute('cUv', new THREE.Float32BufferAttribute(Buffer.s_uv, 3));
        tGeo.addAttribute('cRatio', new THREE.Float32BufferAttribute(Buffer.t_ratio, 3));
        tGeo.addAttribute('cColor', new THREE.Float32BufferAttribute(Buffer.t_color, 4));
        tGeo.addAttribute('position', new THREE.Float32BufferAttribute(Buffer.t_position, 3));
        
        const vec4 = new THREE.Vector4(params.topSize, params.height, 
            params.fontSize * 0.1, params.fontOffsetY * 0.1);
        const topPoint = new THREE.Mesh(tGeo, this.mtl.shader({
            uniforms: {
                u_time: { value: 0 },
                u_ratio: { value: vec4 },
                u_radian: { value: new THREE.Vector2() },
                u_index: { value: this.inAmtOpts.showIndex },
                u_txue: { value: this.Txues[`_${params.totxue}`] },
                u_txue1: { value: this.Txues[`_${params.titxue}`] },
                u_txue2: { value: this.Txues[`_${params.fbtxue}`] }
            },
            depthWrite: false,
            transparent: true, 
            side: THREE.DoubleSide,
            // wireframe: true,
            // blending: THREE.AdditiveBlending,
            vertexShader: _Shaders_label.TopPointVShader, 
            fragmentShader: _Shaders_label.TopPointFShader
        }));
        topPoint.name = 'topPoint';
        topPoint.renderOrder = params.renderOrder || 0;
        // 入场显示
        topPoint._inAnimate = true;
        // 外圈旋转
        topPoint._isRotation = true;
        topPoint._transTimes = 0;
        topPoint._perTimes = 8;

        // 跟随相机旋转 xz轴
        topPoint.onBeforeRender = function(renderer, scene, camera) {
            // this.lookAt(camera.position.x, this.position.y, camera.position.z);
            const [target, vec2] = [camera.userData.target,
                new THREE.Vector2(camera.position.x, camera.position.z)];

            if (target) vec2.sub({ x: target.x, y: target.z});
            this.material.uniforms.u_radian.value = vec2;
        };
        
        return topPoint;
    },
    
    // 创建 光柱
    creatLigthray: function(Buffer, params) {
        const pGeo = this.geo.buf();
        pGeo.setIndex(Buffer.s_indices);
        pGeo.addAttribute('cUv', new THREE.Float32BufferAttribute(Buffer.s_uv, 3));
        pGeo.addAttribute('cColor', new THREE.Float32BufferAttribute(Buffer.l_color, 4));
        pGeo.addAttribute('position', new THREE.Float32BufferAttribute(Buffer.l_position, 3));
        
        const lightray = new THREE.Mesh(pGeo, this.mtl.shader({
            uniforms: {
                u_index: { value: this.inAmtOpts.showIndex },
                u_txue: { value: this.Txues[`_${params.ltxue}`] }
            },
            depthWrite: false,
            transparent: true, 
            side: THREE.DoubleSide,
            vertexShader: _Shaders_label.LightrayVShader, 
            fragmentShader: _Shaders_label.SpreadFShader,
            blending: THREE.AdditiveBlending
        }));
        lightray.name = 'lightray';
        lightray.renderOrder = params.renderOrder || 0;
        // 入场显示
        lightray._inAnimate = true;
        
        return lightray;
    },
    
    // 创建 标注入口
    creatSpreads: function(params) {
        const sGeo = this.geo.buf();
        const Buffer = { //- buffer
            eventIdx: [], s_indices: [], ofs: 0, // 点偏移
            s_uv: [], s_ratio: [], s_color: [], s_position: [], 
            l_color: [], l_position: [],
            t_ratio: [], t_color: [], t_position: []
        };
        
        const colorArr = this.handleColor(params.colorsArr);
        const [datalen, clen, textArr] = [params.data.length - 1, colorArr.length, []];

        this.textArr = textArr;
        this.initAmtOpts(datalen, params.visible);
        const showNnm = params.visible < 0 ? datalen + 1 : params.visible;

        for (let i = datalen; i >= 0; i--) {
            const di = params.data[i];

            const randomC = Math.random();
            const ck = params.colorType ? i % clen : (clen * randomC | 0);
            params.randomC = randomC;
            params.sci = colorArr[isNaN(di[5])? ck: di[5]];

            this.spreadsBuffer(di, Buffer, params, i);
            // 文字
            if (params.topPoint && di[3]) {
                const txt = this.creatText(di, params, i);
                txt.visible = i < showNnm? true: false;
                textArr.push(txt);
            }
        }
        
        sGeo.setIndex(Buffer.s_indices);
        sGeo.addAttribute('cUv', new THREE.Float32BufferAttribute(Buffer.s_uv, 3));
        sGeo.addAttribute('cRatio', new THREE.Float32BufferAttribute(Buffer.s_ratio, 2));
        sGeo.addAttribute('cColor', new THREE.Float32BufferAttribute(Buffer.s_color, 4));
        sGeo.addAttribute('position', new THREE.Float32BufferAttribute(Buffer.s_position, 3));
        
        // spreads
        const spreadEffect = new THREE.Mesh(sGeo, this.mtl.shader({
            uniforms: {
                u_time: { value: 0 },
                u_index: { value: this.inAmtOpts.showIndex },
                u_size: { value: params.size },
                u_txue: { value: this.Txues[`_${params.stxue}`] }
            },
            depthWrite: false,
            transparent: true,
            side: THREE.DoubleSide,
            vertexShader: _Shaders_label.SpreadVShader,
            fragmentShader: _Shaders_label.SpreadFShader,
            blending: THREE.AdditiveBlending,
        }));

        spreadEffect.name = 'spreadEffect';
        spreadEffect.renderOrder = params.renderOrder || 0;

        // 入场显示
        spreadEffect._inAnimate = true;
        // 扩散效果
        spreadEffect._isSpread = true;
        spreadEffect._transTimes = 0;
        spreadEffect._perTimes = 3;

        // 事件参数
        spreadEffect.userData.eventIdx = Buffer.eventIdx;
        spreadEffect.userData.data = params.data;
        
        //- 光柱
        if (params.lightCross) {
            const lightCross = this.creatLigthray(Buffer, params);
            lightCross.userData.eventIdx = Buffer.eventIdx;
            lightCross.userData.data = params.data;
            spreadEffect.add(lightCross);
        };
        //- 顶部效果
        if (params.topPoint) {
            const topPoint = this.creatTopPoint(Buffer, params);
            topPoint.userData.eventIdx = Buffer.eventIdx;
            topPoint.userData.data = params.data;
            textArr.forEach((tNode) => {
                if (tNode && tNode.isMesh) topPoint.add(tNode);
            });
            spreadEffect.add(topPoint);
        }
        
        return spreadEffect;
    },

    //----------
    // 设置显示个数 及速度
    setShowIdx: function(idx, speed) {
        idx = idx - 0;
        this.inAmtOpts.isStop = false;
        if (!isNaN(idx)) {
            this.initAmtOpts(this.inAmtOpts.allIndex, idx);
            this.textArr.forEach((tNode) => {
                tNode.visible = false;
                if (tNode && tNode.isMesh && tNode._index < idx)
                    tNode.visible = true;
            });
        }
        if (!isNaN(speed)) this.inAmtOpts.speed = speed;
    },

    // --------- 处理连续动画 --------------
    // 初始化参数
    initAmtOpts: function(allLen, showIdx) {
        const showNnm = showIdx < 0 ? allLen + 1 : showIdx;
        this.inAmtOpts.allIndex = allLen;
        this.inAmtOpts.crtIndex = showNnm - 0;
        this.inAmtOpts.showIndex = showNnm - 1;
    },

    // 执行判断
    isInAmt: function() {
        const inAmtOpt = this.inAmtOpts;
        return (!inAmtOpt.isStop && inAmtOpt.showIndex < inAmtOpt.allIndex);
    },

    // 连续动画处理
    inManage: function(dt, callback, onComplete) {
        const inAmtOpt = this.inAmtOpts;

        if (inAmtOpt.delay > 0 && inAmtOpt.dTrans >=0 
                && inAmtOpt.dTrans < inAmtOpt.delay) {
            inAmtOpt.dTrans += dt;
            return;
        }

        callback && callback(inAmtOpt.showIndex);
        inAmtOpt.showIndex += dt * inAmtOpt.speed;
        if (inAmtOpt.showIndex >= inAmtOpt.crtIndex) {
            inAmtOpt.dTrans = 0;
            inAmtOpt.crtIndex ++;
            inAmtOpt.isStop = true;
            onComplete && onComplete(inAmtOpt);
            this.nodeComplete(inAmtOpt.crtIndex, inAmtOpt.allIndex);
        }
    },

    // 节点执行完成  crtIndex - 当前序号  allIndex - 所有序号长度
    nodeComplete: function(crtIndex, allIndex) {}

    // ---------------连续动画 end
    
});
}
// export { labelEffect };