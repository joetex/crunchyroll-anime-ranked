// const puppeteer = require('puppeteer');

const fs = require('fs');
const path = require('path');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

let HEADERS = {};
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

    await page.setRequestInterception(true);

    let hasStarted = false;

    const onRequest = async (request) => {
        // Example: Intercepting a specific URL and sending a custom POST request
        if (!hasStarted && request.url().includes('/content/v2/discover/browse') && request.method() === 'GET') {
            console.log('Intercepted GET request to ' + request.url());
            // await request.respond({
            //     status: 200,
            //     contentType: 'application/json',
            //     body: JSON.stringify({ message: 'Custom POST response from interception' }),
            // });
            // let request = response.request();
            let Authorization = request.headers()['authorization'];
            BEARER_TOKEN = Authorization.replace('Bearer ', '');
            HEADERS = request.headers();

            hasStarted = true;
            await getAllAnime(page, browser);
            


            request.continue(); // Allow other requests to proceed normally
            // Alternatively, you could modify the original request and continue it:
            // await request.continue({
            //   method: 'POST',
            //   postData: JSON.stringify({ customData: 'newValue' }),
            //   headers: { ...request.headers(), 'Content-Type': 'application/json' },
            // });
        } else {
            request.continue(); // Allow other requests to proceed normally
        }
    }

    page.on('request', onRequest);


    const onResponse = async (response) => {
        // Check if the response URL matches your desired API endpoint
        let url = response.url();
        if (url.includes('/content/v2/discover/browse')) {
            try {
                let request = response.request();
                let Authorization = request.headers()['authorization'];
                BEARER_TOKEN = Authorization.replace('Bearer ', '');

                console.log("Bearer", BEARER_TOKEN);
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
    // page.on('response', onResponse);

    // Navigate the page to a URL.
    await page.goto('https://www.crunchyroll.com/videos/popular', { waitUntil: 'networkidle2' });

    await page.screenshot({ path: 'job/screenshot.png' });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAllAnime(page, browser) {

    let total = Number.MAX_SAFE_INTEGER;
    let start = 0;
    let n = 36;

    let allItems = [];

    while (start < total) {
        let pageData = await fetchPage(page, start, n);
        if (pageData == null) return [];

        if (total != pageData?.total) {
            total = pageData.total;
        }
        let arr = pageData?.data;
        if (!arr || arr.length === 0) {
            break;
        }
        allItems = allItems.concat(arr);
        start += n;
        await sleep(100); // Sleep for 1 second between requests to avoid rate limiting
    }

    fs.writeFileSync('data/all_anime.json', JSON.stringify(allItems, null, 2), 'utf8');

    createHistoricalJSON(allItems);
    sortAndSaveAnime(allItems);
    sortAndSaveAnimeByLanguage(allItems, 'en-US');
    // createHistoricalJSONByLang(allItems, 'en-US');
    findMissingAnime(allItems);

    await page.close();
    await browser.close();
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
        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const isoDateWithTime = yesterday.toISOString(); // Example: "2025-11-07T23:57:00.000Z"
        const yesterdayDateOnly = isoDateWithTime.split('T')[0].replace(/\-/ig, ''); // Result: "20251107"
        const dateOnly = now.toISOString().split('T')[0].replace(/\-/ig, '');;
        const yesterdayAnime = JSON.parse(fs.readFileSync('data/all_anime_' + yesterdayDateOnly + '.json', 'utf8'));

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


        fs.writeFileSync('data/missing_anime_' + dateOnly + '.json', JSON.stringify(missingAnime, null, 2), 'utf8');
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

async function fetchPage(page, start, n) {

    const postResponse = await page.evaluate(async (start, n, LANGUAGE, LOCALE, HEADERS) => {
        let url = `https://www.crunchyroll.com/content/v2/discover/browse?start=${start}&n=${n}&sort_by=popularity&ratings=true&preferred_audio_language=${LANGUAGE}&locale=${LOCALE}`
        let response = await fetch(url, {
            method: 'GET',
            headers: HEADERS
            // headers: {
            //     'Authorization': `Bearer ${BEARER_TOKEN.trim()}`
            // }
        })
        try {
            const headers = response.headers; // This is a Headers object
            for (const [key, value] of headers) {
                console.log(`${key}: ${value}`);
            }
            
            console.log('Content-Type is application/json');
            let json = await response.json();
            console.log('Fetched page:', url, '\n', json);
            return json;
            
        }
        catch (e) {
            console.error('Error fetching page:', e);
        }
    }, start, n, LANGUAGE, LOCALE, HEADERS);



    return postResponse;
}

main();