//var userHome = require('user-home');
var path = require('path');

exports.url = 'https://www.javbus.com/';

exports.output = path.join('E:\\work\\Crawler\\', 'javbus')

exports.get_list_items = function ($) {

}

exports.get_list_item_link = function ($, elm) {

}

exports.get_item_page_data = function ($, meta) {
    var p = $(".info > p")

    if (p!= undefined && p.length > 0) {
        meta.img = 'https://www.javbus.com' + $(".bigImage img").attr("src")
        meta.title = $(".container h3").text()

        p.each(function(){
            let text = $(this).text()
            
            if(text.indexOf('發行日期:') > -1)
            {
                meta.date = text.replace("發行日期:","").trim()
            }

            if(text.indexOf('長度:') > -1)
            {
                meta.duration = text.replace("長度:","").trim()
            }

            if(text.indexOf('導演:') > -1)
            {
                meta.director = text.replace("導演:","").trim()
            }

            if(text.indexOf('製作商:') > -1)
            {
                meta.producer = text.replace("製作商:","").trim()
            }

            if(text.indexOf('發行商:') > -1)
            {
                meta.publisher = text.replace("發行商:","").trim()
            }

            if(text.indexOf('系列:') > -1)
            {
                meta.series = text.replace("系列:","").trim()
            }
        })
    }

    var genres = $(".info .genre a")
    var actress = []
    var tags = []

    genres.each(function(){
        var href = $(this).attr('href')
        if(href != '' && href != null && href != undefined)
        {
            if(href.indexOf('star')>-1)
            {
                actress.push($(this).text().trim())
            }

            if(href.indexOf('genre')>-1)
            {
                tags.push($(this).text().trim())
            }
        }
    })

    meta.actress = actress.join(",")

    meta.tags = tags.join("/")

    return meta
}

exports.get_item_page_snapshots = function ($) {
    var snapshots = [];

    $("#sample-waterfall .sample-box").each(function (i, e) {
        snapshots.push($(this).attr("href"));
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