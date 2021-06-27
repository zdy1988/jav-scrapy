//var userHome = require('user-home');
var path = require('path');

exports.url = 'http://javpop.org/';

exports.output = path.join('E:\\work\\Crawler\\', 'javpop')

exports.get_list_items = function ($) {
    return $('#content article')
}

exports.get_list_item_link = function ($, elm) {
    var $a = $(elm).find(".cdetail a")

    let id = $(elm).attr("id").replace("post-", "")

    let link = $a.attr('href')

    let fanhao = $a.text().substring(1, $a.text().indexOf("]")).toUpperCase()

    return {
        id: id,
        url: link,
        fanhao: fanhao
    };
}

exports.get_item_page_data = function ($, meta) {
    var p = $('.entry-content > p')

    if (p[0] != undefined && $(p[0]).html() != undefined) {
        var p0 = $(p[0]).html().split('<br>')

        var img = $(p0[0]).text()

        meta.img = $(img).attr("src")
        meta.title = $(img).attr("title")
        meta.date = $("<div>" + p0[1] + "</div>").text().split(" – ")[1]
        meta.company = $("<div>" + p0[2] + "</div>").text().split(" – ")[1]

        meta.actress = $("<div>" + p0[4] + "</div>").text().split(" – ")[1]
        meta.duration = $("<div>" + p0[5] + "</div>").text().split(" – ")[1]
    }

    if (p[1] != undefined) {
        meta.description = $(p[1]).text()
    }

    var tags = []
    $("p.tags > a").each(function (i, e) {
        tags.push($(this).text())
    })

    meta.tags = tags.join("/")

    return meta
}

exports.get_item_page_snapshots = function ($) {
    var snapshots = [];
    $(".screen_div noscript").each(function (i, e) {
        snapshots.push($(this.children[0].data).attr("src"));
    });

    return snapshots
}

var non_img = "https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1582573944993&di=dc4a5c97004ae089b2024db907ecb8eb&imgtype=0&src=http%3A%2F%2Fwww.bjcapitaloutlet.com%2FContent%2Fimg%2Ferror.jpg";

exports.get_valid_img_url = function (url) {
    if (typeof (url) == "string" && url.trim() == '') {
        url = non_img
    } else if (typeof (url) == "string" && url.indexOf("data:image") != -1) {
        url = non_img
    } else if (typeof (url) == "string" && url.indexOf("http") == -1) {
        url = "http:" + url
    } else if (url == null || url == undefined) {
        url = non_img
    }
    return url
}