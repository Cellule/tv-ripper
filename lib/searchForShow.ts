var http = require("http");
var querystring = require("querystring");
var cheerio = require("cheerio");

// todo:: callback showid
function searchForShow(
  opts: {
    name: string,
    exactMatch?: boolean
  },
  callback: (err, res?: {
    shows: {id: number, name: string}[]
  }) => void
) {
  function dataReceived(body) {
    var $ = cheerio.load(body);
    var list = $(".left_articles ul li div a");
    var shows = list.map(function(i, elem) {
      // todo:: prompt user to make a choice.
      //console.log($(elem).text());
      return {
        id: parseInt(/^\/tvshow-(\d+)/.exec(elem.attribs.href)[1]),
        name: $(elem).text()
      }
    }).get();
    if(opts.exactMatch) {
      shows = shows.filter(function(show) {
        return show.name.match(new RegExp("^" + opts.name + " \(.*\)$", "i"));
      });
    }
    callback(!shows.length ? null: new Error("No result found"), {
      shows: shows
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
    res.setEncoding("utf8");
    res.on("data", function (chunk) {
      body += chunk;
    });
    res.on("end", function() {
      dataReceived(body);
    });
  });

  req.on("error", function(e) {
    callback(e);
  });

  // write data to request body
  req.write(postData);
  req.end();
}

export = searchForShow;