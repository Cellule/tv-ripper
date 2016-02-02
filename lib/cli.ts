import fs = require("fs");
import path = require("path");
import async = require("async");
import _ = require("lodash");

import video = require("./video");
import subtitle = require("./subtitle");
import SavedInfo = require("./SavedInfo");

import prompt = require("./myprompt");
import program = require("commander");

var rip = subtitle.rip;

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
  list: boolean;
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
  .option("--list", "List subfolder with tv-ripper info")
  .option("--no-save", "Save information for tv show and downloaded subtitles so far to avoid duplicates")
  .parse(process.argv);

var cliArgs: CliArguments = <any>program;
processCli();

function processCli() {
  if(cliArgs.list) {
    return listTvRipperFolders();
  }
  if(!cliArgs.sub && !cliArgs.vid) {
    cliArgs.sub = true;
    cliArgs.vid = true;
  }
  if (typeof cliArgs.newShow === "string") {
    return addNewFolder();
  }

  return checkAllFolders();
}


function listTvRipperFolders() {
  const currentDir = process.cwd();
  const customFolders = cliArgs.args.length > 0;
  const content = customFolders ?
    cliArgs.args.map(folder => path.resolve(folder)) :
    fs.readdirSync(currentDir).map(folder => path.join(currentDir, folder));
  content.forEach(folderPath => {
    const stat = fs.statSync(folderPath);
      if (stat.isDirectory()) {
        const info = new SavedInfo(folderPath);
        if (info.loaded) {
          const hasVidInfo = !!info.data.imdbTitle;
          const hasSubInfo = !!info.data.show;
          console.log(folderPath);
          console.log(`- TvShow ready: ${hasVidInfo}`);
          console.log(`- SubTitle ready: ${hasSubInfo}`);
        } else {
          console.log(`${folderPath} is not a tvRipper folder`);
        }
      } else {
        console.log(`${folderPath} is not a folder`);
      }
  });
}

function addNewFolder() {
  if (cliArgs.args.length === 0) {
    console.error("Need to specify show destination");
    process.exit(1);
  }
  const info = new SavedInfo(cliArgs.args[0]);
  if (cliArgs.vid) {
    video.addNewTvShow(cliArgs.newShow, info, () => {
      process.exit(0);
    });
  } else {
    rip(cliArgs.newShow, info, cliArgs, () => {
      process.exit(0);
    });
  }
}

function checkAllFolders() {
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
      function downloadSub(next) {
        return rip(null, info, cliArgs, err => {
          // continue even if an error occured
          next();
        });
      }
      function downloadVid(next) {
        if(cliArgs.season && cliArgs.episode) {
          return video.DownloadEpisode(
            info,
            cliArgs.season,
            cliArgs.episode,
            {quiet: cliArgs.quiet},
            () => {next();}
          );
        }
        video.DownloadNextEpisode(info, {
          quiet: cliArgs.quiet
        }, err => {
          if(!err) {
            // If no errors, try the next episode
            return downloadVid(next);
          }
          next();
        })
      }
      if (info.loaded || customFolders) {
        var n = cliArgs.vid ? downloadVid.bind(null, next) : next;
        if(cliArgs.sub) {
          downloadSub(n);
        } else {
          n();
        }
        return;
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