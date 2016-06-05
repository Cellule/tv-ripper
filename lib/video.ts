import imdb = require("./imdb");
import async = require("async");
import prompt = require("./myprompt");
import SavedInfo = require("./SavedInfo");
import torrents = require("./torrents");
import path = require("path");
import mkdirp = require("mkdirp");

export function addNewTvShow(name: string, info: SavedInfo, callback: (err) => void) {
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
            description: "Last downloaded season?",
            default: 1,
            type: "number"
          },
          episode: {
            description: "Last downloaded episode?",
            default: 0,
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
      if(info.data.currentEpisode == 0) {
        return next(null, null);
      }
      // Search for the episode to make sure it exists
      imdb.searchEpisode(imdbShow.Title, res.season, res.episode, (err, res) => {
        if(err) {
          console.log(err);
          console.log("Continue anyway?");
          prompt.get("yesno", (err, res) => {
            const cancel = err || !res.yesno;
            next(!cancel ? null : new Error("Operation canceled by user"), {
              Title: `${info.data.currentSeason}-${info.data.currentEpisode}`,
              IsReleased: () => true
            });
          });
          return;
        }
        next(null, res);
      });
    },
    (res: imdb.EpisodeSearchRes, next) => {
      if(res === null) {
        return next(null);
      }
      if (!res.IsReleased()) {
        console.log("Episode has not been released yet");
        console.log("Continue anyway?");
        prompt.get("noyes", (err, res) => {
          const cancel = err || !res.noyes;
          next(!cancel ? null : new Error("Operation canceled by user"));
        });
      }
      console.log(`Episode found: ${res.Title}, ${res.Released}\n  ${res.Plot}`);
      console.log("Is this the episode you were looking for?");
      prompt.get("yesno", (err, res) => {
        const cancel = err || !res.yesno;
        next(!cancel ? null : new Error("Operation canceled by user"));
      });
    },

  ], err => {
    console.log(err || "Success");
    if(!err) {
      info.saveToFile();
    }
    callback(err);
  });
}

export function DownloadNextEpisode(info: SavedInfo, opts: { quiet: boolean }, callback: (err) => void) {
  if(typeof info.data.imdbTitle !== "string") {
    return addNewTvShow(info.folder, info, err => {
      if(!err) {
        return DownloadNextEpisode(info, opts, callback);
      }
      callback(err);
    });
  }

  let season = info.data.currentSeason;
  let episode = info.data.currentEpisode + 1;
  let destination = info.folder;
  async.waterfall([
    next => {
      imdb.searchEpisode(info.data.imdbTitle, season, episode, (err, res) => {
        if(err) {
          console.log("Episode not found");
          // If this episode doesn't exist, check if the next season is available
          episode = 1;
          season++;
          return imdb.searchEpisode(info.data.imdbTitle, season, episode, next);
        }
        next(null, res);
      });
    },
    (res: imdb.EpisodeSearchRes, next) => {
      if (!res.IsReleased()) {
        if(opts.quiet) {
          return next(new Error("Episode has not been released yet"));
        }
        console.log("Episode has not been released yet");
        console.log("Continue anyway?");
        prompt.get("noyes", (err, res) => {
          const cancel = err || !res.noyes;
          next(!cancel ? null : new Error("Operation canceled by user"));
        });
        return;
      }
      console.log(`Episode found: ${res.Title}, ${res.Released}\n  ${res.Plot}`);
      next();
    },
    next => DownloadEpisode(info, season, episode, opts, next)
  ], err => {
    if(err && err.message === "skip") {
      err = null;
    }
    console.log(err || "Success");
    if(!err) {
      info.data.currentSeason = season;
      info.data.currentEpisode = episode;
      info.saveToFile();
    }
    callback(err);
  });
}

