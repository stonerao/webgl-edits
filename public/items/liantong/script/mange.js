/**
* 用于处理 管理数据
*/
const store = {
    state: {
        types: [
            { name: "相机", id: 1 }
        ],
        currData: [],
        currType: 1,
        intersect: {}
    },
    setState(opts) {
        for (const key in opts) {
            if (opts.hasOwnProperty(key)) {
                this.state[key] = opts[key];
            }
        }
    }
}