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
                // Get the response body as JSON
                const responseBody = await response.json(); //for JSON data
                console.log('API Response:', responseBody);
                // You can then process this responseBody as needed
            } catch (error) {   
                console.error('Error parsing API response:', error);
            }
        }
    }

     // Listen for the 'response' event
    page.on('response', onResponse);
    
    // Navigate the page to a URL.
    await page.goto('https://www.crunchyroll.com/videos/popular', { waitUntil: 'load' });

    await page.screenshot({ path: 'screenshot.png' });
}


async function getAllAnime() {
    
    let total = Number.MAX_SAFE_INTEGER;
    let start = 0;
    let n = 36;

    let allItems = [];

    while (start < total) {
        let pageData = await fetchPage(start, n);
        if( total != pageData?.total ) {
            total = pageData.total;
        }
        let arr = pageData?.data;
        if (!arr || arr.length === 0) {
            break;
        }
        allItems = allItems.concat(arr);
        start += n;
    }

    fs.writeFileSync('all_anime.json', JSON.stringify(allItems, null, 2), 'utf8');

    return allItems;
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