export function DownloadEpisode(
  info: SavedInfo,
  season: number,
  episode: number,
  opts: {quiet: boolean},
  callback: (err) => void
) {
  const destination = info.folder;
  console.log(`Download ${info.data.imdbTitle} Season ${season} ${episode}`);

  async.waterfall([
    next => {
      console.log("Checking for torrents");
      torrents.SearchEpisode(
        info.data.imdbTitle,
        season,
        episode,
        next
      );
    },
    (res: torrents.KickAssTorrentInfo[], next) => {
      if(res.length == 0) {
        if(opts.quiet) {
          return next(new Error("No torrent found"));
        }
        console.log("No torrent found");
        console.log("Do you want to skip this episode?");
        prompt.get("noyes", (err, res) => {
          const cancel = err || !res.noyes;
          next(!cancel ? new Error("skip") : new Error("Not Skipping the episode, exiting."));
        });
        return;
      }
      const selectEpisode = function(n: number) {
        console.log("Prompt Select Episode");
        let iShow = 0;
        console.log("Available torrents:\nc: CANCEL");
        while(iShow < n && iShow < res.length) {
          let torrent = res[iShow];
          console.log(`${iShow}: ${torrent.title}: ${torrent.size >>> 20}MB`);
          ++iShow;
        }
        const nShown = iShow;
        const showLess = n > 5;
        const showMore = nShown < res.length;
        if(showLess) {
          console.log(`l: Show less`);
        }
        if(showMore) {
          console.log(`m: Show more`);
        }
        console.log("d #: Show details about torrent #");
        console.log(`s: Skip this episode`);
        prompt.get("choice", function(err, pRes) {
          if(err) {
            return next(err);
          }
          const reg = /d (\d+)/.exec(pRes.choice);
          if(reg !== null) {
            const i = parseInt(reg[1]);
            if((i >>> 0) < res.length) {
              console.log(res[i]);
            }
            return selectEpisode(n);
          }
          if(pRes.choice === "s") {
            console.log("Do you want to skip this episode?");
            prompt.get("yesno", (err, res) => {
              const cancel = err || !res.yesno;
              next(!cancel ? new Error("skip") : new Error("Not Skipping the episode, exiting."));
            });
            return;
          }
          if(showLess && pRes.choice === "l") {
            return selectEpisode(n - 5);
          }
          if(showMore && pRes.choice === "m") {
            return selectEpisode(n + 5);
          }
          if(pRes.choice === "c") {
            return next(new Error("Operation canceled by user"));
          }
          let i = parseInt(pRes.choice) | 0;
          if(i === 0 && pRes.choice !== "0") {
            console.error("Invalid Choice");
            return selectEpisode(n);
          }
          if ((i >>> 0) < nShown) {
            var torrent = res[i];
            console.log("You selected");
            console.log(`${torrent.title}: ${torrent.size >>> 20}MB`);
            console.log("Are you sure?");
            prompt.get("yesno", (err, downloadQRes) => {
              if(err) console.error(err);
              const cancel = err || !downloadQRes.yesno;
              if(cancel) {
                return selectEpisode(n);
              }
              return next(null, torrent);
            });
            return;
          }
          console.error("Invalid Choice");
          selectEpisode(n);
        });
      }
      selectEpisode(5);
    },
    (res: torrents.KickAssTorrentInfo, next) => {
        console.log(res);
      const downloadDestination = path.join(destination, `Season ${info.data.currentSeason}`);
      mkdirp.sync(downloadDestination);
      torrents.startTorrent(res, downloadDestination, next);
    },
	next => {
		console.log("Did it work?")
		prompt.get("yesno", (err, res) => {
		  if (err) return next(err);
          const worked = res.yesno;
		  if (worked) {
			return next();
		  }
		  console.log("Retry?");
		  prompt.get("yesno", (err, res) => {
		      if (err) return next(err);
			  const retry = res.yesno;
			  if (retry) {
				return DownloadEpisode(info, season, episode, opts, next);
			  }
			  next();
			});
        });
	}
  ], err => {
    if(err && err.message === "skip") {
      err = null;
    }
    if(err) {
      console.log(err);
    }
    callback(err);
  });
}