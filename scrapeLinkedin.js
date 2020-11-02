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
        ? document.querySelector('dl').innerText || ''
        : '';
      let companyName = document.querySelector('section h1 span')
        ? document.querySelector('section h1 span').innerText || ''
        : '';

      const arrFromTable = aboutCompanyTable.split('\n');
      let website = '';
      let numEmployees = '';
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
    .evaluate(async () => {
      let employeeArr = [
        ...document.querySelectorAll('ul.search-results__list>li'),
      ];

      const founders = employeeArr.filter(
        (employee) =>
          employee.innerText.toLowerCase().includes('israel') &&
          !employee.innerText.toLowerCase().includes('looking for') &&
          !employee.innerText.toLowerCase().includes('seeking') &&
          !employee.innerText.toLowerCase().includes('deputy') &&
          !employee.innerText.toLowerCase().includes('personal assistant') &&
          !employee.innerText.toLowerCase().includes('assistant') &&
          (employee.innerText.toLowerCase().includes('ceo') ||
            employee.innerText
              .toLowerCase()
              .includes('chief executive officer') ||
            employee.innerText
              .toLowerCase()
              .includes('chief financial officer') ||
            employee.innerText
              .toLowerCase()
              .includes('chief operating officer') ||
            employee.innerText.toLowerCase().includes('human resources') ||
            employee.innerText.toLowerCase().includes('c.e.o') ||
            employee.innerText.toLowerCase().includes('co-founder') ||
            employee.innerText.toLowerCase().includes('cfo') ||
            employee.innerText.toLowerCase().includes('coo') ||
            employee.innerText.toLowerCase().includes('hr') ||
            employee.innerText.toLowerCase().includes('vp operations') ||
            employee.innerText.toLowerCase().includes('site manager') ||
            employee.innerText.toLowerCase().includes('general manager') ||
            employee.innerText.toLowerCase().includes('gm') ||
            employee.innerText.toLowerCase().includes('founder') ||
            employee.innerText.toLowerCase().includes('partner'))
      );

      const result = [];
      if (founders)
        founders.map((founder) => {
          const link = founder.querySelector('a').getAttribute('href');
          result.push(link);
        });

      return result;
    })
    .catch((e) => console.log(e));

const scrapeFounderInfo = async (page) =>
  await page
    .evaluate(() => {
      let infoArr = document.querySelectorAll('.section-info>section')
        ? [...document.querySelectorAll('.section-info>section')]
        : [];

      const result = { profile: '', email: '', phone: '' };

      if (infoArr.length !== 0) {
        infoArr.map((info) => {
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

const goToPage = async (page, pageNumber) => {
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    [...buttons].map(async (link) => {
      if (link.innerText === pageNumber) {
        await link.click();
      }
    });
  });
};

const scrollToBottom = async (page) => {
  await page.waitForTimeout(timeout);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(timeout);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(timeout);
};

export const scrapeLinkedin = async (
  urlList = [],
  userName = '',
  userPassword = '',
  dontShowBrowser = false,
  saveDirectory = './result.csv',
  timeout = 3000,
  separator = ';',
  hebrew = '\uFEFF'
) => {
  //open browser
  const browser = await puppeteer.launch({
    headless: dontShowBrowser,
    args: ['--start-maximized'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  //login
  await login(page, userName, userPassword, timeout);

  //result to write to result.json
  const result = [];

  //loop on array links from params
  await (async () => {
    for await (let { url, cardNumber } of urlList) {
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
            cardNumber +
            separator +
            hebrew +
            company.companyName +
            separator +
            url +
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
        await page.evaluate(() => {
          const allEmployeesLink = document.querySelectorAll(
            'a[href^="/search/results/people"]'
          );
          [...allEmployeesLink].map(async (link) => {
            if (link.innerText.includes('See all')) {
              await link.click();
            }
          });
        });

        //scroll down to pagination
        await page.waitForTimeout(timeout);
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(timeout);
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(timeout);

        //does pagination exist
        const isPagination = await page.$('ul>li>button');

        //scrape founders
        let founders = await scrapeFounders(page);
        let foundersPage2 = '';
        let foundersPage3 = '';

        //if pagination exist go to pages 2 and 3
        if (isPagination) {
          await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            [...buttons].map(async (link) => {
              if (link.innerText === '2') {
                await link.click();
              }
            });
          });
          await page
            .waitForTimeout(timeout)
            .then(() => console.log('timeout2'));
          await page.keyboard.press('PageDown');
          await page
            .waitForTimeout(timeout)
            .then(() => console.log('timeout2'));
          await page.keyboard.press('PageDown');
          await page.waitForSelector('ul>li>button');
          foundersPage2 = await scrapeFounders(page);

          await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            [...buttons].map(async (link) => {
              if (link.innerText === '3') {
                await link.click();
              }
            });
          });
          await page
            .waitForTimeout(timeout)
            .then(() => console.log('timeout2'));
          await page.keyboard.press('PageDown');
          await page
            .waitForTimeout(timeout)
            .then(() => console.log('timeout2'));
          await page.keyboard.press('PageDown');
          await page.waitForSelector('ul>li>button');
          foundersPage3 = await scrapeFounders(page);
        }

        await page.waitForTimeout(timeout).then(() => console.log('timeout2'));
        founders = [...founders, ...foundersPage2, ...foundersPage3];

        //contacts to add to result object
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

              //contact to push to contacts array
              const contact = {};

              // row to write to contactsToApollo.csv
              let contactRow = '';

              //find founder name and company
              const nameAndCompany = await page
                .evaluate(() => {
                  let name = document.querySelector('section>div>div>div>ul>li')
                    ? document.querySelector('section>div>div>div>ul>li')
                        .innerText
                    : '';

                  let position = document.querySelector(
                    'section>div>div>div>h2'
                  )
                    ? document.querySelector('section>div>div>div>h2').innerText
                    : '';

                  if (position.includes('at'))
                    position = position.split('at')[0];

                  return {
                    name,
                    position,
                  };
                })
                .catch((e) => console.dir(e));

              //add founder name to row
              if (nameAndCompany) {
                const { name, position } = nameAndCompany;
                contact.name = name;
                contact.position = position;
                row = row + separator + name + separator + position;

                const separator2 = ',';
                contactRow =
                  contactRow +
                  name.split(' ')[0] +
                  separator2 +
                  name.split(' ')[1] +
                  separator2 +
                  row.split(separator)[2];
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

              const separator3 = ',';
              contactRow =
                contactRow + separator3 + profile + separator3 + email;

              contact.profile = profile;
              contact.email = email;
              contact.phone = phone;

              contacts.push(contact);

              //add contactRow to contactsToApollo.csv
              if (contactRow) {
                fs.appendFileSync(
                  './contactsToApollo.csv',
                  contactRow + '\n',
                  (error) => {
                    if (error) console.log('Error writing to file', error);
                  }
                );
              }
            }
          }

        company.cardNumber = cardNumber;
        company.linkdin = url;
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
