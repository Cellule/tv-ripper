var request = require("request");
var streamifier = require("streamifier");
import unzip from "unzip-stream";

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
