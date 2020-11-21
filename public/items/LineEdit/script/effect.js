__libs_little();

// 渲染器
var renderers = new EffectRender({
    cts: 'webgl',
    background: {
        color: '#000000', opacity: 1.0, type: 'cubSky' // type: shpereSky-天空球,cubSky-天空盒
    },
    texture: {
        txuePath: './images/', //路径
        background: { //背景
            /* shpereSky: 'test.jpg',
            cubSky: { // 天空盒
                px: 'cubSky/px.jpg',
                nx: 'cubSky/nx.jpg',
                py: 'cubSky/py.jpg',
                ny: 'cubSky/ny.jpg',
                pz: 'cubSky/pz.jpg',
                nz: 'cubSky/nz.jpg'
            } */
        },
    },
    composer: {
        isBloom: false, // 是否开启辉光
        bloomThreshold: 0.1, // 辉光亮度阀值，颜色亮度大于阀值起效
        bloomStrength: 0.15, // 辉光强度
        bloomRadius: 1, // 辉光半径

        isFocus: false, // 是否径向模糊
        focusVal: 0.0001, // 径向模糊值
        waveFactor: 0.00000001, //模糊系数

        isAntialias: false, // 是否开启 smaa 、 ssaa 抗锯齿
        antialiasType: 'smaa', // smaa 、 ssaa 抗锯齿 ssaa-硬件要求高
        antialiasLevel: 1, // ssaa 抗锯齿级别
    }
});

console.log(renderers);

var effectHandle = new HandleEffect({
    test: 123,
    renderers
});
 
window.scene = renderers.scene;
renderers.addEffect(effectHandle);
