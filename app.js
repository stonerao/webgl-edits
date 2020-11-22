const Koa = require('koa')
const app = new Koa()
const views = require('koa-views')
const json = require('koa-json')
const onerror = require('koa-onerror')
const bodyparser = require('koa-bodyparser')
const logger = require('koa-logger')
const fs = require('fs');
const index = require('./routes/index')
const users = require('./routes/users')
const upload = require('./routes/upload')
const camera = require('./routes/camera')


/* gzip压缩配置 start */
const compress = require('koa-compress');
const options = {
  threshold: 1024 //数据超过1kb时压缩
};
app.use(compress(options));

const koaBody = require('koa-body');
app.use(koaBody({
  multipart: true,
  formLimit: "50mb",
  jsonLimit: "50mb",
  textLimit: "50mb",
  formidable: {
    maxFileSize: 1024 * 100 * 1024 * 1024    // 设置上传文件大小最大限制，默认1G
  }
}));


// error handler
onerror(app)

// middlewares
app.use(bodyparser({
  enableTypes: ['json', 'form', 'text']
}))
app.use(json())
app.use(logger())
app.use(require('koa-static')(__dirname + '/public'))

app.use(views(__dirname + '/views', {
  extension: 'ejs'
}))

// logger
app.use(async (ctx, next) => {
  // const start = new Date()
  await next()
  /* const ms = new Date() - start
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`); */
  if (parseInt(ctx.status) === 404) {
    const components = [];
    const paths = decodeURI(ctx.request.url);
    const fileUrl = './public' + paths;
    const files = fs.readdirSync(fileUrl);
    files.forEach(function (item, index) {
      let stat = fs.lstatSync(fileUrl + item)
      if (stat.isDirectory() === true) {
        components.push({
          name: item,
          url: '.' + paths + item
        })
      }
    })
    if (components.length != 0) {
      await ctx.render('index', {
        title: 'THREE',
        list: components
      });
    } else {
      ctx.response.redirect("/list");
    }

  }
})

// routes
app.use(index.routes(), index.allowedMethods())
app.use(users.routes(), users.allowedMethods())
app.use(upload.routes(), upload.allowedMethods())
app.use(camera.routes(), camera.allowedMethods())

// error-handling
app.on('error', (err, ctx) => {
  // console.error('server error', err, ctx)
});

module.exports = app