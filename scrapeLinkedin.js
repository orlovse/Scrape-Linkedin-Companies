import puppeteer from 'puppeteer';
import fs from 'fs';

const login = async (page, userName, userPassword, timeout) => {
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
};

const scrapeCompany = async (page) =>
  await page
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
        numEmployees = arrFromTable[
          arrFromTable.indexOf('Company size') + 1
        ].split(' ')[0];

      return {
        companyName,
        website,
        numEmployees,
      };
    })
    .catch((e) => console.dir(e));

const scrapeFounders = async (page) =>
  await page
    .evaluate(() => {
      let employeeArr = [
        ...document.querySelectorAll('ul.search-results__list>li'),
      ];
      const founders = employeeArr.filter(
        (employee) =>
          employee.innerText.includes('CEO') ||
          employee.innerText.includes('CFO') ||
          employee.innerText.includes('COO') ||
          employee.innerText.includes('HR') ||
          employee.innerText.includes('General manager') ||
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

const scrapeFounderInfo = async (page) =>
  await page
    .evaluate(() => {
      let infoArr = document.querySelectorAll('.section-info>section')
        ? [...document.querySelectorAll('.section-info>section')]
        : [];

      // const separator = ';';
      const result = { profile: '', phone: '', email: '' };

      if (infoArr.length !== 0) {
        infoArr.map((info) => {
          // const title = info.innerText;
          const title = info.innerText.split('\n')[0];
          const value = info.innerText.split('\n')[1];
          if (title.includes('Profile')) result.profile = value;
          if (title.includes('Phone')) result.phone = value;
          if (title.includes('Email')) result.email = value;
        });
      }

      return result;
    })
    .catch((e) => console.log('error from scrapeFounderInfo', e));

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
  //open browser
  const browser = await puppeteer.launch({ headless: showBrowser });
  const page = await browser.newPage();

  //login
  await login(page, userName, userPassword, timeout);

  const result = [];
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
        const company = await scrapeCompany(page);

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
        const founders = await scrapeFounders(page);
        const contacts = [];
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

              const contact = {};

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
                contact.name = nameAndCompany.name;
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
              const { profile, email, phone } = await scrapeFounderInfo(page);

              //add founder info to row
              row =
                row +
                separator +
                profile +
                separator +
                email +
                separator +
                phone;

              contact.profile = profile;
              contact.email = email;
              contact.phone = phone;

              contacts.push(contact);
            }
          }

        company.contacts = contacts;
        result.push(company);

        //add row to .csv
        fs.appendFileSync(saveDirectory, row + '\n', (error) => {
          if (error) console.log('Error writing to file', error);
        });
      } catch {
        console.log('error from loop');
      }
    }
  })();

  fs.appendFileSync('./result.json', JSON.stringify(result), (error) => {
    if (error) console.log('Error writing to file', error);
  });

  browser.close();
};
