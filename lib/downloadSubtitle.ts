var request = require("request");
var unzip = require("unzip");
var streamifier = require("streamifier");

function downloadSubtitle(opts: { id: number; path: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    var url = "http://www.tvsubtitles.net/download-" + opts.id + ".html";
    request.get(
      {
        url: url,
        encoding: null
      },
      (err, res, body) => {
        if (!err) {
          var bodyStream = streamifier.createReadStream(body);
          bodyStream.pipe(unzip.Extract({ path: opts.path }));
          resolve();
        } else {
          reject(err);
        }
      }
    );
  });
}

export = downloadSubtitle;
