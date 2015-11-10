import request = require("superagent");

export interface SeasonSearchRes {
  Title: string;
  Season: string;
  Episodes: {
    Title: string;
    Released: string;
    Episode: string;
    imdbRating: string;
    imdbID: string;
  }[];
}

export interface ShowSearchRes {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  Response: string;
}

export interface EpisodeSearchRes {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Season: string;
  Episode: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  seriesID: string;
  Type: string;
  Response: string;
}

function QueryOmdb(query, callback) {
  request
    .get("http://www.omdbapi.com/")
    .query(query)
    .accept("json")
    .end((err, res) => {
      if (err || res.body.Response === "False") {
        return callback(err || res.body.Error);
      }
      callback(null, res.body);
    });
}

export function searchShow(name: string, callback: (err, res?: ShowSearchRes) => void) {
  QueryOmdb({
    t: name,
    plot: "short",
    r: "json",
    type: "series"
  }, callback);
}

export function searchSeason(showName: string, season: number, callback: (err, res?:SeasonSearchRes) => void) {
  QueryOmdb({
    t: showName,
    season,
    plot: "short",
    r: "json",
    type: "series"
  }, callback);
}

export function searchEpisode(
  showName: string,
  season: number,
  episode: number,
  callback: (err, res?:EpisodeSearchRes) => void
) {
  QueryOmdb({
    t: showName,
    season,
    episode,
    plot: "short",
    r: "json",
    type: "series"
  }, callback);
}