/**
* 构造函数 返回当前函数中的所有方法
* 有函数才会注册
*/
(function (options) {
    const {
        mesh, // 物体
        time, // 当前物体的时间 只用于效果 如果如果无效果一直为0  有效果value 一直++
        scene, // 整体场景
        camera // 摄像头
    } = options;
    /**
    * 物体加载前
    */
    this.before = () => {

    }
    /**
    * 物体加载完成后
    */
    this.after = () => {

    }
    /**
     * 物体被点击 注册了方法才会被点击
     * 当前物体的所有children都会被注册点击事件
     * @parms String    物体名称
     */
    this.click = (name) => {

    }
    /**
     * 物体被销毁
     */
    this.destroyed = () => {

    }
    return this;
})