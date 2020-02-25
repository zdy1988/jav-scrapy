var mysql = require('mysql');

// 创建数据库连接池
var pool = mysql.createPool({
    host: 'localhost', // 数据库地址
    user: 'root',      // 数据库用户
    password: '1234',         // 对应的密码
    database: 'mdb',  // 数据库名称
    connectionLimit: 100          // 最大连接数，默认为10
});

var insertsql = 'insert into movie(ID,MovieID,Title,Description,Pubdate,Actor,Duration,Tags,Url,CoverUrl,Error) values(?,?,?,?,?,?,?,?,?,?,?)';
var findsql = 'select * from movie where ID = ?'
var updatesql = 'update movie set Title = ?,Description = ?,Pubdate = ?,Actor = ?,Duration = ?,Tags = ?,CoverUrl = ?,Error=? where ID = ?';

function save(item) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err)
        }

        connection.query(findsql, [item.id], function (err, result) {
            if (err) {
                console.log('[FIND ERROR] - ', err.message);
            }

            if (result && result.length == 0) {
                connection.query(insertsql, [item.id,item.fanhao, item.title, item.description, item.date, item.actress, item.duration, item.tags, item.url, item.img, item.error], function (err, result) {
                    if (err) {
                        console.log('[INSERT ERROR] - ', err.message);
                    }
                });
            } else {
                connection.query(updatesql, [item.title, item.description, item.date, item.actress, item.duration, item.tags, item.img, null, item.id], function (err, result) {
                    if (err) {
                        console.log('[UPDATE ERROR] - ', err.message);
                    }
                });
            }
        })



        connection.release();
    });
}

exports.save = save

var findsql2 = "SELECT * FROM movie WHERE  Title IS NULL AND Error IS NOT NULL";

function find_fail_list (callback) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err);
        }

        connection.query(findsql2, function (err, result) {
            if (err) {
                console.log('[REREY FIND ERROR] - ', err.message);
            }

            callback(result);
        })
    })
}

exports.find_fail_list = find_fail_list