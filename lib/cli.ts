import ripper = require("./ripper");
import async = require("async");
import _ = require("lodash");
import path = require("path");

var prompt = require("prompt");
var subtitles = ripper.subtitles;

prompt.start();

prompt.get({
  properties: {
    name: {
      description: "Enter the name of the show you want to rip",
      require: true
    },
    season: {
      description: "Optional. Enter the season number you want",
      type: "number"
    },
    language: {
      description: "Optional. Enter your prefered language",
    }
  }
}, function(err, promptResult) {
  var showId;
  var showName;
  var output = process.cwd();

  async.waterfall([
    next => {
      subtitles.searchForShow({
        name: promptResult.name,
        exactMatch: true
      }, next);
    },
    (res: Ripper.searchForShow.res, next) => {
      showId = res.shows[0].id;
      showName = res.shows[0].name;
      console.log("Found tv show", showName);
      subtitles.inspectShow({
        id: showId,
        season: promptResult.season
      }, next);
    },
    (res: Ripper.inspectShow.res, next) => {
      if(!promptResult.season) {
        var season = res.episodes[0].season;
        async.map(_.range(1, season), (season, next) => {
          subtitles.inspectShow({
            id: showId,
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
    (allEpisodes: Ripper.inspectShow.res[], next) => {
      async.each(allEpisodes, (episodes, done) => {
        async.each(episodes.episodes, (episode, done) => {
          if(!episode.amount) {
            // skip this episode
            return done();
          }
          console.log("Found episode", episode.name);
          subtitles.inspectEpisode({
            id: episode.id
          }, (err, res: Ripper.inspectEpisode.res) => {
            if(err) {
              return done(err);
            }
            async.each(res.subtitles, (sub, done) => {
              if(!promptResult.language || promptResult.language === sub.lng) {
                var outputPath = path.join(output, showName, "Season " + episode.season);
                console.log("Downloading subtitle %s at %s", sub.name, outputPath);
                subtitles.downloadSubtitle({
                  id: sub.id,
                  path: outputPath
                }, done);
                return;
              }
              done();
            }, done);
          })
        }, done);
      }, next);
    }
  ], err => {
    if(err) {
      console.error(err);
    } else {
      console.log("Success");
    }
  })
})
