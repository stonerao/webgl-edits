// 标注效果 初始化：
var pathEffects = new labelEffect({
    gridHelper: true, // 显示辅助网格
    texture: {
        txuePath: 'images/', //路径
        repeat: { //重复纹理
            path: 'path.png'
        }
    },
    amtOpts: { // 连续动画参数
        speed: 0.4, // 动画速度
        delay: 1 // 延迟执行下一个
    },
    data: [ // [ x坐标, y坐标, z坐标]
        [[-89, 209, 40], [-52, 190, 45], [14, 167, 55], [65, 168, 65], [85, 137, 60]],
        [[85, 137, 60], [54, 111, 70], [44, 55, 56]],
        [[44, 55, 56], [-5, -26, 80], [-184, -33, 58]],
    ],
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
});

// 节点事件屏蔽
Mesh._unEvent = true; // 拾取节点的 _unEvent 为true 则屏蔽事件

// 事件 接口
pathEffects.onMouseIn = function(e, intersects) {
    // 鼠标移入
    console.log( '--onMouseIn--', e, intersects);
};

pathEffects.onMouseOut = function(e, intersects, key) {
    // 鼠标移出
    console.log( '--onMouseOut--', e, intersects, key);
};

pathEffects.onMouseDown = function(e, intersects) {
    // 鼠标点击
    console.log( '--onMouseDown--', e, intersects);
};

pathEffects.onDblclick = function(e, intersects) {
    // 鼠标双击
    console.log( '--onDblclick--', e, intersects);
};

// 连续动画 接口

    // 执行  对应配置中 visible 不为 -1时
pathEffects.setShowIdx(idx, speed); // idx - 开始显示序号,为空显示下一个； speed - 更改速度

pathEffects.nodeComplete = function(crtIndex, allIndex) {
    // 节点执行完成  crtIndex - 当前序号  allIndex - 所有序号长度
    console.log(crtIndex, allIndex);
};

// eg: 自动显示
/*
// 前置 配置参数中 visible = 0;

pathEffects.setShowIdx(0); 初始显示第一个
pathEffects.nodeComplete = function(crtIndex, allIndex) {
    pathEffects.setShowIdx();
};

*/