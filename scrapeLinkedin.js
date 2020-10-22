import puppeteer from 'puppeteer';
import fs from 'fs';

export const scrapeLinkedin = async (
  urlList = [],
  userName = '',
  userPassword = '',
  showBrowser = false,
  saveDirectory = './result.json'
) => {
  const browser = await puppeteer.launch({ headless: showBrowser });
  const page = await browser.newPage();
  await page.goto('https://www.linkedin.com/login');
  const inputUser = '#username';
  const inputPass = '#password';
  await page.waitForSelector(inputUser);
  await page.waitForSelector(inputUser);
  await page.type(inputUser, userName);
  await page.type(inputPass, userPassword);
  await page.waitForTimeout(1500);
  await page.click('div.login__form_action_container button');
  await page.waitForTimeout(1500);

  let result = [];
  await (async () => {
    for await (let url of urlList) {
      try {
        if (!url.includes('about')) url = url + '/about';

        await page.goto(url);
        await page.waitForTimeout(2000);
        const company = await page
          .evaluate(() => {
            let aboutCompanyTable = document.querySelector('dl')
              ? document.querySelector('dl').innerText || 'none'
              : 'none';
            let companyName = document.querySelector('section h1 span')
              ? document.querySelector('section h1 span').innerText || 'none'
              : 'none';
            const arrFromTable = aboutCompanyTable.split('\n');
            let website = 'none';
            let numEmployees = 'none';
            if (arrFromTable.includes('Website'))
              website = arrFromTable[arrFromTable.indexOf('Website') + 1];
            if (arrFromTable.includes('Company size'))
              numEmployees =
                arrFromTable[arrFromTable.indexOf('Company size') + 1];

            return {
              companyName: companyName,
              website: website,
              numEmployees: numEmployees,
            };
          })
          .catch((e) => console.dir(e));
        company ? result.push(company) : console.log('error company');
        fs.appendFileSync(saveDirectory, JSON.stringify(company), (error) => {
          if (error) console.log('Error writing to file', error);
        });

        const separator = ';';
        const hebrew = '\uFEFF';

        fs.appendFileSync(
          './result.csv',
          `${hebrew}${company.companyName}${separator}${company.website}${separator}${company.numEmployees}\n`,
          (error) => {
            if (error) console.log('Error writing to file', error);
          }
        );
      } catch {
        console.log('error from loop');
      }
    }
  })();

  browser.close();
  return result;
};
