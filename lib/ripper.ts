import searchForShow = require("./searchForShow");
import inspectShow = require("./inspectShow");
import inspectEpisode = require("./inspectEpisode");
import downloadSubtitle = require("./downloadSubtitle");

export = {
  subtitles: {
    searchForShow: searchForShow,
    inspectShow: inspectShow,
    inspectEpisode: inspectEpisode,
    downloadSubtitle: downloadSubtitle
  }
}
