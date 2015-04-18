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
  .option("-l, --language <lng>", "Required. Subtitle language [English, French, ...]")
  .option("-q, --quiet", "won't prompt you when multiple choices available")
  .option("-f, --force", "Download already downloaded subtitles as well")
  .option("-r, --no-save", "Save information for tv show and downloaded subtitles so far to avoid duplicates")
  .parse(process.argv)

prompt.start();
var cliArgs: CliArguments = <any>program;

if(!cliArgs.language) {
  prompt.get({
    name: 'yesno',
    message: 'No language specified, are you sure you want to continue?',
    validator: /y[es]*|n[o]?/,
    warning: 'Must respond yes or no',
    default: 'no'
  }, function(err, result) {
    if(err || !result.yesno) {
      process.exit(0);
    }
    rip();
  })
} else {
  rip();
}

interface SavedInfo {
  show?: Ripper.searchForShow.show;
  downloaded: {
    [language: string]: {
      [season: string]: {
        [episode: string]: boolean;
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
  function isSubtitleSaved(lng, season, episode) {
    return savedInfo.downloaded[lng] &&
      savedInfo.downloaded[lng][season] &&
      savedInfo.downloaded[lng][season][episode];
  }
  function saveSubtitle(lng, season, episode) {
    savedInfo.downloaded[lng] = savedInfo.downloaded[lng] || {};
    savedInfo.downloaded[lng][season] = savedInfo.downloaded[lng][season] || {}
    savedInfo.downloaded[lng][season][episode] = true;
  }
  var output = process.cwd();

  async.waterfall([
    // Search the show or use saved info
    next => {
      if(savedInfo.show) {
        return next(null, { episodes: [savedInfo.show] });
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
      }
      // Save show for later
      savedInfo.show = selectedShow;

      console.log("Found tv show", selectedShow.name);
      subtitles.inspectShow({
        id: selectedShow.id,
        // if season is not defined, this will return the latest season
        season: cliArgs.season > 0 ? cliArgs.season: undefined
      }, next);
    },
    // If no season was specified, search for all other seasons
    (res: Ripper.inspectShow.res, next) => {
      if(cliArgs.season === undefined) {
        var season = res.episodes[0].season;
        async.map(_.range(1, season), (season, next) => {
          subtitles.inspectShow({
            id: savedInfo.show.id,
            season: season
          }, next);
        }, (err, allEpisodes) => {
          allEpisodes = allEpisodes || [];
          allEpisodes.push(res);
          next(err, allEpisodes);
        });
        return;
      }
      next(null, [res]);
    },
    // Inspect all the shows and download the desired subtitles
    (seasons: Ripper.inspectShow.res[], next) => {
      async.each(seasons, (season, nextSeason) => {
        async.each(season.episodes, (episode, nextEpisode) => {
          console.log("Found episode", episode.name);
          // check the subtitles for this episode
          subtitles.inspectEpisode({
            id: episode.id,
            language: cliArgs.language
          }, (err, res: Ripper.inspectEpisode.res) => {
            if(err) {
              return nextEpisode(err);
            }
            // download the subtitles
            async.each(res.subtitles, (sub, nextSub) => {
              if(!cliArgs.force) {
                if(
                  isSubtitleSaved(
                    sub.lng,
                    episode.season,
                    episode.episodeNumber
                  )
                ) {
                  console.info("Skipping cached subtitle %s", sub.name);
                  return nextSub();
                }
              }
              saveSubtitle(
                sub.lng,
                episode.season,
                episode.episodeNumber
              );
              var outputPath = path.join(output, "Season " + episode.season);
              console.log("Downloading subtitle %s at %s", sub.name, outputPath);
              subtitles.downloadSubtitle({
                id: sub.id,
                path: outputPath
              }, nextSub);
            }, nextEpisode);
          })
        }, nextSeason);
      }, next);
    }
  ], err => {
    if(err) {
      console.error(err);
    } else {
      if(cliArgs.save) {
        fs.writeFileSync(savedInfoFilename, JSON.stringify(savedInfo));
      }
      console.log("Success");
    }
  })
}
