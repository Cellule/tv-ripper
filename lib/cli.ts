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
      next([res]);
    },
    (allEpisodes: Ripper.inspectShow.res[], next) => {
      async.each(allEpisodes, (episodes, done) => {
        async.each(episodes.episodes, (episode, done) => {
          subtitles.inspectEpisode({
            id: episode.id
          }, (err, res: Ripper.inspectEpisode.res) => {
            if(err) {
              return done(err);
            }
            async.each(res.subtitles, (sub, done) => {
              if(!promptResult.language || promptResult.language === sub.lng) {
                subtitles.downloadSubtitle({
                  id: sub.id,
                  path: path.join(output, showName, "Season " + episode.season)
                });
                return;
              }
              done();
            }, done);
          })
        }, done);
      }, next);
    }
  ], err => {
    console.error(err);
  })
})
