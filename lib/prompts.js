//prompts.js class
import makeDebug from "debug";
import _ from "lodash";
const debug = makeDebug("autoheal-playwright");
import util from "node:util";
import child_process from "node:child_process";
import { autoHealAndRerun } from './autoHealer.js';

const exec = util.promisify(child_process.exec);
import { ChatGPTAPI } from "chatgpt";
import writeToFile from "../util/write-to-file.js";
import Claude from "../models/claude.js";
import axios from "axios";
import {
  snakeCase,
  fallbackComponentName,
  extractCode,
  extractName,
} from "./util.js";


const axiosInstance = axios.create({
  timeout: 30000, // 30 segundos de timeout
});

let api = null;

const delay = (time) => new Promise((res) => setTimeout(res, time));

let testsFailed = [];
let testsPassing = [];
let conversationId = null;
const SKIP_AI = false;
let PROMPTS = {};


function runPlayWright(test) {
  return exec(`npx playwright test ${test} --reporter=json`).then(result => {
    const { stdout, stderr, code } = result;
    // Trata solo los casos donde `code` es numérico y diferente de cero como fallos
    const hasErrors = typeof code === 'number' && code !== 0 || stderr.includes("Error");
    if (hasErrors) {
      console.log(`Test ${test} failed with code ${code}.`);
      return { failed: true, stdout, stderr, failedTests: [test] };
    }
    console.log(`Test ${test} passed successfully or completed with undefined status without errors.`);
    return { failed: false, stdout, stderr };
  }).catch(error => {
    console.error(`Execution error for test ${test}:`, error);
    return { failed: true, stdout: error.stdout, stderr: error.stderr, failedTests: [test] };
  });
}






// Utilizes Playwright's page object to extract HTML content of the currently loaded page
async function getHTMLFromPage(page) {
  try {
    const htmlContent = await page.content();
    return htmlContent;
  } catch (error) {
    console.error(`Failed to extract HTML content: ${error}`);
    return null;  // Asegurarse de manejar este null en la lógica de auto-curación
  }
}



async function initialPrompt() {
  PROMPTS = {
    start: `As a test automation engineer I am testing web application using Playwright. I want to heal a test that fails.Propose how to adjust step to fix the test. Use locators in order of preference: semantic locator by text, CSS, XPath. Use codeblocks `,
  };

  let model = process.model;
  if (model === "gpt-3") {
    model = "gpt-3.5-turbo-0613";
  }

  if (model === "claude") {
    api = new Claude({
      apiKey: process.env["ANTHROPIC_API_KEY"],
    });
  } else {
    api = new ChatGPTAPI({
      apiKey: process.env["OPENAI_API_KEY"],
      axiosInstance: axiosInstance
    });
  }

  await askAi(PROMPTS.start, true);
}


async function askAi(message, initial) {
  debug(`-----`);
  debug(`>>>> Asking ${conversationId}: ${message}`);
  
  if (SKIP_AI) {
    debug(`Skipping AI ask: ${message}`);
    return;
  }

  try {
    let res = await api.sendMessage(message, {
      parentMessageId: conversationId,
    });
    if (!res || typeof res !== 'object') throw new Error("Invalid response from API");

    if (initial) {
      conversationId = res.id;
    }
    debug("<<<<< AI Response:", res.text);
    debug("------");
    return res.text;
  } catch (error) {
    debug("Error communicating with AI:", error.message);
    return null; // or handle more gracefully depending on your application needs
  }
}

async function start(observer, ctx, numberOfComponents = 1, enableAutoHeal = true) {
  const html = ctx.html;  //Conserva la funcionalidad inicial
  observer.next("Starting...");
  await delay(1000);

  for (let c = 0; c < numberOfComponents; c++) {
    observer.next(`Working on component ${c + 1}`);
    let ask = `${PROMPTS.giveHTML} ${html}`;

    let result = await attemptToGetCodeAndComponent(await askAi(ask));
    await writeToFile(result.componentName, result.code);
    let testResult = await runPlayWright(result.componentName);

    if (enableAutoHeal && testResult.code > 0) {
      observer.next(`Auto-healing test for component ${c + 1}`);
      testResult = await autoHealAndRerun(result.componentName, ctx.page); 
    }

    if (testResult.code > 0) {
      testsFailed.push(`tests/${result.componentName}.spec.js`);
    } else { //Funcionalidad inicial
      testsPassing.push(`tests/${result.componentName}.spec.js`);
    }
  }

  ctx.testsPassing = testsPassing;
  ctx.testsFailed = testsFailed;
  observer.complete();
}


export { start, getHTMLFromPage, initialPrompt, runPlayWright, askAi};
