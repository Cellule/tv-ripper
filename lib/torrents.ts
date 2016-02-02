import request = require("superagent");
import fs = require("fs");
import path = require("path");
import http = require("http");
import child_process = require("child_process");

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
        console.log(e.message);
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
  const torrentFile = path.resolve(`${process.env.appdata}\\utorrent\\${torrent.title}.torrent`);
  download(torrent.torrentLink, torrentFile, err => {
    if(err) {
      return callback(err);
    }
    child_process.exec(`${process.env.appdata}\\utorrent\\utorrent.exe /DIRECTORY "${destination}" "${torrentFile}"`);
    callback();
  });
}
