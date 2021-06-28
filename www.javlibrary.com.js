var path = require("path");

exports.url = "http://n53i.com/cn/";

exports.output = path.join("E:\\work\\Crawler\\", "javlibrary");

exports.get_list_items = function ($) {};

exports.get_list_item_link = function ($, elm) {};

exports.get_item_page_data = function ($, meta) {
  var p = $("#video_info > .item");

  if (p != undefined && p.length > 0) {
    meta.img = $("#video_jacket_img").attr("src");
    meta.title = $(".post-title").text();

    p.each(function () {
      let text = $(this).text();

      if (text.indexOf("发行日期:") > -1) {
        meta.date = text.replace("发行日期:", "").trim();
      }

      if (text.indexOf("长度:") > -1) {
        meta.duration = text.replace("长度:", "").trim();
      }

      if (text.indexOf("导演:") > -1) {
        meta.director = text.replace("导演:", "").trim();
      }

      if (text.indexOf("制作商:") > -1) {
        meta.producer = text.replace("制作商:", "").trim();
      }

      if (text.indexOf("发行商:") > -1) {
        meta.publisher = text.replace("发行商:", "").trim();
      }

      if (text.indexOf("系列:") > -1) {
        meta.series = text.replace("系列:", "").trim();
      }
    });
  }

  var tags = [];

  $(".genre a").map(function () {
    tags.push($(this).text().trim());
  });

  meta.tags = tags.join("/");

  var actress = [];

  $("#video_cast .star a").map(function () {
    actress.push($(this).text().trim());
  });

  meta.actress = actress.join(",");

  return meta;
};

exports.get_item_page_snapshots = function ($) {
  var snapshots = [];

  $(".previewthumbs > img").each(function (i, e) {
    snapshots.push($(this).attr("src"));
  });

  return snapshots;
};

var non_img = "https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1582573944993&di=dc4a5c97004ae089b2024db907ecb8eb&imgtype=0&src=http%3A%2F%2Fwww.bjcapitaloutlet.com%2FContent%2Fimg%2Ferror.jpg";

exports.get_valid_img_url = function (url) {
  if (typeof url == "string" && url.trim() == "") {
    url = non_img;
  } else if (typeof url == "string" && url.indexOf("data:image") != -1) {
    url = non_img;
  } else if (typeof url == "string" && url.indexOf("http") == -1) {
    url = "http:" + url;
  } else if (url == null || url == undefined) {
    url = non_img;
  }
  return url;
};
