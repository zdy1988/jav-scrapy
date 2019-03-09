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
    .option('-rf, --retryfail', '是否进入重试下载失败连接')
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

var parallel = parseInt(program.parallel);
var timeout = parseInt(program.timeout) || 30000;
var proxy = process.env.http_proxy || program.proxy;
var pageIndex = parseInt(program.index);
var retryTimes = parseInt(program.retry)
var count = parseInt(program.limit);
var hasLimit = (count !== 0), targetFound = false;
var output = program.output.replace(/['"]/g, '');

request = request.defaults({ timeout: timeout });
request = proxy ? request.defaults({ 'proxy': proxy }) : request;

mkdirp.sync(output);

console.log('========== 获取资源站点：%s =========='.green.bold, website.url);
console.log('并行连接数：'.green, parallel.toString().green.bold, '      ', '连接超时设置：'.green, (timeout / 1000.0).toString().green.bold, '秒'.green);
console.log('磁链保存位置: '.green, output.green.bold);
console.log('代理服务器: '.green, (proxy ? proxy : '无').green.bold);

var currentPageHtml = null;

/****************************
 *****************************
 **** MAIN LOOP START ! ******
 ****************************
 ****************************/

function main() {
    if (program.retryfail) {
        retryFailStart();
    } else {
        loopStart();
    }
}

main();

function loopStart() {
    async.during(
        pageExist,
        // when page exist
        function (callback) {
            async.waterfall(
                [parseLinks, getItems],
                function (err) {
                    pageIndex++;
                    if (err) return callback(err);
                    return callback(null);
                });
        },
        handleLoopError
    );
}

function retryFailStart() {
    async.during(
        function (callback) {
            return callback(null, true);
        },
        function (callback) {
            async.waterfall(
                [getFailLinks, getItems],
                function (err) {
                    pageIndex++;
                    if (err) return callback(err);
                    return callback(null);
                });
        },
        handleLoopError
    );
}

// page not exits or finished parsing
function handleLoopError(err) {
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
    }
    if (hasLimit && (count < 1)) {
        console.log('已尝试抓取%s部影片，本次抓取完毕'.green.bold, program.limit);
    } else {
        console.log('抓取完毕'.green.bold);
    }
    return process.exit(0); // 不等待未完成的异步请求，直接结束进程
}

/****************************
 *****************************
 **** MAIN LOOP END ! ******
 ****************************
 ****************************/

function pageExist(callback) {
    if (hasLimit && (count < 1) || targetFound) {
        return callback();
    }

    var url = website.url + (pageIndex === 1 ? '' : ('page/' + pageIndex + '/'));

    if (program.search) {
        url = website.url + (pageIndex === 1 ? '' : ('page/' + pageIndex + '/')) + '?s=' + encodeURI(program.search);
    } else {
        // 只在没有指定搜索条件时显示
        console.log('获取第%d页中的影片链接 ( %s )...'.green, pageIndex, url);
    }

    let retryCount = 1;

    async.retry({
        times: retryTimes,
        interval: function (count) {
            retryCount = count;
            return 500 * Math.pow(2, count);
        }
    }, function (callback) {
        request.get({ url: url }, function (err, res, body) {
            if (err) {
                if (err.status === 404) {
                    console.error('已抓取完所有页面, StatusCode:', err.status);
                } else {
                    console.error('第%d页页面获取失败：%s'.red, pageIndex, err.message);
                    console.error('...进行第%d次尝试...'.red, retryCount);
                }
                return callback(err);
            }

            currentPageHtml = body;
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

function parseLinks(next) {
    let $ = cheerio.load(currentPageHtml);
    let links = [],
        fanhao = [];

    let listItems = website.get_list_items($)
    let totalCountCurPage = listItems.length;

    if (hasLimit) {
        if (count > totalCountCurPage) {
            listItems.each(link_fanhao_handler);
        } else {
            listItems.slice(0, count).each(link_fanhao_handler);
        }
    } else {
        listItems.each(link_fanhao_handler);
    }
    if (program.search && links.length == 1) {
        targetFound = true;
    }

    function link_fanhao_handler(i, e) {
        var l = website.get_list_item_link($, e)
        links.push(l)
        fanhao.push(l.fanhao)
    }

    console.log('正处理以下番号影片...\n'.green + fanhao.toString().yellow);
    next(null, links);
}

function getItems(links, next) {
    async.forEachOfLimit(
        links,
        parallel,
        getItemPage,
        function (err) {
            if (err) {
                if (err.message === 'limit') {
                    return next();
                }
                throw err;
            }
            console.log('===== 第%d页处理完毕 ====='.green, pageIndex);
            console.log();
            return next();
        });
}

function getItemPage(link, index, callback) {
    let fanhao = link.fanhao

    let coverFilePath = path.join(output, fanhao + '.jpg');
    let magnetFilePath = path.join(output, fanhao + '.txt');
    if (hasLimit) {
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
                getItemCover(meta, callback);

                // 所有截图link
                var snapshots = website.get_item_page_snapshots($)

                getSnapshots(meta, snapshots);
            });
    }
}

function getSnapshots(meta, snapshots) {
    for (var i = 0; i < snapshots.length; i++) {
        getSnapshot(meta, snapshots[i]);
    }
}

function getSnapshot(meta, snahpshotLink) {
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

function getItemCover(meta, done) {
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

function getFailLinks(next) {
    database.find_fail_list(function (data) {
        let links = [],
            fanhao = [];

        if (data.length > 0) {
            data.each(function (i, d) {
                fanhao.push(d.MoiveID)
                links.push({ url: d.Url, fanhao: d.MoiveID })
            })
        }

        console.log('正重新处理以下番号影片...\n'.green + fanhao.toString().yellow);
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