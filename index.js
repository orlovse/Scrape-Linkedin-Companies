import fs from 'fs';
import csv from 'csv-parser';
import { scrapeLinkedin } from './scrapeLinkedin.js';

const loadedData = [];
fs.createReadStream('../../../Downloads/רשימת לקוחות - רשימת לקוחות.csv')
  .pipe(csv())
  .on('data', (data) => loadedData.push(data))
  .on('end', () => {
    const urlList = loadedData
      .filter((company) => company['לינקדין'].includes('http'))
      .map((company) => ({
        url: company['לינקדין'],
        cardNumber: company['מספר כרטיס'],
      }));

    console.log('Number of links: ', urlList.length);
    scrapeLinkedin(urlList);
  });
