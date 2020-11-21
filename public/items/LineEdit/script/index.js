
/**
 * 处理业务逻辑
 */
const VM = new Vue({
    el: "#app",
    data() {
        return {
            cameraVal: 1,
            // 可以添加的效果列表
            addList: options.effects,
            editModels: [
                { name: "添加飞线", id: 0 },
                { name: "编辑飞线", id: 1 },
            ],
            editModelId: 0,
            flyOpts: JSON.parse(JSON.stringify(StateManage.state.flyOpts)),
            flyTypes: [
                { name: "基础样式一", id: 1 },
                { name: "基础样式二", id: 2 },
                { name: "基础样式三", id: 3 },
                { name: "基础样式四", id: 4 },
                { name: "基础样式五", id: 5 },
                { name: "基础样式六", id: 6 },
                { name: "图片样式流动", id: 101 },
            ],
            lineLayer: [],
            selectFly: {},
            importShow: false,
            importText: "",
            params: {
                width: 1000,
                height: 500
            },
            msgShow: false
        }
    },
    mounted() {
        window.addEventListener('keydown', this.onKeydown, false);
        window.addEventListener('keyup', this.onKeyup, false);

        /* setTimeout(() => {
            const data_1603696539710 = { "img": null, "data": [{ "uuid": "DA863461-5991-42D7-B8AE-058A3262E844", "data": [{ "x": -392, "y": 153.5, "z": 1 }, { "x": -418, "y": -151.5, "z": 1 }, { "x": -44, "y": 85.5, "z": 1 }, { "x": 157, "y": 120.5, "z": 1 }, { "x": 348, "y": 177.5, "z": 1 }], "options": { "img": null, "curve": false, "speed": 3, "size": 3, "dpi": 1, "length": 30, "type": 1, "color": "#fff" } }, { "uuid": "BF095C5A-FBCA-4F02-815E-E379C8AC331F", "data": [{ "x": 357, "y": 182.5, "z": 1 }, { "x": 528, "y": 255.5, "z": 1 }], "options": { "img": null, "curve": false, "speed": 3, "size": 3, "dpi": 1, "length": 30, "type": 1, "color": "#fff" } }] }
            console.log(data_1603696539710)
            this.importText = JSON.stringify(data_1603696539710);
            this.importEvent();
        }, 1000) */
    },
    methods: {
        // 添加效果
        addEffect(opts) {
            effectHandle.addEffect(opts);
        },
        // 上传背景图
        uploadBg(fileinput) {
            this.fileImg(fileinput, (opts) => {
                effectHandle.setBackground(opts);
                this.params.width = opts.width;
                this.params.height = opts.height;
            });
        },
        // 上传背景图
        uploadPoint(fileinput) {
            this.fileImg(fileinput, function (opts) {
                StateManage.setState({
                    pointImg: opts.img
                });
                effectHandle.setFlyImg(opts.img)
            });

        },
        // 上传图片
        fileImg(fileinput, callback) {
            const file = fileinput.target;
            // getBase64()
            if (!file.files[0]) return false;
            var dataURL = URL.createObjectURL(file.files[0])    // 创建URL对象

            getBase64(dataURL, (opts) => {
                callback(opts);
            })
        },

        onKeydown(event) {
            StateManage.setState({
                isKeyCtrl: true
            });
        },

        onKeyup(event) {
            StateManage.setState({
                isKeyCtrl: false
            });
            effectHandle.quitRay();

            this.updateLayer();
        },

        // 更新飞线图层
        updateLayer() {
            const { lines } = StateManage.state;
            this.lineLayer = lines;
        },
        showLine(item) {
            effectHandle.showLine(item.uuid);
        },
        setFly(item) {
            Object.keys(item.options).forEach(key => {
                if (this.flyOpts.hasOwnProperty(key)) {
                    item.options[key] = this.flyOpts[key];
                }
            })
            StateManage.setState({
                lines: this.lineLayer
            });

            effectHandle.updateLine();
        },

        delFly(item) {
            this.lineLayer = this.lineLayer.filter((elem) => {
                return elem.uuid !== item.uuid;
            });
            StateManage.setState({
                lines: this.lineLayer
            });
            effectHandle.updateLine();
        },
        restore() {
            this.lineLayer.forEach((item) => {
                Object.keys(item.options).forEach(key => {
                    if (this.flyOpts.hasOwnProperty(key)) {
                        if (key == "curve") {
                            console.log(this.flyOpts, item.options)
                        }
                        item.options[key] = this.flyOpts[key];
                    }
                })
            })

            StateManage.setState({
                lines: this.lineLayer
            });

            effectHandle.updateLine();
        },

        delCimg(item) {
            item.options.img = null;
            StateManage.setState({
                lines: this.lineLayer
            });

            setTimeout(() => {
                effectHandle.updateLine();
            }, 200);
        },
        setImg(item, id) {
            this.selectFly = item;
            $("#" + id).click();
            console.log(id)
        },
        uploadCimg(fileinput) {
            this.fileImg(fileinput, (opts) => {
                this.lineLayer.forEach((item) => {
                    if (item.uuid == this.selectFly.uuid) {
                        item.options.img = opts.img;
                    }
                })
            });
            StateManage.setState({
                lines: this.lineLayer
            });
            setTimeout(() => {
                effectHandle.updateLine();
            }, 200);
        },


        // 导出
        exportEvent() {
            // const circleImg = 
            const pointImg = StateManage.state.pointImg;
            const data = {
                img: pointImg,
                data: this.lineLayer
            };
            const jdata = JSON.stringify(data);

            $.ajax({
                type: "post",
                data: {
                    data: jdata,
                    width: this.params.width,
                    height: this.params.height
                },
                url: '/upload/initFile',
                success: function (data) {
                    console.log(data)
                    if (data.code == 200) {
                        window.open(data.url);
                    }
                }
            })
        },
        // 导入
        importEvent() {
            try {
                const json = JSON.parse(this.importText);
                this.lineLayer = json.data;
                StateManage.setState({
                    pointImg: json.img,
                    lines: this.lineLayer
                });
                effectHandle.updateLine();
                this.importShow = false;
            } catch (err) {
                console.err(err);
            }
        },
        exportClose() {
            this.$confirm('确认关闭？')
                .then(_ => {
                    done();
                })
                .catch(_ => { });
        },


    },
    components: {
        "c-scroll": scrollCom,
    },
    watch: {
        cameraVal(val) {
            renderers.tabCamera(val);
        },
        editModelId(val) {
            StateManage.setState({
                editType: val
            });
        },


        ['flyOpts.curve'](val) { StateManage.setState({ flyOpts: this.flyOpts }) },
        ['flyOpts.speed'](val) { StateManage.setState({ flyOpts: this.flyOpts }) },
        ['flyOpts.size'](val) { StateManage.setState({ flyOpts: this.flyOpts }) },
        ['flyOpts.dpi'](val) { StateManage.setState({ flyOpts: this.flyOpts }) },
        ['flyOpts.length'](val) { StateManage.setState({ flyOpts: this.flyOpts }) },
        ['flyOpts.type'](val) { StateManage.setState({ flyOpts: this.flyOpts }) },
        ['flyOpts.color'](val) { StateManage.setState({ flyOpts: this.flyOpts }) },
    },
});



function getBase64(url, callback) {
    //通过构造函数来创建的 img 实例，在赋予 src 值后就会立刻下载图片，相比 createElement() 创建 <img> 省去了 append()，也就避免了文档冗余和污染
    var Img = new Image(),
        dataURL = '';
    Img.src = url;
    Img.onload = function () { //要先确保图片完整获取到，这是个异步事件
        var canvas = document.createElement("canvas"), //创建canvas元素
            width = Img.width, //确保canvas的尺寸和图片一样
            height = Img.height;
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(Img, 0, 0, width, height); //将图片绘制到canvas中
        dataURL = canvas.toDataURL('image/png'); //转换图片为dataURL
        callback({
            img: dataURL,
            width: width,
            height: height
        })
    };
}

function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

