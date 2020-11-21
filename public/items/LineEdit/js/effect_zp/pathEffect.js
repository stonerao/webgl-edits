// 路径效果，路径动效
// import { EffectBase } from './EffectBase.js';
{
var _Shaders_path = {
    PathVShader: [`
        uniform float u_time;
        uniform float u_index;

        attribute vec3 cUv;
        attribute vec4 cColor;

        varying vec4 vColor;
        varying vec4 vUv;

        void main() {
            vColor = cColor;
            vUv = vec4(cUv.x, cUv.y - u_time, cUv.z, u_index + 1.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`
    ].join("\n"),
    
    PathFShader: [`
        uniform sampler2D u_txue;
        varying vec4 vColor;
        varying vec4 vUv;
        void main() {
            if (vUv.z > vUv.w) discard;
            gl_FragColor = vColor * texture2D(u_txue, vUv.xy);
        }`
    ].join("\n"),
};

// 测试配置项
var _test_config_path = {
    texture: {
        txuePath: '', //路径
        repeat: { //重复纹理
            path: null
        }
    },
    data: [ // [[ x坐标, y坐标, z坐标], [x, y, z]]
        // [[85, 137, 60], [54, 111, 70], [44, 55, 56]],
        // [[44, 55, 56], [-5, -26, 80], [-184, -33, 58]],
    ],
    amtOpts: { // 连续动画参数
        speed: 0.4, // 动画速度
        delay: 1 // 延迟执行下一个
    },
    width: 2, // 路径宽度
    repeatRt: 4, // 宽度的倍数作为纹理重复数
    renderOrder: 5, // 渲染层级
    pathType: 0.2, // <=0-直线， >0 -曲线, 值越大，分段越多
    txue: 'path', //顶部内圈贴图名称
    visible: -1, // >0:初始显示段数 -1:全部显示
    colorType: 1, // 0-随机取色， 1-循环取色
    colorsArr: [ // 颜色组，路径颜色
        '#449BEB'
    ]
};

function pathEffect(config) {
    config = $.extend(true, {}, _test_config_path, config);
    
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
                });
            }
            // 流动
            if (node._isFlow && _this.inAmtOpts.crtIndex > 0) {
                _this.nodeFunc(dt, node);
            }

        });
    };
}

