import fs = require("fs");
import path = require("path");

class SavedInfo {
  data: Ripper.SavedInfoData = { downloaded: {} };
  loaded: boolean = false;
  folder: string;
  savedInfoPath: string;

  constructor(folder: string) {
    const savedInfoFilename = "tvRipper.json";
    this.folder = folder;
    this.savedInfoPath = path.join(folder, savedInfoFilename);
    try {
      this.data = require(this.savedInfoPath);
      this.loaded = true;
    } catch (e) {
      //do nothing
    }
    this.data.downloaded = this.data.downloaded || {};
  }
  saveToFile() {
    console.log("Saving downloaded subtitles at %s", this.savedInfoPath)
    fs.writeFileSync(this.savedInfoPath, JSON.stringify(this.data));
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