require("colors");

var mysql = require("mysql");
var async = require("async");

// 创建数据库连接池
var pool = mysql.createPool({
  host: "localhost", // 数据库地址
  user: "root", // 数据库用户
  password: "1234", // 对应的密码
  database: "mdb", // 数据库名称
  connectionLimit: 100, // 最大连接数，默认为10
});

function find(callback) {
  var sql = "SELECT * FROM codes";

  pool.getConnection(function (err, connection) {
    if (err) {
      console.error(err);
    }

    connection.query(sql, function (err, result) {
      if (err) {
        console.log("[REREY FIND ERROR] - ", err.message);
      }

      callback(result);
    });

    connection.release();
  });
}

function add(data) {
  var sql = "INSERT INTO movie_make (MovieID) VALUES ?";

  pool.getConnection(function (err, connection) {
    if (err) {
      console.error(err);
    }

    connection.query(sql, [data], function (err, result) {
      if (err) {
        console.log("[REREY FIND ERROR] - ", err.message);
      }
    });

    connection.release();
  });
}

function excute(sql) {
  pool.getConnection(function (err, connection) {
    if (err) {
      console.error(err);
    }

    connection.query(sql, function (err, result) {
      if (err) {
        console.log("[REREY FIND ERROR] - ", err.message);
      }
    });

    connection.release();
  });
}

find(function (items) {
  async.forEachOfLimit(items, 5, handleItem, function (err) {
    if (err) {
      throw err;
    }

    console.log("===== 处理完毕 =====".green);
    console.log();
  });
});

function handleItem(item, i, callback) {
  var len = item.Num.length;
  var num = parseInt(item.Num);

  if (num <= 9999) {
    console.log(item.Cod);

    var data = [];

    for (var j = 1; j < num; j++) {
      var code = item.Cod + "-" + j.toString().padStart(len, "0");

      data.push([ code]);
    }

    if (data.length > 0) {
      add(data);
    }
  }

  setTimeout(function () {
    callback();
  }, 100);
}
