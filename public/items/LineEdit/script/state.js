/**
* 全局状态管理
*/

const StateManage = {
    state: {
        editType: 0,
        isKeyCtrl: false, //是否按下ctrl
        lines: [],
        pointImg: "./images/point.png", // 粒子默认材质
        flyOpts: {
            curve: false,
            speed: 3, // 速度
            size: 3, // 粒子大小
            dpi: 1, // 粒子密度
            length: 30, // 粒子长度
            type: 1, // 粒子样式类型
            color: "#fff", // 粒子样式类型
        }
    },
    setState(opts) {
        for (const key in opts) {
            if (opts.hasOwnProperty(key)) {
                this.state[key] = opts[key];
            }
        }
    }
}