pathEffect.prototype = Object.assign(Object.create(EffectBase.prototype), {

    constructor: pathEffect,

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
        const paths = this.creatPaths(this.config);
        this.eventArray.push(paths);
        this.group.add(paths);
    },

    // 坐标转换
    handleVec3: function(dArri, params) {
        const [scale, center] = [
            params.basic[params.dataTans].vScale,
            params.basic[params.dataTans].center
        ];
        const [x, y, z] = [
            (dArri[0] - center[0]) * scale,
            (center[1] - dArri[1]) * scale,
            (dArri[2] - (center[2] || 0)) * scale
        ];
        return new THREE.Vector3(x, y, z);
    },

    // 处理 vec3数组
    handleArray: function (dArr, params) {
        let [vec2s, vec3s, dtcs, dtc, prv, dlen] = [
            [], [], [], 0, null, dArr.length];
        for (let k = 0; k < dlen; k++) {
            const v3k = this.handleVec3(dArr[k], params);
            if (params.pathType <= 0) {
                vec2s.push([v3k.x, v3k.y]);
                prv && (dtc += v3k.distanceTo(prv));
                dtcs.push(dtc);
                prv = v3k;
            }
            vec3s.push(v3k);
        }
        //- 曲线
        if (params.pathType > 0) {
            const curve = new THREE.CatmullRomCurve3(vec3s);
            const clen = curve.getLength() * params.pathType | 0;
            vec3s = curve.getSpacedPoints(clen);
            vec3s.forEach((v3k) => { 
                vec2s.push([v3k.x, v3k.y]);
                prv && (dtc += v3k.distanceTo(prv));
                dtcs.push(dtc);
                prv = v3k;
            });
        }

        return { vec2s, vec3s, dtcs };
    },

    // 创建 buffer
    pathsBuffer: function(dArr, Buffer, params, index) {
        const { vec2s, vec3s, dtcs } = this.handleArray(dArr, params);
        const [pF, rpt] = [this.getPathInfo([vec2s]), params.width * params.repeatRt];
        const [vecs, bels, dlen] = [pF.vertices, pF.beveling, vec3s.length];
        const [dE, hw, nm] = [dtcs[dlen - 1], params.hlfWidth, 0.001];

        for (let i = 0; i < dlen; i++) {
            const [di, m, n = m + 1] = [dtcs[i], i * 2];
            const [v, idx] = [(di + Buffer.plen) / rpt, di / dE + index + (i > 0? 0: nm)];

            const [bxw, bzw] = [bels[m] * hw, bels[n] * hw];
            const [px, py, pz] = [vecs[m], vec3s[i].z, vecs[n]];

            Buffer.p_uv.push(1, v, idx, 0, v, idx);
            this.pushColor(Buffer.p_color, params.sci, params.sci);
            Buffer.p_position.push(px + bxw, py, pz + bzw, px - bxw, py, pz - bzw);

            if (i < dlen - 1) {
                Buffer.eventIdx.push(index, index);
                this.sideIndices(Buffer.p_indices, i, Buffer.ofs);
            }
        }
        Buffer.ofs += dlen * 2;
        Buffer.plen += dE;
    },

    // 路径材质
    pathsMtl: function(params) {
        return this.mtl.shader({
            uniforms: {
                u_time: { value: 0 },
                // u_width: { value: params.hlfWidth },
                u_index: { value: this.inAmtOpts.showIndex },
                u_txue: { value: this.Txues[`_${params.txue}`] }
            },
            // wireframe: true,
            transparent: true, 
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetUnits: 3.0,
            polygonOffsetFactor: 0.6,
            // blending: THREE.AdditiveBlending,
            vertexShader: _Shaders_path.PathVShader,
            fragmentShader: _Shaders_path.PathFShader
        });
    },

    // 创建路径对象 入口
    creatPaths: function(params) {
        const pGeo = this.geo.buf();
        const Buffer = { //- buffer
            eventIdx: [], p_indices: [], plen: 0, ofs: 0, // 点偏移
            p_uv: [], p_ratio: [], p_color: [], p_position: []
        };
        
        params.hlfWidth = params.width * 0.5;
        const colorArr = this.handleColor(params.colorsArr);
        const [datalen, clen] = [params.data.length, colorArr.length];

        this.initAmtOpts(datalen - 1, params.visible);

        for (let i = 0; i < datalen; i++) {
            const di = params.data[i];

            const randomC = Math.random();
            const ck = params.colorType ? i % clen : (clen * randomC | 0);
            params.randomC = randomC;
            params.sci = colorArr[ck];

            this.pathsBuffer(di, Buffer, params, i);
        }
        
        pGeo.setIndex(Buffer.p_indices);
        pGeo.addAttribute('cUv', new THREE.Float32BufferAttribute(Buffer.p_uv, 3));
        pGeo.addAttribute('cColor', new THREE.Float32BufferAttribute(Buffer.p_color, 4));
        pGeo.addAttribute('position', new THREE.Float32BufferAttribute(Buffer.p_position, 3));

        const pathEffect = new THREE.Mesh(pGeo, this.pathsMtl(params));
        pathEffect.renderOrder = params.renderOrder || 0;
        pathEffect.name = 'pathEffect';

        pathEffect.userData.eventIdx = Buffer.eventIdx;
        pathEffect.userData.data = params.data;

        // 入场显示
        pathEffect._inAnimate = true;
        // 流动效果
        pathEffect._isFlow = true;
        pathEffect._transTimes = 0;
        pathEffect._perTimes = 0.5;

        return pathEffect;
    },

    // ----------
    // 构面及计算点斜率
    getPathInfo: function(path, indices = false, beveling = true, close = false) {
        const Rlt = geoEtds.flatten(path);
        if (indices) Rlt.indices = geoEtds.triangulate(Rlt.vertices, Rlt.holes);
        if (beveling) Rlt.beveling = geoEtds.offsetPolygon2(Rlt.vertices, Rlt.holes, close);
        return Rlt;
    },

    //- 形状侧面
    sideIndices: function(Indices, idx, ofs, key = 2) {
        const a = ofs + idx * key;
        Indices.push(a + key, a, a + 1, a + 1, a + key + 1, a + key);
    },

    // --------- 处理连续动画 --------------
    // 初始化参数
    initAmtOpts: function(allLen, showIdx) {
        const showNnm = showIdx < 0 ? allLen + 1 : showIdx;
        this.inAmtOpts.allIndex = allLen;
        this.inAmtOpts.crtIndex = showNnm - 0;
        this.inAmtOpts.showIndex = showNnm - 1;
    },

    // 设置显示个数 及速度
    setShowIdx: function(idx, speed) {
        idx = idx - 0;
        this.inAmtOpts.isStop = false;
        if (!isNaN(idx)) this.initAmtOpts(this.inAmtOpts.allIndex, idx);
        if (!isNaN(speed)) this.inAmtOpts.speed = speed;
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
// export { pathEffect };