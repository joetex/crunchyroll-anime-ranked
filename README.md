# Crunchyroll Anime Lists

This repo is updated nightly with the latest anime data from the crunchyroll popular API.  

- [anime_ratings.json](anime_ratings.json) - All US anime, condensed data, sorted by Average DESC, Total Ratings DESC
- [anime_ratings_en-US.json](anime_ratings_en-US.json) - English Dubs *only* of US anime, condensed data, sorted by Average DESC, Total Ratings DESC
- [all_anime.json](data/all_anime.json) - All US anime, full data, as seen on https://www.crunchyroll.com/videos/popular
- [missing_anime.json](data/missing_anime.json) - Anime removed between yesterday and today for US anime, full data



### Run the script yourself

#### Install using NPM

```
npm i
```

#### Run using Node

```
node job/crunchy_pull_data.js
```