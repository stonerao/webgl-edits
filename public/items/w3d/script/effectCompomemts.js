/**
* 效果组件集合
*/
window.EffectCom = {
    comments: [
        {
            id: 0,
            name: "光罩",
            icon: "",
            func: "CreatBlitzball",
            zIndex: 1,
            options: {
                blitzball: [
                    {
                        type: 0, // 类型：0-水纹形，1-闪电形
                        points: [[0, 0, 0]], //位置数据
                        radius: 120, // 半径
                        wSeg: 50, // 宽度分段数
                        hSeg: 50, // 高度分段数
                        phiLength: Math.PI * 2, // 左右半圆参数
                        thetaLength: Math.PI * 0.5, // 上下半圆参数
                        density: 4, // 密度（水纹形）
                        colors: ['#ff3879', '#a8ff4e', '#68ebff'], // 颜色集合（三个）
                        opacity: 1 //透明值
                    }
                ]
            }
        },
        {
            id: 1,
            name: "光罩1",
            icon: "",
            func: "CreatBlitzball",
            zIndex: 1,
            options: {
                blitzball: [
                    {
                        type: 1, // 类型：0-水纹形，1-闪电形
                        points: [[0, 0, 0]], //位置数据
                        radius: 120, // 半径
                        wSeg: 50, // 宽度分段数
                        hSeg: 50, // 高度分段数
                        phiLength: Math.PI * 2, // 左右半圆参数
                        thetaLength: Math.PI * 0.5, // 上下半圆参数
                        density: 4, // 密度（水纹形）
                        colors: ['#ff3879', '#a8ff4e', '#68ebff'], // 颜色集合（三个）
                        opacity: 1 //透明值
                    }
                ]
            }
        }
    ],
    effect: [
        {
            id: 1,
            type: "shader",
            center: { x: 0, y: 0, z: 0 }, // 扩散中心点
            name: "扩散光波",
            color: "rgba(255,255,255, 0.9)",
            radius: 3200, // 扫描半径
            range: 50, // 光效宽度
            speed: 200, // 动画速度 
        }, 
        {
            id: 2, 
            type: "add",
            name: "边框线",
            color: "rgba(126,219,255, 1)"
        }
    ]
}