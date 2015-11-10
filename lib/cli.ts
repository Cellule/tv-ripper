import fs = require("fs");
import path = require("path");
import async = require("async");
import _ = require("lodash");

import ripper = require("./ripper");
import video = require("./video");
import SavedInfo = require("./SavedInfo");

import prompt = require("./myprompt");
import program = require("commander");

var subtitles = ripper.subtitles;

interface CliArguments {
  sub: boolean;
  vid: boolean;
  newShow: string;
  season?: number;
  episode?: number;
  language: string;
  quiet: boolean;
  save: boolean;
  force: boolean;
  args: string[];
}

program
  .version("2.0.0")
  .usage('[options] [folder ...]')
  .option("--sub", "Download subtitles")
  .option("--vid", "Download videos")
  .option("-n, --new-show <tvShow>", "Add new tv show name to folder passed in args")
  .option("-s, --season <n>", "Optional. Season you want to download. Select '0' for latest only. Omit to download all seasons", parseInt)
  .option("-e, --episode <n>", "Optional. Episode you want to download", parseInt)
  .option("-l, --language <lng>", "Required. Subtitle language. Default: English", "English")
  .option("-q, --quiet", "won't prompt you when multiple choices available")
  .option("-f, --force", "Download already downloaded subtitles as well")
  .option("--no-save", "Save information for tv show and downloaded subtitles so far to avoid duplicates")
  .parse(process.argv)


function rip(showName: string, info: SavedInfo, callback) {
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

  async.waterfall([
    // Check if the selected season is already marked as completed
    next => {
      if (cliArgs.season && info.isSeasonCompleted(cliArgs.language, cliArgs.season)) {
        if(cliArgs.quiet) {
          return next(new Error("Nothing to download"));
        }
        console.log("Selected season is marked as completed. Do you want to download it again?");
        prompt.get("yesno", function(errPrompt, result) {
          if (!errPrompt && result.yesno) {
            info.markSeasonCompleted(cliArgs.language, cliArgs.season, true);
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
        exactMatch: cliArgs.quiet
      }, next);
    },
    // Find the episodes available for this season
    (res: Ripper.searchForShow.res, next) => {
      var selectedShow: Ripper.searchForShow.show;
      if (res.shows.length === 1 || cliArgs.quiet) {
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
        season: cliArgs.season > 0 ? cliArgs.season : undefined,
        episode: cliArgs.episode
      }, next);
    },
    // If no season was specified, search for all other seasons
    (res: Ripper.inspectShow.res, next) => {
      var allSeasons = [];
      if (cliArgs.force || !info.isSeasonCompleted(cliArgs.language, res.seasonNumber)) {
        allSeasons.push(res);
      } else {
        console.log("Skipping completed season %d", res.seasonNumber);
      }
      if (cliArgs.season === undefined) {
        console.log("Searching for all seasons");
        var season = res.seasonNumber;
        async.map(_.range(1, season), (season, next) => {
          if (cliArgs.force || info.isSeasonCompleted(cliArgs.language, season)) {
            console.log("Skipping completed season %d", season);
            return next(null, null);
          }
          subtitles.inspectShow({
            id: info.data.show.id,
            season: season,
            episode: cliArgs.episode
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
          if (!cliArgs.force && info.isEpisodeCompleted(
            cliArgs.language,
            season.seasonNumber,
            episode.episodeNumber
          )) {
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
            language: cliArgs.language
          }, (err, res: Ripper.inspectEpisode.res) => {
            if (err) {
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
              if (!cliArgs.force) {
                if (
                  info.isSubtitleSaved(
                    sub.lng,
                    episode.season,
                    episode.episodeNumber,
                    sub.id
                  )
                ) {
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
                info.markEpisodeCompleted(cliArgs.language, season.seasonNumber, episode.episodeNumber);
              }
              nextEpisode(err);
            });
          })
        }, function(err) {
          if (!err && !cliArgs.quiet) {
            console.log("Would you like to mark season %d as complete?", season.seasonNumber);
            prompt.get("yesno", function(errPrompt, result) {
              if (!errPrompt && result.yesno) {
                info.markSeasonCompleted(cliArgs.language, season.seasonNumber);
              }
              nextSeason(err);
            })
          } else {
            nextSeason(err);
          }
        });
      }, next);
    }
  ], err => {
    if (err) {
      console.error(err);
    } else {
      if (cliArgs.save) {
        info.saveToFile();
      }
      console.log("Success");
    }
    callback(err);
  })
}


var cliArgs: CliArguments = <any>program;

{
  if (typeof cliArgs.newShow === "string") {
    if (cliArgs.args.length === 0) {
      console.error("Need to specify show destination");
      process.exit(1);
    }
    const info = new SavedInfo(cliArgs.args[0]);
    if (cliArgs.vid) {
      video.addNewTvShow(cliArgs.newShow, cliArgs.args[0], info);
    } else {
      rip(cliArgs.newShow, info, () => {
        process.exit(0);
      });
    }
  } else {
    const currentDir = process.cwd();
    const customFolders = cliArgs.args.length > 0;
    const content = customFolders ?
      cliArgs.args.map(folder => path.resolve(folder)) :
      fs.readdirSync(currentDir).map(folder => path.join(currentDir, folder));

    console.log("Ripping from " + content.join(","));
    async.eachSeries(content, (folderPath, next) => {
      const stat = fs.statSync(folderPath);
      if (stat.isDirectory()) {
        const info = new SavedInfo(folderPath);
        if (info.loaded || customFolders) {
          return rip(null, info, next);
        } else {
          console.log(`${folderPath} is not a tvRipper folder`);
        }
      } else {
        console.log(`${folderPath} is not a folder`);
      }
      next();
    }, err => {
      if (err) {
        console.error(err);
      }
    });
  }
}
