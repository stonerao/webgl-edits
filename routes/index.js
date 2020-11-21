const router = require('koa-router')();
var fs = require('fs'); 

router.get('/', async (ctx, next) => {
  const components = [];
  const blacklist = ['lib', 'config'];
  const files = fs.readdirSync('./public');
  files.forEach(function (item, index) {
    let stat = fs.lstatSync("./public/" + item)
    if (stat.isDirectory() === true && blacklist.indexOf(item) == -1) {
      components.push(item)
    }
  })
  await ctx.render('index', {
    title: 'Hello Koa 2!',
    list: []
  })
})

router.get('/list', async (ctx, next) => {

  const components = [];
  const blacklist = ['lib', 'config'];
  const files = fs.readdirSync('./public/items');
  files.forEach(function (item, index) {
    let stat = fs.lstatSync("./public/items/" + item)
    if (stat.isDirectory() === true && blacklist.indexOf(item) == -1) {
      components.push({
        name: item,
        url: './items/' + item
      })
    }
  })
  
  await ctx.render('index', {
    title: 'Hello Koa 2!',
    list: components
  })
})

router.get('/json', async (ctx, next) => {
  ctx.body = {
    title: 'koa2 json'
  }
})

module.exports = router