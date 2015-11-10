import request = require("superagent");
import fs = require("fs");
import http = require("http");

function padNumber(n: number) {
  return n < 10 ? "0" + n : n;
}

export interface KickAssTorrentInfo {
  title: string;
  category: string;
  link: string;
  guid: string;
  pubDate: string;
  torrentLink: string;
  hash: string,
  files: number;
  comments: number;
  peers: number;
  seeds: number;
  leechs: number;
  size: number;
  votes: number;
  verified: number;
}

export function SearchEpisode(
  show: string,
  season: number,
  episode: number,
  callback: (err, res?: KickAssTorrentInfo[]) => void
) {
  const searchQuery = `${show} S${padNumber(season)}E${padNumber(episode)}`;
  console.log(searchQuery);
  request
    .get("https://kat.cr/json.php")
    .query({
      q: searchQuery
    })
    .accept("json")
    .end((err, res) => {
      if(err) {
        return callback(err);
      }
      let list = [];
      try {
        list = JSON.parse(res.text).list || [];
      } catch(e) {

      }
      callback(null, list);
    });
}

function download(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  request.get(url).pipe(file).on("error", err => {
    fs.unlink(dest); // Delete the file async. (But we don't check the result)
    cb(err);
  });
  file.on('finish', function() {
    file.close();
    cb();
  });
};

export function startTorrent(torrent: KickAssTorrentInfo, destination: string, callback: (err?) => void) {
  const torrentFile = `${torrent.title}.torrent`;
  download(torrent.torrentLink, torrentFile, err => {
    if(err) {
      return callback(err);
    }
    callback();
  });
}