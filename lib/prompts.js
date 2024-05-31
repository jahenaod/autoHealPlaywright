import makeDebug from "debug";
import util from "node:util";
import child_process from "node:child_process";
import { ChatGPTAPI } from "chatgpt";
import Claude from "../models/claude.js";
import axios from "axios";

const debug = makeDebug("autoheal-playwright");
const exec = util.promisify(child_process.exec);

const axiosInstance = axios.create({
  timeout: 30000, // 30 segundos de timeout
});

let api = null;

const delay = (time) => new Promise((res) => setTimeout(res, time));

const SKIP_AI = false;
let PROMPTS = {};

async function initializeAPI(model) {
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

  if (!api) {
    throw new Error("Failed to initialize AI API");
  }
}

function runPlayWright(test) {
  return exec(`npx playwright test ${test} --reporter=json`).then(result => {
    const { stdout, stderr } = result;
    const resultJson = JSON.parse(stdout);
    const hasErrors = resultJson.stats.unexpected > 0 || stderr.includes("Error");
    if (hasErrors) {
      console.log(`Test ${test} failed with code ${result.code}.`);
      console.error(`stderr: ${stderr}`);
      console.log(`stdout: ${stdout}`);
      console.log(`suites: ${JSON.stringify(resultJson.suites, null, 2)}`);
      return { failed: true, stdout, stderr, resultJson, failedTests: [test] };
    }
    console.log(`Test ${test} passed successfully or completed with undefined status without errors.`);
    return { failed: false, stdout, stderr, resultJson };
  }).catch(error => {
    console.error(`Execution error for test ${test}:`, error);
    return { failed: true, stdout: error.stdout, stderr: error.stderr, error: error, failedTests: [test] };
  });
}

async function getHTMLFromPage(page) {
  try {
    const htmlContent = await page.content();
    return htmlContent;
  } catch (error) {
    console.error(`Failed to extract HTML content: ${error}`);
    return null;
  }
}

async function askAi(message) {
  debug(`-----`);
  debug(`>>>> Asking AI: ${message}`);
  
  if (SKIP_AI) {
    debug(`Skipping AI ask: ${message}`);
    return;
  }

  if (!api) {
    throw new Error("AI API not initialized");
  }

  try {
    let res = await api.sendMessage(message);
    if (!res || typeof res !== 'object') throw new Error("Invalid response from API");

    debug("<<<<< AI Response:", res.text);
    debug("------");
    return res.text;
  } catch (error) {
    debug("Error communicating with AI:", error.message);
    if (error.message.includes('fetch failed')) {
      console.error("Network error occurred while communicating with the AI API. Please check your internet connection and API configuration.");
    }
    return null; // or handle more gracefully depending on your application needs
  }
}

export { getHTMLFromPage, initializeAPI, runPlayWright, askAi };
