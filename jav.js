require('colors');

var request = require('request');
var cheerio = require('cheerio');
var async = require('async');
var program = require('commander');
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');

var website = require('./javpop.org.js');
var database = require('./database.js')

const version = require('./package.json').version;

program
    .version(version)
    .usage('[options]')
    .option('-m, --mode <string>', '设置抓取模式', 'normal')
    .option('-p, --parallel <num>', '设置抓取并发连接数，默认值：3', 3)
    .option('-i, --index <num>', '设置起始页数，默认值：1', 1)
    .option('-r, --retry <num>', '设置重试次数，默认值：5', 5)
    .option('-t, --timeout <num>', '自定义连接超时时间(毫秒)。默认值：30000毫秒')
    .option('-l, --limit <num>', '设置抓取影片的数量上限，0为抓取全部影片。默认值：0', 0)
    .option('-o, --output <file_path>', '设置磁链和封面抓取结果的保存位置，默认为当前用户的主目录下的 magnets 文件夹', website.output)
    .option('-s, --search <string>', '搜索关键词，可只抓取搜索结果的磁链或封面')
    .option('-x, --proxy <url>', '使用代理服务器, 例：-x http://127.0.0.1:8087')
    .option('-n, --nomag', '是否抓取尚无磁链的影片')
    .option('-a, --allmag', '是否抓取影片的所有磁链(默认只抓取文件体积最大的磁链)')
    .parse(process.argv);

var mode = program.mode
var parallel = parseInt(program.parallel);
var timeout = parseInt(program.timeout) || 30000;
var proxy = process.env.http_proxy || program.proxy;
var page_index = parseInt(program.index);
var retry_times = parseInt(program.retry)
var count = parseInt(program.limit);
var has_limit = (count !== 0),
    targetFound = false;
