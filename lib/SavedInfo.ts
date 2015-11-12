import fs = require("fs");
import path = require("path");
import mkdirp = require("mkdirp");
var beautify = require("js-beautify");

class SavedInfo {
  data: Ripper.SavedInfoData = { downloaded: {} };
  loaded: boolean = false;
  folder: string;
  savedInfoPath: string;

  constructor(folder: string) {
    const savedInfoFilename = "tvRipper.json";
    this.folder = path.resolve(folder);
    try {
      const stat = fs.statSync(this.folder);
      if(!stat.isDirectory()) {
        throw new Error(`Path ${this.folder} is not a directory`);
      }
    } catch(e) {
    }
    this.savedInfoPath = path.join(this.folder, savedInfoFilename);
    //console.log(`Trying to load saved info at ${this.savedInfoPath}`);
    try {
      this.data = require(this.savedInfoPath);
      this.loaded = true;
    } catch (e) {
      //do nothing
    }
    //console.log(`${this.folder}: TvRipper ${this.loaded ? "": "not "}loaded`)
    this.data.downloaded = this.data.downloaded || {};
  }
  saveToFile() {
    try {
      fs.statSync(this.folder);
    } catch(e) {
      mkdirp.sync(this.folder);
    }
    console.log("Saving downloaded subtitles at %s", this.savedInfoPath)
    fs.writeFileSync(this.savedInfoPath, beautify(JSON.stringify(this.data), {indent_size: 2}));
  }
  isSubtitleSaved(lng: string, season: number, episode: number, subId: number) {
    const savedInfo = this.data;
    return savedInfo.downloaded[lng] &&
      savedInfo.downloaded[lng][season] &&
      savedInfo.downloaded[lng][season][episode] &&
      savedInfo.downloaded[lng][season][episode][subId];
  }
  saveSubtitle(lng: string, season: number, episode: number, subId: number) {
    const savedInfo = this.data;
    savedInfo.downloaded[lng] = savedInfo.downloaded[lng] || {};
    savedInfo.downloaded[lng][season] = savedInfo.downloaded[lng][season] || {}
    savedInfo.downloaded[lng][season][episode] = savedInfo.downloaded[lng][season][episode] || {};
    savedInfo.downloaded[lng][season][episode][subId] = true;
  }
  markSeasonCompleted(lng: string, season: number, unmark?: boolean) {
    const savedInfo = this.data;
    savedInfo.downloaded[lng] = savedInfo.downloaded[lng] || {};
    savedInfo.downloaded[lng][season] = savedInfo.downloaded[lng][season] || {}
    savedInfo.downloaded[lng][season].completed = unmark ? false : true;
  }
  isSeasonCompleted(lng: string, season: number) {
    const savedInfo = this.data;
    return savedInfo.downloaded[lng] &&
      savedInfo.downloaded[lng][season] &&
      savedInfo.downloaded[lng][season].completed;
  }
  markEpisodeCompleted(lng: string, season: number, episode: number, unmark?: boolean) {
    const savedInfo = this.data;
    savedInfo.downloaded[lng] = savedInfo.downloaded[lng] || {};
    savedInfo.downloaded[lng][season] = savedInfo.downloaded[lng][season] || {}
    savedInfo.downloaded[lng][season][episode] = savedInfo.downloaded[lng][season][episode] || {}
    savedInfo.downloaded[lng][season][episode].completed = unmark ? false : true;
  }
  isEpisodeCompleted(lng: string, season: number, episode: number) {
    const savedInfo = this.data;
    return savedInfo.downloaded[lng] &&
      savedInfo.downloaded[lng][season] &&
      savedInfo.downloaded[lng][season][episode] &&
      savedInfo.downloaded[lng][season][episode].completed;
  }
}
export = SavedInfo;