var path = require("path");

exports.url = "http://javpop.info/category/censored/";

exports.output = path.join("E:\\work\\Crawler\\", "javpop");

exports.get_list_items = function ($) {
  return $("#content ul.thumb_post > li");
};

exports.get_list_item_link = function ($, elm) {
  let link = $($(elm).find("a")[0]).attr("href");

  let fanhao = get_fanhao_from_link(link);

  return { url: link, fanhao: fanhao };
};

function get_fanhao_from_link(link) {
  let linkTexts = link.split("/");
  let code = linkTexts.pop().replace(".html", "").toUpperCase();
  return code;
}

exports.get_fanhao_from_link = get_fanhao_from_link;

exports.get_item_page_data = function ($, meta) {
  var name = $(".box-b > h1").text();

  //����
  meta.img = $(".poster > img").attr("src");
  meta.title = name.split(" ")[1];

  var tags = [];

  $("a[rel='tag']").each(function (i, e) {
    tags.push($(this).text());
  });

  meta.tags = tags.join("||");

  return meta;
};

exports.get_item_page_snapshots = function ($) {
  var snapshots = [];
  $(".screenshot > img").each(function (i, e) {
    snapshots.push($(this).attr("src"));
  });
  return snapshots;
};

exports.get_valid_img_url = function (url) {
  if (url == null || url == undefined) {
    url = "https://ss1.bdstatic.com/70cFuXSh_Q1YnxGkpoWK1HF6hhy/it/u=3726629744,650620009&fm=26&gp=0.jpg";
  }
  return url;
};
