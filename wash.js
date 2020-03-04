require('colors');

var mysql = require('mysql');
var request = require('request');
var cheerio = require('cheerio');
var async = require('async');
var path = require('path');
var fs = require('fs');

var website = require('./javpop.org.js');

// 创建数据库连接池
var pool = mysql.createPool({
    host: 'localhost', // 数据库地址
    user: 'root', // 数据库用户
    password: '1234', // 对应的密码
    database: 'mdb', // 数据库名称
    connectionLimit: 100 // 最大连接数，默认为10
});

var page_index = 1;
var loop_cur_data = []

function find(page_index, callback) {
    var sql = "SELECT * FROM jav WHERE LOCATE('<img' ,Description) > 0 AND Title IS NULL LIMIT ?,?";

    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err);
        }

        var size = 25
        var offset = (page_index - 1) * size

        connection.query(sql, [offset, size], function (err, result) {
            if (err) {
                console.log('[REREY FIND ERROR] - ', err.message);
            }

            callback(result);
        })

        connection.release();
    })
}

function save(item) {
    var sql = "update jav set Title = ?, Pubdate = ?, Actor = ?, Duration = ?, CoverUrl = ?, Error=? where ID = ?"

    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err)
        }

        connection.query(sql, [item.Title, item.Pubdate, item.Actor, item.Duration, item.CoverUrl, item.Error, item.ID], function (err, result) {
            if (err) {
                console.log('[UPDATE ERROR] - ', err.message);
            }
        });

        connection.release();
    });
}

console.log('========== 开始获取数据 =========='.green.bold);

async.during(
    function (callback) {
        find(page_index, function (result) {
            if (result.length > 0) {
                loop_cur_data = result
                return callback(null, true);
            } else {
                return callback(null, false);
            }
        });
    },
    function (callback) {
        async.forEachOfLimit(
            loop_cur_data,
            5,
            handleItem,
            function (err) {
                if (err) {
                    throw err;
                }

                console.log('===== 第%d页处理完毕 ====='.green, page_index);
                console.log();

                page_index++;
                return callback();
            }
        )
    },
    function (err) {
        if (err) {
            console.log(err);
        }
        return process.exit(0);
    }
);

function handleItem(item, index, callback) {
    let $ = cheerio.load(item.Description);
    item.CoverUrl = $("img").attr("src")
    item.Title = $("img").attr("title")
    var info = item.Description.substr(item.Description.indexOf('/>') + 2).split(' ')
    if (info.length == 11) {
        item.Pubdate = info[2].substr(0, 10)
        item.Actor = info[8].replace("収録時間", "")
        item.Duration = info[10]
    }
    save(item)

    console.log(item.MovieID)

    if (item.CoverUrl) {
        handleImage(item, callback)
    } else {
        callback()
    }
}

function handleImage(item, done) {
    var filename = item.MovieID + '.jpg';
    var fileFullPath = path.join("D:\\Magnets\\javpop2\\", filename);
    fs.access(fileFullPath, fs.F_OK, function (err) {
        if (err) {
            var coverFileStream = fs.createWriteStream(fileFullPath + '.part');
            var finished = false;

            request.get(website.get_valid_img_url(item.CoverUrl))
                .on('end', function () {
                    if (!finished) {
                        fs.renameSync(fileFullPath + '.part', fileFullPath);
                        finished = true;
                        console.error(('[' + item.MovieID + ']').green.bold.inverse + '[封面]'.yellow.inverse, fileFullPath);
                        return done();
                    }
                })
                .on('error', function (err) {
                    if (!finished) {
                        finished = true;
                        console.error(('[' + item.MovieID + ']').red.bold.inverse + '[封面]'.yellow.inverse, err.message.red);
                        return done();
                    }
                })
                .pipe(coverFileStream);
        } else {
            console.log(('[' + item.MovieID + ']').green.bold.inverse + '[封面]'.yellow.inverse, 'file already exists, skip!'.yellow);
            return done();
        }
    });
}