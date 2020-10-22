import fs from 'fs';
import csv from 'csv-parser';
import { scrapeLinkedin } from './scrapeLinkedin.js';

const loadedData = [];
fs.createReadStream('../../../Downloads/רשימת לקוחות - רשימת לקוחות.csv')
  .pipe(csv())
  .on('data', (data) => loadedData.push(data))
  .on('end', () => {
    const urlList = loadedData
      .map((company) => company['לינקדין'])
      .filter((link) => link.includes('http'));
    console.log(urlList);
    scrapeLinkedin(urlList);
  });
