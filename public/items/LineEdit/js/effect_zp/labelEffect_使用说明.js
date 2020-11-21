// 标注效果 初始化：
var labelEffects = new labelEffect({
    gridHelper: true, // 显示辅助网格
    texture: {
        txuePath: 'images/', //路径
        common: { //常规纹理
            spread: 'cir.png', // 底部扩散纹理
            lightray: 'lightray.jpg', // 中间光柱纹理
            topOut: 'white.png', // 顶部外圈纹理
            topIn: 'fluffy.png', // 顶部内圈纹理
            fontbg: null // 文字背景纹理
        }
    },
    amtOpts: { // 连续动画参数
        speed: 1, // 动画速度
        delay: 0, // 延迟执行下一个
    },
    data: [ // [x, y, z-高度, text内容, 大小系数, colorsArr取值-空则colorType]
        [-100, 0, 1, '测试1', 1, 1],
        [100, 0, 1, '测试2', 1, 1],
        [0, 100, 1, '测试3', 1, 1],
        [0, -100, 1, '测试4', 1, 1],
        [0, 0, 1, '测试2', 1, 1]
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
    colorsArr: [ // 颜色组，[底面颜色， 光柱颜色， 顶部颜色]
        ['#E27943', '#E27943', '#E27943'],
        ['#2FAFF4', '#2FAFF4', '#2FAFF4']
    ]
});

// 节点事件屏蔽
Mesh._unEvent = true; // 拾取节点的 _unEvent 为true 则屏蔽事件

// 事件 接口
labelEffects.onMouseIn = function(e, intersects) {
    // 鼠标移入
    console.log( '--onMouseIn--', e, intersects);
};

labelEffects.onMouseOut = function(e, intersects, key) {
    // 鼠标移出
    console.log( '--onMouseOut--', e, intersects, key);
};

labelEffects.onMouseDown = function(e, intersects) {
    // 鼠标点击
    console.log( '--onMouseDown--', e, intersects);
};

labelEffects.onDblclick = function(e, intersects) {
    // 鼠标双击
    console.log( '--onDblclick--', e, intersects);
};

// 连续动画 接口

    // 执行  对应配置中 visible 不为 -1时
labelEffects.setShowIdx(idx, speed); // idx - 开始显示序号,为空显示下一个； speed - 更改速度

labelEffects.nodeComplete = function(crtIndex, allIndex) {
    // 节点执行完成  crtIndex - 当前序号  allIndex - 所有序号长度
    console.log(crtIndex, allIndex);
};

// eg: 自动显示
/*
// 前置 配置参数中 visible = 0;

labelEffects.setShowIdx(0); 初始显示第一个
labelEffects.nodeComplete = function(crtIndex, allIndex) {
    labelEffects.setShowIdx();
};

*/