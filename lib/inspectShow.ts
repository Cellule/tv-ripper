var http = require("http");
var cheerio = require("cheerio");

export = inspectShow;

function inspectShow(opts: {
  id: number;
  season?: number;
  episode?: number;
}): Promise<Ripper.inspectShow.res> {
  var season = opts.season;
  return new Promise((resolve, reject) => {
    function dataReceived(body) {
      var $ = cheerio.load(body);
      var list = $(".left_articles table table table tr");
      var episodes = list
        .map(function(i, elem) {
          var content = $("td", elem).get();
          if (content.length < 4) {
            return null;
          }
          var episodeNumberText = $(content[0]).text();
          if (!episodeNumberText.length) {
            return null;
          }
          return {
            id: parseInt(
              // format is episode-[id].html like episode-55555.html
              /^episode-(\d+)/.exec(
                $(content[1])
                  .children("a")
                  .attr("href")
              )[1]
            ),
            episodeNumber: parseInt(
              // format is [season]x[episode] like 3x19
              /\d+x(\d+)/.exec(episodeNumberText)[1]
            ),
            name: $(content[1])
              .children("a")
              .text(),
            amount: parseInt($(content[2]).text()),
            season: season
          };
        })
        .get();

      if (opts.episode) {
        episodes = episodes.filter(function(episode) {
          return episode.episodeNumber === opts.episode && episode.amount;
        });
      }

      if (episodes.length) {
        resolve({
          episodes: episodes,
          seasonNumber: season
        })
      } else {
        reject(new Error("No episodes found"))
      }
    }
    var site = "http://www.tvsubtitles.net/";
    var url = site + "tvshow-" + opts.id;
    if (opts.season) {
      url += "-" + opts.season;
    }
    url += ".html";
    http
      .get(url, function(res) {
        var body = "";
        if (!season) {
          var m = /(\d+)\.html$/.exec(res.headers.location);
          if (!m) {
            return reject(
              new Error("Invalid URL " + site + res.headers.location)
            );
          }
          // get the season number from the redirection
          season = parseInt(m[1]);
        }

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
