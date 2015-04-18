declare module Ripper {
  module inspectShow {
    export interface res {
      episodes: {
        id: number,
        episodeNumber: number,
        name: string,
        amount: number,
        season: number
      }[]
    }
  }

  module searchForShow {
    export interface res {
      shows: {id: number, name: string}[]
    }
  }

  module inspectEpisode {
    export interface res {
      subtitles: {
        id: number,
        name: string,
        lng: string
      }[]
    }
  }

  module downloadSubtitles {
    export interface res {

    }
  }
}
