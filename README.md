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
Usage: tv-ripper [options]

  Options:

    -h, --help            output usage information
    -V, --version         output the version number
    -n, --name <tvShow>   tv show name
    -s, --season <n>      Optional. Season you want to download. Select '0' for latest only. Omit to download all seasons
    -e, --episode <n>     Optional. Episode you want to download
    -l, --language <lng>  Required. Subtitle language. Default: English
    -q, --quiet           won't prompt you when multiple choices available
    -f, --force           Download already downloaded subtitles as well
    -r, --no-save         Save information for tv show and downloaded subtitles so far to avoid duplicates
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