var output = program.output.replace(/['"]/g, '');

request = request.defaults({
    timeout: timeout
});

request = proxy ? request.defaults({
    'proxy': proxy
}) : request;

mkdirp.sync(output);

console.log('========== 获取资源站点：%s =========='.green.bold, website.url);
console.log('并行连接数：'.green, parallel.toString().green.bold, '      ', '连接超时设置：'.green, (timeout / 1000.0).toString().green.bold, '秒'.green);
console.log('磁链保存位置: '.green, output.green.bold);
console.log('代理服务器: '.green, (proxy ? proxy : '无').green.bold);

// MAIN LOOP START ! 

var current_page_html = null;

function main() {
    if (mode == 'normal') {
        loop_start();

    } else {
        loop_fail_start();
    }
}

main();

function loop_start() {
    async.during(
        page_exist,
        // when page exist
        function (callback) {
            async.waterfall(
                [parse_links, get_items],
                function (err) {
                    page_index++;
                    if (err) return callback(err);
                    return callback(null);
                });
        },
        handle_loop_error
    );
}

function loop_fail_start() {
    console.log("========== 开始重试失败链接 ==========".green)
    async.during(
        function (callback) {
            return callback(null, true);
        },
        function (callback) {
            async.waterfall(
                [get_fail_links, get_items],
                function (err) {
                    page_index++;
                    if (err) return callback(err);
                    return callback(null);
                });
        },
        handle_loop_error
    );
}

function handle_loop_error(err) {
    if (err) {
        if (typeof (err.message) == "string" && err.message.toLowerCase().indexOf("timeout") != -1) {
            console.log('抓取过程超过重试次数，等待 60 秒后再次重试');
            setTimeout(function () {
                console.log('已经等待60秒，准备开始...')
                main()
            }, 60000)
        } else {
            console.log('抓取过程终止：%s', err.message);
            return process.exit(1);
        }
    } else {
        if (has_limit && (count < 1)) {
            console.log('已尝试抓取%s部影片，本次抓取完毕'.green.bold, program.limit);
        } else {
            console.log('抓取完毕'.green.bold);
        }
        return process.exit(0); // 不等待未完成的异步请求，直接结束进程
    }
}

function page_exist(callback) {
    if (has_limit && (count < 1) || targetFound) {
        return callback();
    }

    var url = website.url + (page_index === 1 ? '' : ('page/' + page_index + '/'));

    if (program.search) {
        url = website.url + (page_index === 1 ? '' : ('page/' + page_index + '/')) + '?s=' + encodeURI(program.search);
    } else {
        // 只在没有指定搜索条件时显示
        console.log('获取第%d页中的影片链接 ( %s )...'.green, page_index, url);
    }

    let retry_count = 1;

    async.retry({
        times: retry_times,
        interval: function (count) {
            retry_count = count;
            return 500 * Math.pow(2, count);
        }
    }, function (callback) {
        request.get({
            url: url
        }, function (err, res, body) {
            if (err) {
                if (err.status === 404) {
                    console.error('已抓取完所有页面, StatusCode:', err.status);
                } else {
                    console.error('第%d页页面获取失败：%s'.red, page_index, err.message);
                    console.error('...进行第%d次尝试...'.red, retry_count);
                }
                return callback(err);
            }

            current_page_html = body;
            return callback(null, res);
        });
    }, function (err, res) {
        if (err) {
            if (err.status === 404) {
                return callback(null, false);
            }
            return callback(err, false);
        }
        return callback(null, res.statusCode == 200);
    });
}

function parse_links(next) {
    let $ = cheerio.load(current_page_html);
    let links = [],
        fanhao = [];

    let list_items = website.get_list_items($)
    let total_count_cur_page = list_items.length;

    if (has_limit) {
        if (count > total_count_cur_page) {
            list_items.each(link_fanhao_handler);
        } else {
            list_items.slice(0, count).each(link_fanhao_handler);
        }
    } else {
        list_items.each(link_fanhao_handler);
    }

    if (program.search && links.length == 1) {
        targetFound = true;
    }

    function link_fanhao_handler(i, e) {
        var item = website.get_list_item_link($, e)
        links.push(item)
        fanhao.push(item.fanhao)
    }

    console.log('正处理以下番号影片...\n'.green + fanhao.toString().yellow);
    next(null, links);
}

function get_items(links, next) {
    async.forEachOfLimit(
        links,
        parallel,
        get_item_page,
        function (err) {
            if (err) {
                if (err.message === 'limit') {
                    return next();
                }
                throw err;
            }
            console.log('===== 第%d页处理完毕 ====='.green, page_index);
            console.log();
            return next();
        });
}

function get_item_page(link, index, callback) {
    let fanhao = link.fanhao

    let coverFilePath = path.join(output, fanhao + '.jpg');
    let magnetFilePath = path.join(output, fanhao + '.txt');
    if (has_limit) {
        count--;
    }
    try {
        fs.accessSync(coverFilePath, fs.F_OK);
        fs.accessSync(magnetFilePath, fs.F_OK);
        console.log(('[' + fanhao + ']').yellow.bold.inverse + ' ' + 'Alreday fetched, SKIP!'.yellow);
        return callback();
    } catch (e) {
        request
            .get(link.url, function (err, res, body) {
                let meta = {}

                meta.id = link.id
                meta.url = link.url
                meta.fanhao = fanhao

                if (err) {
                    console.error(('[' + fanhao + ']').red.bold.inverse + ' ' + err.message.red);

                    meta.error = err.message

                    // 出错或者超时保存链接，后续处理
                    database.save(meta)

                    return callback(null);
                }

                let $ = cheerio.load(body);

                meta = website.get_item_page_data($, meta);

                //保存数据
                database.save(meta)

                // 封面
                get_item_cover(meta, callback);

                // 所有截图link
                var snapshots = website.get_item_page_snapshots($)

                get_snapshots(meta, snapshots);
            });
    }
}

function get_snapshots(meta, snapshots) {
    for (var i = 0; i < snapshots.length; i++) {
        get_snapshot(meta, snapshots[i]);
    }
}

function get_snapshot(meta, snahpshotLink) {
    let fanhao = meta.fanhao
    let itemOutput = output + '/' + fanhao;
    mkdirp.sync(itemOutput);

    let snapshotName = snahpshotLink.split('/').pop();
    let fileFullPath = path.join(itemOutput, snapshotName);
    fs.access(fileFullPath, fs.F_OK, function (err) {
        if (err) {
            var snapshotFileStream = fs.createWriteStream(fileFullPath + '.part');
            var finished = false;
            request.get(website.get_valid_img_url(snahpshotLink))
                .on('end', function () {
                    if (!finished) {
                        fs.renameSync(fileFullPath + '.part', fileFullPath);
                        finished = true;
                        console.log(('[' + fanhao + ']').green.bold.inverse + '[截图]'.yellow.inverse, fileFullPath);
                    }
                })
                .on('error', function (err) {
                    if (!finished) {
                        finished = true;
                        console.error(('[' + fanhao + ']').red.bold.inverse + '[截图]'.yellow.inverse, err.message.red);
                    }
                })
                .pipe(snapshotFileStream);
        } else {
            console.log(('[' + fanhao + ']').green.bold.inverse + '[截图]'.yellow.inverse, 'file already exists, skip!'.yellow);
        }
    });
}

function get_item_cover(meta, done) {
    var fanhao = meta.fanhao
    var filename = fanhao + '.jpg';
    //let itemOutput = output + '/' + fanhao;
    let itemOutput = output;
    mkdirp.sync(itemOutput);
    var fileFullPath = path.join(itemOutput, filename);
    fs.access(fileFullPath, fs.F_OK, function (err) {
        if (err) {
            var coverFileStream = fs.createWriteStream(fileFullPath + '.part');
            var finished = false;
            request.get(website.get_valid_img_url(meta.img))
                .on('end', function () {
                    if (!finished) {
                        fs.renameSync(fileFullPath + '.part', fileFullPath);
                        finished = true;
                        console.error(('[' + fanhao + ']').green.bold.inverse + '[封面]'.yellow.inverse, fileFullPath);
                        return done();
                    }
                })
                .on('error', function (err) {
                    if (!finished) {
                        finished = true;
                        console.error(('[' + fanhao + ']').red.bold.inverse + '[封面]'.yellow.inverse, err.message.red);
                        return done();
                    }
                })
                .pipe(coverFileStream);
        } else {
            console.log(('[' + fanhao + ']').green.bold.inverse + '[封面]'.yellow.inverse, 'file already exists, skip!'.yellow);
            return done();
        }
    });
}

function get_fail_links(next) {
    database.find_fail_list(page_index, function (data) {
        let links = [],
            fanhao = [];

        if (data.length > 0) {
            for (var i = 0; i < data.length; i++) {
                fanhao.push(data[i].MovieID)
                links.push({
                    url: data[i].Url,
                    fanhao: data[i].MovieID
                })
            }
        }

        console.log('正处理以下番号影片...\n'.green + fanhao.toString().yellow);
        next(null, links)
    })
}

function beep() {
    var i = 0;

    function b() {
        setTimeout(function () {
            i++
            process.stdout.write('\x07')
            if (i < 10) {
                b()
            }
        }, 500)
    }

    b()
}