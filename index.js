import yargs from "yargs/yargs";
import { hideBin } from 'yargs/helpers';
import { chromium } from 'playwright'; 
import { initializeAPI, runPlayWright } from './lib/prompts.js';
import { autoHealAndRerun } from "./lib/autoHealer.js";

const argv = yargs(hideBin(process.argv))
  .options({
    testFile: {
      type: 'string',
      demandOption: true,
      describe: 'Path to the test file where the Playwright tests are defined'
    },
    model: {
      alias: 'm',
      describe: 'AI model to use for generating suggestions',
      default: 'gpt-3.5-turbo',
      type: 'string'
    },
    autoHeal: {
      alias: 'a',
      type: 'boolean',
      describe: 'Enable auto-healing feature',
      default: true
    }
  })
  .help()
  .argv;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await initializeAPI(argv.model); 

  const testResult = await runPlayWright(argv.testFile);
  if (testResult.failed && argv.autoHeal) {
    console.log(`Auto-healing is enabled. Attempting to heal ${testResult.failedTests.length} failed tests.`);
    for (const testFile of testResult.failedTests) {
      console.log(`Attempting to auto-heal: ${testFile}`);
      const healedResult = await autoHealAndRerun(testFile, page);
      console.log(`Result for ${testFile}: ${healedResult.success ? 'Healed' : 'Failed to heal'}`);
    }
  } else {
    console.log("No failed tests or auto-healing is not enabled.");
  }

  await browser.close();
})();
