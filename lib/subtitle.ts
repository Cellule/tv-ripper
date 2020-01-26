import { prompt } from "enquirer";
import _ from "lodash";
import path from "path";
import ripper from "./ripper";
import SavedInfo from "./SavedInfo";

var subtitles = ripper.subtitles;

export async function rip(
  showName: string,
  info: SavedInfo,
  opts: {
    force: boolean;
    language: string;
    quiet: boolean;
    save: boolean;
    season?: number;
    episode?: number;
  }
) {
  const output = info.folder;
  if (!info.data.show && typeof showName !== "string") {
    // No tv show selected. Use current directory name
    showName = path
      .basename(output)
      // Remove the year in parenthesis
      .replace(/\(\d+(-\d+)?\)/, "");
  }
  let lastSeason = null;

  // Check if the selected season is already marked as completed
  if (opts.season && info.isSeasonCompleted(opts.language, opts.season)) {
    if (opts.quiet) {
      throw new Error("Nothing to download");
    }
    const { rerun } = await prompt({
      name: "rerun",
      type: "confirm",
      message:
        "Selected season is marked as completed. Do you want to download it again?"
    });
    if (!rerun) {
      throw new Error("Nothing to download");
    }
    info.markSeasonCompleted(opts.language, opts.season, true);
  }

  const allShows = info.data.show
    ? { shows: [info.data.show] }
    : await subtitles.searchForShow({
        name: showName,
        exactMatch: opts.quiet
      });

  let selectedShow: Ripper.searchForShow.show;
  if (allShows.shows.length === 1 || opts.quiet) {
    selectedShow = allShows.shows[0];
  } else {
    const { showName } = await prompt({
      name: "showName",
      type: "select",
      message: "Available Shows",
      choices: allShows.shows.map(show => show.name)
    });
    selectedShow = allShows.shows.find(show => show.name === showName);
  }
  // Save show for later
  info.data.show = selectedShow;

  console.log("Selected tv show", selectedShow.name);
  const showDetails = await subtitles.inspectShow({
    id: selectedShow.id,
    // if season is not defined, this will return the latest season
    season: opts.season > 0 ? opts.season : undefined,
    episode: opts.episode
  });
  const seasons: Ripper.inspectShow.res[] = [];
  if (
    opts.force ||
    !info.isSeasonCompleted(opts.language, showDetails.seasonNumber)
  ) {
    seasons.push(showDetails);
  } else {
    if (!opts.quiet) {
      console.log("Skipping completed season %d", showDetails.seasonNumber);
    }
  }
  if (opts.season === undefined) {
    console.log("Searching for all seasons");
    lastSeason = showDetails.seasonNumber;
    const moreSeasons = await Promise.all(
      _.range(1, lastSeason).map(async season => {
        if (opts.force || info.isSeasonCompleted(opts.language, season)) {
          if (!opts.quiet) console.log("Skipping completed season %d", season);
          return null;
        }
        return await subtitles.inspectShow({
          id: info.data.show.id,
          season: season,
          episode: opts.episode
        });
      })
    );
    seasons.push(...moreSeasons);
  }

  for (const season of seasons) {
    await Promise.all(
      season.episodes.map(async episode => {
        if (
          !opts.force &&
          info.isEpisodeCompleted(
            opts.language,
            season.seasonNumber,
            episode.episodeNumber
          )
        ) {
          if (!opts.quiet)
            console.log(
              "Skipping episode %dx%d",
              season.seasonNumber,
              episode.episodeNumber
            );
          return;
        }
        console.log("Found episode", episode.name);
        // check the subtitles for this episode
        const res: Ripper.inspectEpisode.res | null = await subtitles
          .inspectEpisode({
            id: episode.id,
            language: opts.language
          })
          .catch(() => {
            if (!opts.quiet)
              console.error(
                "No subtitle found for episode %dx%d",
                season.seasonNumber,
                episode.episodeNumber
              );
            // Show error, but keep going.
            return null;
          });
        // download the subtitles
        for (const sub of res?.subtitles || []) {
          if (!opts.force) {
            if (
              info.isSubtitleSaved(
                sub.lng,
                episode.season,
                episode.episodeNumber,
                sub.id
              )
            ) {
              if (!opts.quiet) {
                console.info("Skipping cached subtitle %s", sub.name);
              }
              return;
            }
          }
          var outputPath = path.join(output, "Season " + episode.season);
          console.log("Downloading subtitle %s at %s", sub.name, outputPath);
          await subtitles
            .downloadSubtitle({
              id: sub.id,
              path: outputPath
            })
            .then(
              () => {
                info.saveSubtitle(
                  sub.lng,
                  episode.season,
                  episode.episodeNumber,
                  sub.id
                );
              },
              err => {
                // Ignore the error and continue, it will simply not save and try again next time.
                console.error(
                  "Error downloading subtitle %s. %j",
                  sub.name,
                  err
                );
              }
            );
        }
        info.markEpisodeCompleted(
          opts.language,
          season.seasonNumber,
          episode.episodeNumber
        );
      })
    );
    if (!opts.quiet) {
      if (lastSeason === null) {
        const {save} = await prompt({
          name: "save",
          type: "confirm",
          message: `Would you like to mark season ${season.seasonNumber} as complete?`
        })
        if (save) {
          info.markSeasonCompleted(opts.language, season.seasonNumber);
        }
      } else if (season.seasonNumber < lastSeason) {
        info.markSeasonCompleted(opts.language, season.seasonNumber);
      }
    }
  }

  if (opts.save) {
    info.saveToFile();
  }
  console.log("Success");
}
