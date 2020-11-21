var fs = require('fs');
var archiver = require('archiver');

const config = require("../config")
var path = config.__dirname;

const zips = async (opts) => {
    // 输出路径
    var output = fs.createWriteStream(opts.output);

    // 创建配置
    var archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    // 打包
    archive.pipe(output);

    // 循环压入
    opts.entry.forEach(elem => {
        console.log(elem)
        var file = path + '/public' + elem;
        const names = file.split("/").pop();

        archive.append(fs.createReadStream(file), { name: names });
    })

    // 生成
    await archive.finalize();
}
module.exports = {
    zips: zips
}