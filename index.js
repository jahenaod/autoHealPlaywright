#!/usr/bin/env node
//index.js
import Listr from "listr";
import yargs from "yargs/yargs";
import { hideBin } from 'yargs/helpers';
import { Observable } from "rxjs";
import { getHTML, initialPrompt, start } from "./lib/prompts.js";
import { autoHealAndRerun } from './lib/autoHealer.js'; 
import { Browser, chromium } from 'playwright'; 

const argv = yargs(hideBin(process.argv))
  .options({
    testFile: {
      type: 'string',
      demandOption: true,
      describe: 'Path to the test file'
    },
    model: {
      alias: 'm',
      describe: 'AI model to use',
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

process.endpoint = argv.endpoint;
process.model = argv.model || "gpt-3.5-turbo";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Usando argv.testFile para obtener la ruta del archivo de test del comando de ejecución
  const result = await autoHealAndRerun(argv.testFile, page);
  console.log("Test execution result:", result);

  await browser.close();
})();


(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  if (argv.autoHeal) {
      const result = await autoHealAndRerun(argv.testFile, page);
      console.log("Auto-healing was enabled. Result:", result);
  } else {
      const result = await runPlayWright(argv.testFile);
      console.log("Auto-healing was not enabled. Result:", result);
  }

  await browser.close();
})();


// Ensuring context is passed to each task
const tasks = new Listr([
  {
    title: "Fetching endpoint...",
    task: ctx => getHTML(argv.endpoint).then(html => ctx.html = html)
  },
  {
    title: "Connecting to AI...",
    task: ctx => initialPrompt()
  },
  {
    title: "Writing tests...",
    task: ctx => new Observable(observer => start(observer, ctx, argv.endpoint, argv.components, argv.autoHeal))
  }
]);


// File: index.js or the main entry point where tasks are run
tasks.run({
  endpoint: argv.endpoint,
  model: argv.model,
  autoHeal: argv.autoHeal
}).then(ctx => {
  console.log("Generated the following tests:");
  ctx.testsPassing.forEach(test => console.log("✔", test));
  ctx.testsFailed.forEach(test => console.log("⚠️", test));
}).catch(err => {
  console.error("Error during task execution:", err);
});
