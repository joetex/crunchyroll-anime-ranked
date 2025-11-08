// const puppeteer = require('puppeteer');

const fs = require('fs');
const path = require('path');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

let BEARER_TOKEN = '';
let LOCALE = 'en';
let LANGUAGE = 'ja-JP';

async function main() {

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], });
    const page = await browser.newPage();

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    // Randomize viewport slightly to avoid fingerprinting from consistent dimensions
    await page.setViewport({
        width: Math.floor(1024 + Math.random() * 100),
        height: Math.floor(768 + Math.random() * 100),
    });

    const onResponse = async (response) => {
        // Check if the response URL matches your desired API endpoint
        let url = response.url();
        if (url.includes('/content/v2/discover/browse')) {
            try {
                let request = response.request();
                let Authorization = request.headers()['authorization'];
                BEARER_TOKEN = Authorization.replace('Bearer ', '');

                await getAllAnime();
                await page.close();
                await browser.close();
                // Get the response body as JSON
                // const responseBody = await response.json(); //for JSON data
                // console.log('API Response:', responseBody);
                // You can then process this responseBody as needed
            } catch (error) {
                console.error('Error parsing API response:', error);
            }
        }
    }

    // Listen for the 'response' event
    page.on('response', onResponse);

    // Navigate the page to a URL.
    await page.goto('https://www.crunchyroll.com/videos/popular', { waitUntil: 'networkidle2' });

    await page.screenshot({ path: 'job/screenshot.png' });
}


async function getAllAnime() {

    let total = Number.MAX_SAFE_INTEGER;
    let start = 0;
    let n = 36;

    let allItems = [];

    while (start < total) {
        let pageData = await fetchPage(start, n);
        if (total != pageData?.total) {
            total = pageData.total;
        }
        let arr = pageData?.data;
        if (!arr || arr.length === 0) {
            break;
        }
        allItems = allItems.concat(arr);
        start += n;
    }

    fs.writeFileSync('data/all_anime.json', JSON.stringify(allItems, null, 2), 'utf8');

    createHistoricalJSON(allItems);
    sortAndSaveAnime(allItems);
    sortAndSaveAnimeByLanguage(allItems, 'en-US');
    // createHistoricalJSONByLang(allItems, 'en-US');
    findMissingAnime(allItems);

    return allItems;
}

function sortAndSaveAnime(allItems) {

    // Map the items to a simpler structure
    let animes = allItems.map(item => {
        return {
            title: item.title,
            average: Number.parseFloat(item.rating.average),
            ratingCount: item.rating.total
        };
    });

    //Sort by average desc, then by ratingCount desc
    animes.sort((a, b) => {
        if (a.average == b.average) {
            return b.ratingCount - a.ratingCount;
        }
        return b.average - a.average;
    });

    fs.writeFileSync('anime_ratings.json', JSON.stringify(animes, null, 2), 'utf8');
}

function sortAndSaveAnimeByLanguage(allItems, lang) {

    lang = lang || 'en-US';
    // Map the items to a simpler structure
    let animes = allItems
    .filter(item => item?.series_metadata?.audio_locales?.includes(lang))
    .map(item => {
        return {
            title: item.title,
            average: Number.parseFloat(item.rating.average),
            ratingCount: item.rating.total
        };
    });

    //Sort by average desc, then by ratingCount desc
    animes.sort((a, b) => {
        if (a.average == b.average) {
            return b.ratingCount - a.ratingCount;
        }
        return b.average - a.average;
    });

    fs.writeFileSync('data/anime_ratings_' + lang + '.json', JSON.stringify(animes, null, 2), 'utf8');
}


function createHistoricalJSONByLang(allItems, lang) {
    lang = lang || 'en-US';
    const now = new Date();
    const isoDateWithTime = now.toISOString(); // Example: "2025-11-07T23:57:00.000Z"
    const dateOnly = isoDateWithTime.split('T')[0].replace(/\-/ig, ''); // Result: "20251107"

    fs.writeFileSync('data/anime_ratings_' + lang + '_' + dateOnly + '.json', JSON.stringify(allItems, null, 2), 'utf8');
}


function findMissingAnime(allItems) {
    try {
        const now = new Date();
        now.setDate(now.getDate() - 1);
        const isoDateWithTime = now.toISOString(); // Example: "2025-11-07T23:57:00.000Z"
        const dateOnly = isoDateWithTime.split('T')[0].replace(/\-/ig, ''); // Result: "20251107"

        const yesterdayAnime = JSON.parse(fs.readFileSync('data/all_anime_' + dateOnly + '.json', 'utf8'));

        let animeMap = {};
        for (let anime of yesterdayAnime) {
            animeMap[anime.id] = anime;
        }
        let missingAnime = [];
        for (let anime of allItems) {
            if (!animeMap[anime.id]) {
                missingAnime.push(anime);
            }
        }

        fs.writeFileSync('data/missing_anime.json', JSON.stringify(missingAnime, null, 2), 'utf8');
        // console.log('Missing Anime:', missingAnime);
    }
    catch (err) {
        console.error('Error reading historical data:', err);
        return;
    }

}

function createHistoricalJSON(allItems) {
    const now = new Date();
    const isoDateWithTime = now.toISOString(); // Example: "2025-11-07T23:57:00.000Z"
    const dateOnly = isoDateWithTime.split('T')[0].replace(/\-/ig, ''); // Result: "20251107"

    fs.writeFileSync('data/all_anime_' + dateOnly + '.json', JSON.stringify(allItems, null, 2), 'utf8');
}

async function fetchPage(start, n) {
    let response = await fetch(`https://www.crunchyroll.com/content/v2/discover/browse?start=${start}&n=${n}&sort_by=popularity&ratings=true&preferred_audio_language=${LANGUAGE}&locale=${LOCALE}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${BEARER_TOKEN}`
        }
    })
    let json = await response.json();
    return json;
}

main();