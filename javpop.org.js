var userHome = require('user-home');
var path = require('path');

exports.url = 'http://javpop.org/';

exports.output = path.join(userHome, 'javpop')

exports.get_list_items = function ($) {
    return $('article.item-list')
}

exports.get_list_item_link = function ($, elm) {
    let link = $(elm).find(".catpost > a").attr('href');

    let fanhao = get_fanhao_from_link(link)

    return { url: link, fanhao: fanhao };
}

function get_fanhao_from_link (link) {
    let linkTexts = link.split("/")
    linkTexts = linkTexts[linkTexts.length - 2].split("-")
    let code = (linkTexts[0] + "-" + linkTexts[1]).toUpperCase()
    return code
}

exports.get_fanhao_from_link = get_fanhao_from_link

exports.get_item_page_data = function ($, meta) {
    var p = $('.entry-content > p')

    if (p[0] != undefined && $(p[0]).html() != undefined) {
        var p0 = $(p[0]).html().split('<br>')

        meta.img = $(p0[0]).attr("src")
        var title = $(p0[0]).attr("title")
        meta.title = typeof (title) == "string" ? title.replace(title.split(" ")[0], "").substr(1) : "";
        meta.date = $("<div>" + p0[1] + "</div>").text().split(' 每 ')[1]
        meta.company = $("<div>" + p0[2] + "</div>").text().split(' 每 ')[1]

        meta.actress = $("<div>" + p0[4] + "</div>").text().split(' 每 ')[1]
        meta.duration = $("<div>" + p0[5] + "</div>").text().split(' 每 ')[1]
    }

    if (p[1] != undefined) {
        meta.description = $(p[1]).text()
    }

    var tags = []
    $("p.tags > a").each(function (i, e) {
        tags.push($(this).text())
    })

    meta.tags = tags.join("||")

    return meta
}

exports.get_item_page_snapshots = function ($) {
    var snapshots = [];
    $('div.screen_div > img').each(function (i, e) {
        snapshots.push($(this).attr("src"));
    });

    return snapshots
}

exports.get_valid_img_url(url) {
    if (typeof (url) == "string" && url.indexOf("http") == -1) {
        url = "http:" + url
    }
    if (url == null || url == undefined) {
        url = "https://ss1.bdstatic.com/70cFuXSh_Q1YnxGkpoWK1HF6hhy/it/u=3726629744,650620009&fm=26&gp=0.jpg"
    }
    return url
}