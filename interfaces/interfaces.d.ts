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
    export interface show {
      id: number, name: string
    }
    export interface res {
      shows: show[]
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
