const router = require('koa-router')()
const zipl = require('../utils/zip');
const utisl = require('../utils/file');
const fs = require('fs');
const path = require('path');
const config = require("../config.js");

router.prefix('/upload')

router.get('/', function (ctx, next) {
    ctx.body = 'this is a users response!'
})

router.get('/bar', function (ctx, next) {
    ctx.body = 'this is a users/bar response'
});

router.post('/initFile', async (ctx, next) => {
    const body = ctx.request.body;
    const now = Date.now() % 10000;
    const fileConent = utisl.getFileConent(body.data, body.width, body.height);
    const fileName = now + ".zip";
    const jsFile = config.__dirname + '/public/assets/' + "_init.js";
    await fs.writeFile(jsFile, fileConent, async (err) => {
        if (err) {
            return console.log(err);
        }
    });
    await zipl.zips({
        output: path.join(config.__dirname, '/public/assets/' + fileName),
        entry: [
            '/file/FlyInitialize.js',
            '/assets/' + "_init.js"
        ]
    }).then(async (e) => {
        ctx.body = {
            code: 200,
            url: "/assets/"+fileName
        };
        fs.unlinkSync(jsFile);
    })

})

module.exports = router
