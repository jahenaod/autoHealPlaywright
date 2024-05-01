#!/usr/bin/env node
// index.js
import Listr from "listr";
import yargs from "yargs/yargs";
import { hideBin } from 'yargs/helpers';
import { chromium } from 'playwright'; 
import { initialPrompt, runPlayWright } from './lib/prompts.js';
import { autoHealAndRerun } from "./lib/autoHealer.js";

const argv = yargs(hideBin(process.argv))
  .options({
    testFile: {  //Bien
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
    await initialPrompt(); // Set up AI environment

    const testResult = await runPlayWright(argv.testFile);
    if (testResult.failed && argv.autoHeal) {
      console.log(`Auto-healing is enabled. Attempting to heal ${testResult.failedTests.length} failed tests.`);
      for (const testFile of testResult.failedTests) {
        console.log(`Attempting to auto-heal: ${testFile}`);
        const healedResult = await autoHealAndRerun(testFile, page);
        console.log(`Result for ${testFile}: ${healedResult ? 'Healed' : 'Failed to heal'}`);
      }
    } else {
      console.log("Auto-healing is not enabled or no tests failed.");
    }

    await browser.close();
  })();
