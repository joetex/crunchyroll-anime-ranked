#!/bin/bash

node ~/git/crunchyroll-anime-ranked/job/crunchy_pull_data.js

cd ~/git/crunchyroll-anime-ranked/

git add .
git commit -m "nightly data update"
git push origin main

echo "Nightly data update complete."
