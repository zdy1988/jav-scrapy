// 此程序使用 javbus.com 为 make 出来的数据做补充数据

require("colors");

var mysql = require("mysql");
var request = require("request");
var cheerio = require("cheerio");
var async = require("async");
var program = require('commander');
var path = require("path");
var fs = require("fs");

var website = require("./www.javbus.com.js");

const version = require('./package.json').version;

program
    .version(version)
    .usage('[options]')
    .option('-i, --index <num>', '设置起始页数，默认值：1', 1)
    .parse(process.argv);

// 创建数据库连接池
var pool = mysql.createPool({
  host: "localhost", // 数据库地址
  user: "root", // 数据库用户
  password: "1234", // 对应的密码
  database: "mdb", // 数据库名称
  connectionLimit: 100, // 最大连接数，默认为10
});

var page_index = parseInt(program.index);
var loop_cur_data = [];

function find(page_index, callback) {
  var sql = "SELECT * FROM movie_make ORDER BY MovieID LIMIT ?,?";

  pool.getConnection(function (err, connection) {
    if (err) {
      console.error(err);
    }

    var size = 25;
    var offset = (page_index - 1) * size;

    connection.query(sql, [offset, size], function (err, result) {
      if (err) {
        console.log("[REREY FIND ERROR] - ", err.message);
      }

      callback(result);
    });

    connection.release();
  });
}

function save(item) {
  var sql = "update movie_make set Title = ?, Description =?, Pubdate = ?, Actor = ?, Duration = ?, Tags = ?, Error=?, Director=?, Producer=?, Publisher=?, Series=? where ID = ?";

  pool.getConnection(function (err, connection) {
    if (err) {
      console.error(err);
    }

    connection.query(sql, [item.Title, item.Description, item.Pubdate, item.Actor, item.Duration, item.Tags, item.Error, item.Director, item.Producer, item.Publisher, item.Series, item.ID], function (err, result) {
      if (err) {
        console.log("[UPDATE ERROR] - ", err.message);
      }
    });

    connection.release();
  });
}

async.during(
  function (callback) {
    find(page_index, function (result) {
      if (result.length > 0) {
        loop_cur_data = result;
        return callback(null, true);
      } else {
        return callback(null, false);
      }
    });
  },
  function (callback) {
    async.forEachOfLimit(loop_cur_data, 5, handleItem, function (err) {
      if (err) {
        throw err;
      }

      console.log("===== 第%d页处理完毕 =====".green, page_index);
      console.log();

      page_index++;
      return callback();
    });
  },
  function (err) {
    if (err) {
      console.log(err);
    }
    return process.exit(0);
  }
);

function handleItem(item, index, callback) {
  let url = "https://www.javbus.com/" + item.MovieID;

  request.get(url, function (err, res, body) {
    if (err) {
      console.error(("[" + item.MovieID + "]").red.bold.inverse + " " + err.message.red);

      item.Error = err.message;

      // 出错或者超时保存链接，后续处理
      save(item);

      return callback(null);
    }

    console.log("处理：".green + item.MovieID.yellow);

    let $ = cheerio.load(body);

    var meta = website.get_item_page_data($, {});
 
    //保存数据
    if (isEmpty(item.Title)) item.Title = meta.title;
    if (isEmpty(item.Pubdate))  item.Pubdate = meta.date;
    if (isEmpty(item.Duration))   item.Duration = meta.duration;
    if (isEmpty(item.Director))   item.Director = meta.director;
    if (isEmpty(item.Producer))   item.Producer = meta.producer;
    if (isEmpty(item.Publisher))   item.Publisher = meta.publisher;
    if (isEmpty(item.Series))   item.Series = meta.series;
    if (!isEmpty(meta.tags))   item.Tags = meta.tags;

    item.CoverUrl = meta.img;
    item.Actor = meta.actress;

    save(item);

    if (item.CoverUrl) {
      handleImage(item, callback);
    } else {
      callback();
    }
  });
}

function handleImage(item, done) {
  var filename = item.MovieID + ".jpg";
  var fileFullPath = path.join(website.output, filename);
  fs.access(fileFullPath, fs.F_OK, function (err) {
    if (err) {
      var coverFileStream = fs.createWriteStream(fileFullPath + ".part");
      var finished = false;

      request
        .get(website.get_valid_img_url(item.CoverUrl))
        .on("end", function () {
          if (!finished) {
            fs.renameSync(fileFullPath + ".part", fileFullPath);
            finished = true;
            console.error(("[" + item.MovieID + "]").green.bold.inverse + "[封面]".yellow.inverse, fileFullPath);
            return done();
          }
        })
        .on("error", function (err) {
          if (!finished) {
            finished = true;
            console.error(("[" + item.MovieID + "]").red.bold.inverse + "[封面]".yellow.inverse, err.message.red);
            return done();
          }
        })
        .pipe(coverFileStream);
    } else {
      console.log(("[" + item.MovieID + "]").green.bold.inverse + "[封面]".yellow.inverse, "file already exists, skip!".yellow);
      return done();
    }
  });
}

function isEmpty(str) {
  return str == "" || str == null || str == undefined;
}
