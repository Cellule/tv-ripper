import fs from "fs";
import async from "async";
import _ from "lodash";
import path from "path";
import prompt from "./myprompt";

import SavedInfo from "./SavedInfo";
import ripper from "./ripper";
var subtitles = ripper.subtitles;

export function rip(
  showName: string,
  info: SavedInfo,
  opts: {
    force: boolean,
    language: string,
    quiet: boolean,
    save: boolean,
    season?: number,
    episode?: number,
  },
  callback: (err) => void
) {
  const output = info.folder;
  if (
    !info.data.show &&
    typeof showName !== "string"
  ) {
    // No tv show selected. Use current directory name
    showName = path.basename(output)
      // Remove the year in parenthesis
      .replace(/\(\d+(-\d+)?\)/, "");
  }
  let lastSeason = null;
  async.waterfall([
    // Check if the selected season is already marked as completed
    next => {
      if (opts.season && info.isSeasonCompleted(opts.language, opts.season)) {
        if(opts.quiet) {
          return next(new Error("Nothing to download"));
        }
        console.log("Selected season is marked as completed. Do you want to download it again?");
        prompt.get("yesno", function(errPrompt, result) {
          if (!errPrompt && result.yesno) {
            info.markSeasonCompleted(opts.language, opts.season, true);
            return next();
          }
          next(errPrompt || new Error("Nothing to download"));
        });
        return;
      }
      next();
    },
    // Search the show or use saved info
    next => {
      if (info.data.show) {
        return next(null, { shows: [info.data.show] });
      }
      subtitles.searchForShow({
        name: showName,
        exactMatch: opts.quiet
      }, next);
    },
    // Find the episodes available for this season
    (res: Ripper.searchForShow.res, next) => {
      var selectedShow: Ripper.searchForShow.show;
      if (res.shows.length === 1 || opts.quiet) {
        selectedShow = res.shows[0];
        next(null, selectedShow);
      } else {
        var nShows = res.shows.length;
        function selectShow() {
          console.log("Available Shows:\n%s", res.shows.map(function(show, i) {
            return (i + 1) + ": " + show.name;
          }).join("\n"))
          prompt.get("choice", function(err, pRes) {
            var i = parseInt(pRes.choice) | 0;
            if (((i - 1) >>> 0) > nShows) {
              console.error("Invalid Choice");
              return selectShow();
            }
            next(null, res.shows[i - 1]);
          })
        }
        selectShow();
      }
    },
    (selectedShow: Ripper.searchForShow.show, next) => {
      // Save show for later
      info.data.show = selectedShow;

      console.log("Selected tv show", selectedShow.name);
      subtitles.inspectShow({
        id: selectedShow.id,
        // if season is not defined, this will return the latest season
        season: opts.season > 0 ? opts.season : undefined,
        episode: opts.episode
      }, next);
    },
    // If no season was specified, search for all other seasons
    (res: Ripper.inspectShow.res, next) => {
      var allSeasons = [];
      if (opts.force || !info.isSeasonCompleted(opts.language, res.seasonNumber)) {
        allSeasons.push(res);
      } else {
	    if (!opts.quiet) {
	       console.log("Skipping completed season %d", res.seasonNumber);
	    }
      }
      if (opts.season === undefined) {
        console.log("Searching for all seasons");
        lastSeason = res.seasonNumber;
        async.map(_.range(1, lastSeason), (season, next) => {
          if (opts.force || info.isSeasonCompleted(opts.language, season)) {
		    if (!opts.quiet)
              console.log("Skipping completed season %d", season);
            return next(null, null);
          }
          subtitles.inspectShow({
            id: info.data.show.id,
            season: season,
            episode: opts.episode
          }, next);
        }, (err, allEpisodes) => {
          allSeasons = allSeasons.concat(_.compact(allEpisodes))
          next(err, allSeasons);
        });
        return;
      }
      next(null, allSeasons);
    },
    // Inspect all the shows and download the desired subtitles
    (seasons: Ripper.inspectShow.res[], next) => {
      async.eachSeries(seasons, (season, nextSeason) => {
        async.each(season.episodes, (episode, nextEpisode) => {
          if (!opts.force && info.isEpisodeCompleted(
            opts.language,
            season.seasonNumber,
            episode.episodeNumber
          )) {
		    if (!opts.quiet)
				console.log(
				  "Skipping episode %dx%d",
				  season.seasonNumber,
				  episode.episodeNumber
				);
            return nextEpisode();
          }
          console.log("Found episode", episode.name);
          // check the subtitles for this episode
          subtitles.inspectEpisode({
            id: episode.id,
            language: opts.language
          }, (err, res: Ripper.inspectEpisode.res) => {
            if (err) {
			  if (!opts.quiet)
              console.error(
                "No subtitle found for episode %dx%d",
                season.seasonNumber,
                episode.episodeNumber
              );
              // Show error, but keep going.
              return nextEpisode();
            }
            // download the subtitles
            async.each(res.subtitles, (sub, nextSub) => {
              if (!opts.force) {
                if (
                  info.isSubtitleSaved(
                    sub.lng,
                    episode.season,
                    episode.episodeNumber,
                    sub.id
                  )
                ) {
				  if (!opts.quiet)
                    console.info("Skipping cached subtitle %s", sub.name);
                  return nextSub();
                }
              }
              var outputPath = path.join(output, "Season " + episode.season);
              console.log("Downloading subtitle %s at %s", sub.name, outputPath);
              subtitles.downloadSubtitle({
                id: sub.id,
                path: outputPath
              }, function(err) {
                if (!err) {
                  info.saveSubtitle(
                    sub.lng,
                    episode.season,
                    episode.episodeNumber,
                    sub.id
                  );
                } else {
                  console.error("Error downloading subtitle %s. %j", sub.name, err);
                }
                // Ignore the error and continue, it will simply not save and try again next time.
                nextSub();
              });
            }, err => {
              if (!err) {
                info.markEpisodeCompleted(opts.language, season.seasonNumber, episode.episodeNumber);
              }
              nextEpisode(err);
            });
          })
        }, function(err) {
          if (!err && !opts.quiet) {
            if(lastSeason === null) {
              console.log("Would you like to mark season %d as complete?", season.seasonNumber);
              prompt.get("noyes", function(errPrompt, result) {
                if (!errPrompt && result.noyes) {
                  info.markSeasonCompleted(opts.language, season.seasonNumber);
                }
                nextSeason(err);
              });
              return;
            } else if(season.seasonNumber < lastSeason) {
              info.markSeasonCompleted(opts.language, season.seasonNumber);
            }
          }
          nextSeason(err);
        });
      }, next);
    }
  ], err => {
    if (err) {
      console.error(err);
    } else {
      if (opts.save) {
        info.saveToFile();
      }
      console.log("Success");
    }
    callback(err);
  })
}