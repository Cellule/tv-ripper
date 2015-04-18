/// <reference path="typings/tsd.d.ts" />
var http = require("http");
var querystring = require("querystring");
var cheerio = require("cheerio");
var request = require('request');
var stream = require("stream");
var unzip = require("unzip");
var fs = require("fs");
var streamifier = require("streamifier");

// todo:: callback showid
function searchForShow(opts, callback) {
  function dataReceived(body) {
    var $ = cheerio.load(body);
    var list = $(".left_articles ul li div a");
    list.each(function(i, elem) {
      // todo:: prompt user to make a choice.
      console.log($(elem).text());
    });
  }

  var postData = querystring.stringify({
    q: opts.name
  });

  var options = {
    hostname: "www.tvsubtitles.net",
    port: 80,
    path: "/search.php",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": postData.length
    }
  };


  var req = http.request(options, function(res) {
    var body = "";
    //console.log("STATUS: " + res.statusCode);
    //console.log("HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding("utf8");
    res.on("data", function (chunk) {
      body += chunk;
    });
    res.on("end", function() {
      dataReceived(body);
    });
  });

  req.on("error", function(e) {
    console.log("problem with request: " + e.message);
  });

  // write data to request body
  req.write(postData);
  req.end();
}

// opts: {id: number}
// todo:: callback episode id
function inspectShow(opts, callback) {
  function dataReceived(body) {
    var $ = cheerio.load(body);
    var list = $(".left_articles table table table tr");
    list.each(function(i, elem) {
      console.log($(elem).text());
    });
  }
  var url = "http://www.tvsubtitles.net/tvshow-" + opts.id;
  if(opts.season) {
    url += "-" + opts.season;
  }
  url += ".html";
  http.get(url, function(res) {
    var body = "";
    res.setEncoding("utf8");
    res.on("data", function (chunk) {
      body += chunk;
    });
    res.on("end", function() {
      dataReceived(body);
    });
  }).on("error", function(err) {
    console.error(err);
  });
}

function inspectEpisode(opts: {id: number}, callback?: (err?, res?: {}) => void) {
  function dataReceived(body) {
    var $ = cheerio.load(body);
    var list = $(".subtitlen");
    list.each(function(i, elem) {
      console.log($(elem.parent).text());
    });
  }
  var url = "http://www.tvsubtitles.net/episode-" + opts.id + ".html";
  http.get(url, function(res) {
    var body = "";
    res.setEncoding("utf8");
    res.on("data", function (chunk) {
      body += chunk;
    });
    res.on("end", function() {
      dataReceived(body);
    });
  }).on("error", function(err) {
    console.error(err);
  });
}

function downloadSubtitle(opts: {id: number, path: string}, callback?: (err?) => void) {
  var url = "http://www.tvsubtitles.net/download-" + opts.id + ".html";
  request.get({
    url: url,
    encoding: null
  }, (err, res, body) => {
    if(!err) {
      var bodyStream = streamifier.createReadStream(body);
      bodyStream.pipe(
        unzip.Extract({ path: opts.path })
      )
    }
    callback(err);
  });
}
