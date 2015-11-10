import imdb = require("./imdb");
import async = require("async");
import prompt = require("./myprompt");
import SavedInfo = require("./SavedInfo");
import torrents = require("./torrents");
import path = require("path");
import mkdirp = require("mkdirp");

export function addNewTvShow(name: string, destination: string, info: SavedInfo) {
  let imdbShow: imdb.ShowSearchRes;
  async.waterfall([
    next => {
      imdb.searchShow(name, next);
    },
    (res: imdb.ShowSearchRes, next) => {
      imdbShow = res;
      console.log(`Tv show found: ${res.Title}, ${res.Released}\n  ${res.Plot}`);
      console.log("Is this the show you were looking for?");
      prompt.get("yesno", (err, res) => {
        const ripShow = !err && res.yesno;
        next(ripShow ? null : new Error("Operation canceled by user"));
      });
    },
    function selectEpisode(next) {
      prompt.get({
        properties: {
          season: {
            description: "Which season do you want to start downloading?",
            default: 1,
            type: "number"
          },
          episode: {
            description: "Which episode do you want to start downloading?",
            default: 1,
            type: "number"
          }
        }
      }, next);
    },
    (res, next) => {
      info.data.currentEpisode = res.episode;
      info.data.currentSeason = res.season;
      info.data.imdbId = imdbShow.imdbID;
      info.data.imdbTitle = imdbShow.Title;

      // Search for the episode to make sure it exists
      imdb.searchEpisode(imdbShow.Title, res.season, res.episode, next);
    },
    (res: imdb.EpisodeSearchRes, next) => {
      if (res.Released === "N/A" || new Date(res.Released) > new Date()) {
          return next(new Error("Episode has not been released yet"));
      }
      console.log(`Episode found: ${res.Title}, ${res.Released}\n  ${res.Plot}`);
      console.log("Is this the episode you were looking for?");
      prompt.get("yesno", (err, res) => {
        const cancel = err || !res.yesno;
        next(!cancel ? null : new Error("Operation canceled by user"));
      });
    },
    next => {
      torrents.SearchEpisode(
        info.data.imdbTitle,
        info.data.currentSeason,
        info.data.currentEpisode,
        next
      );
    },
    (res: torrents.KickAssTorrentInfo[], next) => {
      if(res.length == 0) {
        return next(new Error("No torrent found"));
      }
      let i = 1;
      console.log("Available torrents:\n0: CANCEL");
      for(let torrent of res) {
        console.log(`${i++}: ${torrent.title}: ${torrent.size >> 20}`);
      }
      const selectEpisode = function() {
        prompt.get("choice", function(err, pRes) {
          if(err) {
            return next(err);
          }
          let i = parseInt(pRes.choice) | 0;
          if(i == 0) {
            return next(new Error("Operation canceled by user"));
          }
          if (((i - 1) >>> 0) > res.length) {
            console.error("Invalid Choice");
            return selectEpisode();
          }
          next(null, res[i - 1]);
        });
      }
      selectEpisode();
    },
    (res: torrents.KickAssTorrentInfo, next) => {
      const downloadDestination = path.join(destination, `Season ${info.data.currentSeason}`);
      //mkdirp.sync(downloadDestination);
      torrents.startTorrent(res, downloadDestination, next);
    }
  ], err => {
    console.log(err || "Success");
  });
}