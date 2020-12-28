/**
* 公用方法
*/
const W3dUtils = {
    setObjectVal(obj, options) {
        Object.keys(options).forEach((key) => {
            if (obj.hasOwnProperty(key)) {
                obj[key] = options[key];
            }
        })
    },
    stringify(data) {
        try {
            return JSON.stringify(data);
        } catch (err) {
            return "{}";
        }
    },
    toRgba(color, opacity = 1) {
        const c = color.getStyle();
        const d = c.replace("rgb(", "rgba(").replace(")", "," + opacity + ")")
        return d;
    }
};