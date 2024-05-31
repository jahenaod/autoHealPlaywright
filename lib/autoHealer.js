import { runPlayWright, getHTMLFromPage, askAi } from './prompts.js';
import fs from 'fs';
import makeDebug from "debug";

makeDebug.enable('autoheal-playwright');
const debug = makeDebug("autoheal-playwright");

async function getSuggestionFromAI(issueDescription) {
  if (!issueDescription) {
    console.error("No issue description provided to AI.");
    return null;
  }
  let prompt = `The test for the following action failed due to a selector issue:\n\n${issueDescription}\n\nBased on best practices in Playwright, please suggest a corrected selector or action.`;
  console.log("Sending request to AI with prompt:", prompt); 
  const response = await askAi(prompt);
  if (!response) {
    console.error("Failed to get a response from AI.");
    return null;
  }
  console.log("Received AI response:", response); 
  return response;
}

function applyCorrectionToTest(testFile, correction) {
  const data = fs.readFileSync(testFile, 'utf8');
  const correctedData = data.replace(/await page\.getByRole\('button', {name:'.*?'}\)\.click\(\)/g, correction);
  fs.writeFileSync(testFile, correctedData);
  console.log(`Correction applied to ${testFile}: ${correction}`);
}

function extractErrorMessage(stdout) {
  try {
    const result = JSON.parse(stdout);
    console.log(result);
    for (const suite of result.suites) {
      for (const spec of suite.specs) {
        for (const test of spec.tests) {
          if (test.errors && test.errors.length > 0) {
            const error = test.errors[0];
            const location = error.location;
            const locationString = location ? ` at ${location.file}:${location.line}:${location.column}` : '';
            return `${error.message}${locationString}`;
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse stdout:", e);
  }
  return "Error details not provided by Playwright";
}

async function autoHealAndRerun(testFile, page) {
  const testResult = await runPlayWright(testFile);
  if (testResult.failed) {
    console.log("Test failed, attempting to auto-heal...");
    const htmlContent = await getHTMLFromPage(page);
    const errorDescription = extractErrorMessage(testResult.stdout);
    const correction = await getSuggestionFromAI(errorDescription);
    if (correction && correction.trim() !== '') {
      applyCorrectionToTest(testFile, correction);
      return await runPlayWright(testFile);
    }
  }
  return { success: false, message: "Failed to auto-heal the test." };
}

export { autoHealAndRerun, getSuggestionFromAI };
