var mysql = require('mysql');

// 创建数据库连接池
var pool = mysql.createPool({
    host: 'localhost', // 数据库地址
    user: 'root', // 数据库用户
    password: '1234', // 对应的密码
    database: 'mdb', // 数据库名称
    connectionLimit: 100 // 最大连接数，默认为10
});

var insert_sql = 'INSERT INTO movie(ID, MovieID, Title, Description, Pubdate, Actor, Duration, Tags, Url, CoverUrl, Error) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
var find_sql = 'SELECT * FROM movie WHERE ID = ?'
var update_sql = 'UPDATE movie SET Title = ?, Description = ?, Pubdate = ?, Actor = ?, Duration = ?, Tags = ?, CoverUrl = ?, Error=? WHERE ID = ?';

function save(item) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err)
        }

        connection.query(find_sql, [item.id], function (err, result) {
            if (err) {
                console.log('[FIND ERROR] - ', err.message);
            }

            if (result && result.length == 0) {
                connection.query(insert_sql, [item.id, item.fanhao, item.title, item.description, item.date, item.actress, item.duration, item.tags, item.url, item.img, item.error], function (err, result) {
                    if (err) {
                        console.log('[INSERT ERROR] - ', err.message);
                    }
                });
            } else {
                connection.query(update_sql, [item.title, item.description, item.date, item.actress, item.duration, item.tags, item.img, null, item.id], function (err, result) {
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

var find_fail_sql = "SELECT * FROM movie WHERE Title IS NULL AND Error IS NOT NULL ORDER BY MovieID LIMIT ?,?";

function find_fail_list(page_index, callback) {
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err);
        }

        var size = 25
        var offset = (page_index - 1) * size

        connection.query(find_fail_sql, [offset, size], function (err, result) {
            if (err) {
                console.log('[REREY FIND ERROR] - ', err.message);
            }

            callback(result);
        })

        connection.release();
    })
}

exports.find_fail_list = find_fail_list