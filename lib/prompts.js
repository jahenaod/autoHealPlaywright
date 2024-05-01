//prompts.js
import makeDebug from "debug";
import _ from "lodash";
const debug = makeDebug("playwright-ai");
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

async function runPlayWright(test) { //No la he modificado
  let stdout, stderr, code, result;
  try {
    result = await exec(`npx playwright test ${test} --reporter=dot`, {
      stdio: ["pipe", "pipe", "ignore"],
    });
    stdout = result.stdout;
    stderr = result.stderr;
    code = result.code;
  } catch (ex) {
    return {
      code: ex.code,
      stdout: ex.stdout,
      stderr: ex.stderr,
    };
  }

  return {
    code: code,
    stdout,
    stderr,
  };
}

let api = null;

const delay = (time) => new Promise((res) => setTimeout(res, time));

let testsFailed = [];
let testsPassing = [];
let conversationId = null;
const SKIP_AI = false;
let PROMPTS = {};

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
      completionParams: {
        model: model || "gpt-3.5-turbo-0613",
      },
    });
  }

  await askAi(PROMPTS.start, true);
}


async function askAi(message, initial) { //Revisar
  debug(`-----`);
  debug(`>>>> Asking ${conversationId}: ${message}`);
  
  if (SKIP_AI) {
    debug(`Skipping AI ask: ${message}`);
    return;
  }

  let res = await api.sendMessage(message, {
    parentMessageId: conversationId,
  });
  if (initial) {
    conversationId = res.id;
  }
  debug("<<<<< AI Response:", res.text);
  debug("------");
  return res.text;
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


export { start, getHTMLFromPage, initialPrompt, runPlayWright};
