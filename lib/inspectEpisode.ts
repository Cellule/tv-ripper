import http from "http";
var cheerio = require("cheerio");

function inspectEpisode(opts: {
  id: number;
  language?: string;
}): Promise<Ripper.inspectEpisode.res> {
  return new Promise((resolve, reject) => {
    function dataReceived(body) {
      var $ = cheerio.load(body);
      var list = $(".subtitlen");
      var subtitles = list
        .map(function(i, elem) {
          return {
            id: parseInt(
              /^\/subtitle-(\d+)/.exec($(elem.parent).attr("href"))[1]
            ),
            name: $("h5", elem).text(),
            lng: /Download (.*) subtitles/.exec($(elem).attr("title"))[1]
          };
        })
        .get();
      if (opts.language) {
        subtitles = subtitles.filter(function(sub) {
          return sub.lng.toLowerCase() === opts.language.toLowerCase();
        });
      }
      if (subtitles.length) {
        resolve({
          subtitles: subtitles
        })
      } else {
        reject(new Error("No subtitles found"));
      }
    }
    var url = "http://www.tvsubtitles.net/episode-" + opts.id + ".html";
    http
      .get(url, function(res) {
        var body = "";
        res.setEncoding("utf8");
        res.on("data", function(chunk) {
          body += chunk;
        });
        res.on("end", function() {
          dataReceived(body);
        });
      })
      .on("error", function(err) {
        console.error(err);
      });
  });
}

export = inspectEpisode;
