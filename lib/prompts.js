//prompts.js
import makeDebug from "debug";
import _ from "lodash";
const debug = makeDebug("playwright-ai");
import util from "node:util";
import child_process from "node:child_process";
import { autoHealAndRerun } from './autoHealer';

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

async function runPlayWright(test) {
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

async function getHTML(endpoint) {
  await delay(1000);
  try {
    const response = await axios.get(endpoint);
    return response.data;
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}





async function startTestSequence(page) {
  const actions = [
      { type: 'click', selector: '#submit-button' },
      { type: 'fill', selector: '#username-input', value: 'user123' },
  ];

  for (let action of actions) {
      await autoHealTest(action.selector, action, page);
  }
}


async function initialPrompt() {
  PROMPTS = {
    start: `As a highly experienced JavaScript developer, you're tasked with creating a series of end-to-end interactive tests using Playwright for a web application. Assume the application's HTML is provided in subsequent messages. Each test should uniquely target different components within the HTML, ensuring no duplication. Your tests should include comprehensive assertions to validate the functionality of each component, leveraging ESM syntax. Import the Playwright interface using "import { test, expect } from '@playwright/test'". Focus on crafting detailed, assertive tests for each identified component, and please return only the test code.`,
    fixTest: `The test you previously wrote has failed. Please revise the assertions or the setup to ensure the test passes. Ensure all necessary corrections are applied and return the complete test script, including the required Playwright import statement.`,
    giveHTML: `Here's the HTML from the endpoint ${process.endpoint}. Please create a detailed Playwright test for the first visible component on the webpage. Make sure the test navigates to the provided URL. Summarize the component briefly using "$$" for its name, and comment your code with the component's snake case identifier. Adjust your interactions based on the component type, such as forms or links.`,
    moreComponents: `Continue creating tests for additional components not previously tested. Possible components include navigation bars, search bars, footer links, or login forms. Briefly name each component within "$$", and annotate your tests with snake case identifiers. Use the same HTML from ${process.endpoint} as your reference.`,
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
        model: model || "gpt-4",
      },
    });
  }

  await askAi(PROMPTS.start, true);
}

async function attemptToGetCodeAndComponent(message, name) {
  let result = extractCode(message);
  if (!result) {
    debug("AI returned matched code, :(");
    if (message.includes("@playwright/test")) {
      result = message;
      debug("Trying direct code mode");
    }
  }
  const code = result;
  const componentName =
    name || extractName(message) || fallbackComponentName(code) || "unknown";
  return {
    code,
    componentName: snakeCase(componentName),
  };
}

async function attemptTestFix(error, componentName) {
  let codeFixResult = await askAi(`${PROMPTS.fixTest} ${error}`);
  let result = await attemptToGetCodeAndComponent(codeFixResult, componentName);
  await writeToFile(componentName, result.code);
  return await runPlayWright(componentName);
}

async function askAi(message, initial) {
  debug(`-----`);
  debug(`>>>> Asking ${conversationId}: ${message}`);
  // send a message and wait for the response
  if (SKIP_AI) {
    debug(`Skipping AI ask: ${message}`);
    return;
  }
  //debug("conversationId", conversationId);
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

// File: lib/prompts.js
async function start(observer, ctx, endpoint, numberOfComponents = 1, enableAutoHeal = false) {
  const html = ctx.html;
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
      testResult = await autoHealAndRerun(result.componentName, ctx.page); // Aquí pasamos el objeto 'page' si es necesario
    }

    if (testResult.code > 0) {
      testsFailed.push(`tests/${result.componentName}.spec.js`);
    } else {
      testsPassing.push(`tests/${result.componentName}.spec.js`);
    }
  }

  ctx.testsPassing = testsPassing;
  ctx.testsFailed = testsFailed;
  observer.complete();
}


export { start, getHTML, initialPrompt };
