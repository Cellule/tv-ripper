import ripper = require("./ripper");
import async = require("async");
import _ = require("lodash");
import path = require("path");
import fs = require("fs");

var prompt = require("prompt");
import program = require("commander");

var subtitles = ripper.subtitles;

interface CliArguments {
  name: string;
  season?: number;
  episode?: number;
  language: string;
  quiet: boolean;
  save: boolean;
  force: boolean;
}

program
  .version("0.0.1")
  .option("-n, --name <tvShow>", "tv show name")
  .option("-s, --season <n>", "Optional. Season you want to download. Select '0' for latest only. Omit to download all seasons", parseInt)
  .option("-e, --episode <n>", "Optional. Episode you want to download", parseInt)
  .option("-l, --language <lng>", "Required. Subtitle language. Default: English", "English")
  .option("-q, --quiet", "won't prompt you when multiple choices available")
  .option("-f, --force", "Download already downloaded subtitles as well")
  .option("--no-save", "Save information for tv show and downloaded subtitles so far to avoid duplicates")
  .parse(process.argv)

prompt.start();
prompt.properties.yesno = {
  name: 'yesno',
  validator: /y[es]*|n[o]?/,
  warning: 'Must respond yes or no',
  default: 'no',
  before: function(val) {
    return val[0] === "y";
  }
}

var cliArgs: CliArguments = <any>program;

rip();

interface SavedInfo {
  show?: Ripper.searchForShow.show;
  downloaded: {
    [language: string]: {
      [season: number]: {
        [episode: number]: {
          [subId: number]: boolean
        };
        completed?: boolean;
      }
    }
  }
}

function rip() {
  var savedInfoFilename = "tvRipper.json";
  var savedInfo: SavedInfo = {downloaded: {}};
  try {
    savedInfo = require(path.join(process.cwd(), savedInfoFilename));
  } catch(e) {
    //do nothing
  }
  savedInfo.downloaded = savedInfo.downloaded || {};
  function isSubtitleSaved(lng: string, season: number, episode: number, subId: number) {
    return savedInfo.downloaded[lng] &&
      savedInfo.downloaded[lng][season] &&
      savedInfo.downloaded[lng][season][episode] &&
      savedInfo.downloaded[lng][season][episode][subId];
  }
  function saveSubtitle(lng: string, season: number, episode: number, subId: number) {
    savedInfo.downloaded[lng] = savedInfo.downloaded[lng] || {};
    savedInfo.downloaded[lng][season] = savedInfo.downloaded[lng][season] || {}
    savedInfo.downloaded[lng][season][episode] = savedInfo.downloaded[lng][season][episode] || {};
    savedInfo.downloaded[lng][season][episode][subId] = true;
  }
  function markSeasonCompleted(lng: string, season: number, unmark?: boolean) {
    savedInfo.downloaded[lng] = savedInfo.downloaded[lng] || {};
    savedInfo.downloaded[lng][season] = savedInfo.downloaded[lng][season] || {}
    savedInfo.downloaded[lng][season].completed = unmark ? false : true;
  }
  function isSeasonCompleted(lng: string, season: number) {
    return savedInfo.downloaded[lng] &&
      savedInfo.downloaded[lng][season] &&
      savedInfo.downloaded[lng][season].completed;
  }
  var output = process.cwd();

  if(
    !savedInfo.show &&
    typeof cliArgs.name !== "string"
  ) {
    // No tv show selected. Use current directory name
    cliArgs.name = path.basename(output);
  }



  async.waterfall([
    // Check if the selected season is already marked as completed
    next => {
      if(cliArgs.season && isSeasonCompleted(cliArgs.language, cliArgs.season)) {
        console.log("Selected season is marked as completed. Do you want to download it again?");
        prompt.get("yesno", function(errPrompt, result) {
          if(!errPrompt && result.yesno) {
            markSeasonCompleted(cliArgs.language, cliArgs.season, true);
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
      if(savedInfo.show) {
        return next(null, { shows: [savedInfo.show] });
      }
      subtitles.searchForShow({
        name: cliArgs.name,
        exactMatch: cliArgs.quiet
      }, next);
    },
    // Find the episodes available for this season
    (res: Ripper.searchForShow.res, next) => {
      var selectedShow: Ripper.searchForShow.show;
      if(res.shows.length === 1 || cliArgs.quiet) {
        selectedShow = res.shows[0];
        next(null, selectedShow);
      } else {
        var nShows = res.shows.length;
        function selectShow() {
          console.log("Available Shows:\n%s", res.shows.map(function(show, i) {
            return (i + 1) + ": " + show.name;
          }).join("\n"))
          prompt.get("choice", function(err, pRes) {
            var i = parseInt(pRes.choice)|0;
            if( ((i - 1) >>> 0) > nShows) {
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
      savedInfo.show = selectedShow;

      console.log("Selected tv show", selectedShow.name);
      subtitles.inspectShow({
        id: selectedShow.id,
        // if season is not defined, this will return the latest season
        season: cliArgs.season > 0 ? cliArgs.season: undefined,
        episode: cliArgs.episode
      }, next);
    },
    // If no season was specified, search for all other seasons
    (res: Ripper.inspectShow.res, next) => {
      var allSeasons = [];
      if(!isSeasonCompleted(cliArgs.language, res.seasonNumber)) {
        allSeasons.push(res);
      } else {
        console.log("Skipping completed season %d", res.seasonNumber);
      }
      if(cliArgs.season === undefined) {
        console.log("Searching for all seasons");
        var season = res.seasonNumber;
        async.map(_.range(1, season), (season, next) => {
          if(isSeasonCompleted(cliArgs.language, season)) {
            console.log("Skipping completed season %d", season);
            return next(null, null);
          }
          subtitles.inspectShow({
            id: savedInfo.show.id,
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
          console.log("Found episode", episode.name);
          // check the subtitles for this episode
          subtitles.inspectEpisode({
            id: episode.id,
            language: cliArgs.language
          }, (err, res: Ripper.inspectEpisode.res) => {
            if(err) {
              console.error("No subtitle found for episode %s", episode.name);
              // Show error, but keep going.
              return nextEpisode();
            }
            // download the subtitles
            async.each(res.subtitles, (sub, nextSub) => {
              if(!cliArgs.force) {
                if(
                  isSubtitleSaved(
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
                if(!err) {
                  saveSubtitle(
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
            }, nextEpisode);
          })
        }, function(err) {
          if(!err) {
            console.log("Would you like to mark season %d as complete?", season.seasonNumber);
            prompt.get("yesno", function(errPrompt, result) {
              if(!errPrompt && result.yesno) {
                markSeasonCompleted(cliArgs.language, season.seasonNumber);
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
    if(cliArgs.save) {
      var dst = path.join(process.cwd(), savedInfoFilename);
      console.log("Saving downloaded subtitles at %s", dst)
      fs.writeFileSync(dst, JSON.stringify(savedInfo));
    }
    if(err) {
      console.error(err);
    } else {
      console.log("Success");
    }
  })
}
