import puppeteer from 'puppeteer';
import fs from 'fs';

export const scrapeLinkedin = async (
  urlList = [],
  userName = '',
  userPassword = '',
  showBrowser = false,
  saveDirectory = './result.csv',
  timeout = 1500,
  separator = ';',
  hebrew = '\uFEFF'
) => {
  //login
  const browser = await puppeteer.launch({ headless: showBrowser });
  const page = await browser.newPage();
  await page.goto('https://www.linkedin.com/login');
  const inputUser = '#username';
  const inputPass = '#password';
  await page.waitForSelector(inputUser);
  await page.waitForSelector(inputUser);
  await page.type(inputUser, userName);
  await page.type(inputPass, userPassword);
  await page.waitForTimeout(timeout);
  await page.click('div.login__form_action_container button');
  await page.waitForTimeout(timeout);

  //loop on array links from params
  await (async () => {
    for await (let url of urlList) {
      try {
        if (!url.includes('about')) url = url + '/about';

        await page.goto(url);
        await page.waitForSelector('section');
        await page.waitForTimeout(timeout).then(() => console.log('timeout'));

        //row to write to .csv
        let row = '';

        //scrape company from page
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
              companyName,
              website,
              numEmployees,
            };
          })
          .catch((e) => console.dir(e));

        //add company to row
        if (company) {
          row =
            hebrew +
            company.companyName +
            separator +
            company.website +
            separator +
            company.numEmployees;
        } else {
          console.log('Company error');
        }

        //remove Messaging from page
        await page.evaluate(() => {
          document.querySelector('#msg-overlay').remove();
        });

        //go to employees page
        await page.click('a[href^="/search/results/people"]');
        await page.waitForSelector('ul');
        await page.waitForTimeout(timeout).then(() => console.log('timeout2'));

        //find founders
        const founders = await page
          .evaluate(() => {
            let employeeArr = [
              ...document.querySelectorAll('ul.search-results__list>li'),
            ];
            const founders = employeeArr.filter(
              (employee) =>
                employee.innerText.includes('CEO') ||
                employee.innerText.includes('Founder') ||
                employee.innerText.includes('Partner')
            );

            const result = [];
            if (founders)
              founders.map((founder) => {
                const link = founder.querySelector('a').getAttribute('href');
                result.push(link);
              });

            return result;
          })
          .catch((e) => console.dir(e));

        console.log('founders', founders);

        //go to founders pages
        if (founders.length !== 0)
          for await (let link of founders) {
            if (link.includes('in')) {
              await page.goto('https://www.linkedin.com' + link);
              await page.waitForSelector('ul li');
              await page
                .waitForTimeout(timeout)
                .then(() => console.log('timeout3'));

              //find founder name and company
              const nameAndCompany = await page
                .evaluate(() => {
                  let name = document.querySelector('section>div>div>div>ul>li')
                    ? document.querySelector('section>div>div>div>ul>li')
                        .innerText
                    : 'none';

                  let company = document.querySelector('section>div>div>div>h2')
                    ? document.querySelector('section>div>div>div>h2').innerText
                    : 'none';

                  return {
                    name,
                    company,
                  };
                })
                .catch((e) => console.dir(e));

              //add founder name to row
              if (nameAndCompany) {
                row =
                  row +
                  separator +
                  nameAndCompany.name +
                  separator +
                  nameAndCompany.company;
              } else {
                console.log('error from nameAndCompany');
              }

              //open founder info
              await page.click('a[href$="/contact-info/"]');
              await page.waitForSelector('.section-info');
              await page
                .waitForTimeout(timeout)
                .then(() => console.log('timeout4'));

              //scrape founder info
              const info = await page
                .evaluate(() => {
                  const separator = ';';

                  let infoArr = document.querySelectorAll(
                    '.section-info>section'
                  )
                    ? [...document.querySelectorAll('.section-info>section')]
                    : [];

                  const info =
                    infoArr.length !== 0
                      ? infoArr.reduce(
                          (acc, infoEl) =>
                            acc +
                            infoEl.innerText.replace(/\n+/g, ' ') +
                            separator,
                          ''
                        )
                      : null;

                  return separator + info;
                })
                .catch((e) => console.dir(e));

              //add founder info to row
              row = row + info;
            }
          }

        //add row to .csv
        fs.appendFileSync(saveDirectory, row + '\n', (error) => {
          if (error) console.log('Error writing to file', error);
        });
      } catch {
        console.log('error from loop');
      }
    }
  })();

  browser.close();
};
