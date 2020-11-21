function getFileConent(data, width, height) {
    
    return `function () {
    return {
        //组件初始化
        init: function (options) {
            this._super.apply(this, arguments);
        },
        //容器内所有组件加载完成
        allChildrenLoaded: function () {
            /**
            * 请把容器的宽度设置为${width}，高度设置为${height}
            * 如有问题请联系
            */
            var cont_id = ""; // 容器ID
            var config = {
                background: {
                    color: '#1E1F22',
                    opacity: 0.0,

                }, //背景色和透明度
                camera: {
                    far: 10000, position: [0, 0, 100], 
                    width: ${width},
                    height: ${height}
                },
                controls: { //控制器
                    enablePan: false,
                    enableZoom: false,
                    enableRotate: false,
                },
                texture: {
                },
                scale: window.tinyWidget ? window.tinyWidget.util.getScale() : 1
            };


            var INT = new FlyInitialize();
            INT.init(cont_id, config); //初始化
            INT.render();
          
            var data = ${data};

            INT.addFly(data);

            var _element = $("#" + cont_id).widget()._element;
            $(_element).on("$destroy", function () {
                //-
                INT.disposeRender();
            });

        },
    };
}`
}

module.exports = {
    getFileConent
}