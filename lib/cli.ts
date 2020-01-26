import fs from "fs";
import path from "path";
import yargs from "yargs";
import SavedInfo from "./SavedInfo";
import { rip } from "./subtitle";


const argv = yargs
  .version("3.0.0")
  .options({
    "new-show": {
      alias: "n",
      type: "string",
      description: "Add new tv show name to folder passed in args"
    },
    season: {
      alias: "s",
      type: "number",
      description: "Season you want to download. Select '0' for latest only. Omit to download all seasons"
    },
    episode: {
      alias: "e",
      type: "number",
      description: "Episode you want to download"
    },
    language: {
      alias: "l",
      type: "string",
      description: "Subtitle language",
      default: "English"
    },
    quiet: {
      alias: "q",
      type: "boolean",
      description: "Won't prompt you when multiple choices available",
    },
    force: {
      alias: "f",
      type: "boolean",
      description: "Download already downloaded subtitles as well",
    },
    list: {
      type: "boolean",
      description: "List subfolder with tv-ripper info",
    },
    "save": {
      type: "boolean",
      description: "Save information for tv show and downloaded subtitles so far to avoid duplicates",
      default: true,
    }
  }).argv;

main().catch(console.error);

async function main() {
  if (argv.list) {
    return await listTvRipperFolders();
  }
  if (typeof argv.newShow === "string") {
    return await addNewFolder();
  }

  return await checkAllFolders();
}

function listTvRipperFolders() {
  const currentDir = process.cwd();
  const customFolders = argv._.length > 0;
  const content = customFolders
    ? argv._.map(folder => path.resolve(folder))
    : fs.readdirSync(currentDir).map(folder => path.join(currentDir, folder));
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

async function addNewFolder() {
  if (argv._.length === 0) {
    console.error("Need to specify show destination");
    process.exit(1);
  }
  const info = new SavedInfo(argv.args[0]);
  await rip(argv["new-show"], info, argv);
}

async function checkAllFolders() {
  const currentDir = process.cwd();
  const customFolders = argv._.length > 0;
  const content = customFolders
    ? argv._.map(folder => path.resolve(folder))
    : fs.readdirSync(currentDir).map(folder => path.join(currentDir, folder));

  console.log("Ripping from " + content.join(","));
  for (const folderPath of content) {
    const stat = fs.statSync(folderPath);
    if (stat.isDirectory()) {
      const info = new SavedInfo(folderPath);
      if (info.loaded || customFolders) {
        await rip(null, info, argv).catch(() => {
          // continue even if an error occured
        })
      } else {
        console.log(`${folderPath} is not a tvRipper folder`);
      }
    } else {
      console.log(`${folderPath} is not a folder`);
    }
  }
}
