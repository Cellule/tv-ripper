# tv-ripper

## Description
This is a command line utility to download subtitles for your tv shows. Simply run it inside the folder where your tv show is located and it will download them for you. It also saves some information to easily download subtitles for new episodes.
Subtitles are downloaded from http://www.tvsubtitles.net/

## Installation
```
$ npm install tv-ripper -g
```

## Usage
```
Options:
  --help          Show help                                                                                         [boolean]
  --version       Show version number                                                                               [boolean]
  --new-show, -n  Add new tv show name to folder passed in args                                                      [string]
  --season, -s    Season you want to download. Select '0' for latest only. Omit to download all seasons              [number]
  --episode, -e   Episode you want to download                                                                       [number]
  --language, -l  Subtitle language                                                             [string] [default: "English"]
  --quiet, -q     Won't prompt you when multiple choices available                                                  [boolean]
  --force, -f     Download already downloaded subtitles as well                                                     [boolean]
  --list          List subfolder with tv-ripper info                                                                [boolean]
  --save          Save information for tv show and downloaded subtitles so far to avoid duplicates  [boolean] [default: true]
```
Example
```
$ tv-ripper -n Arrow -l English
```
This will download all the english subtitles for the show Arrow.
Resulting tree
```
Working Directory
|- Season 1
   |- Episode 1 subtitle.en.srt
   |- Episode 2 subtitle.en.srt
   |- ...
|- Season 2
   |- Episode 1 subtitle.en.srt
   |- Episode 2 subtitle.en.srt
   |- ...
|- ...
```
