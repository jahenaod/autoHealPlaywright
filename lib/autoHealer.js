// autoHealer.js
import { runPlayWright, getHTMLFromPage, askAi } from './prompts.js';
import fs from 'fs';
import makeDebug from "debug";

makeDebug.enable('autoheal-playwright');
const debug = makeDebug("autoheal-playwright");

async function getSuggestionFromAI(issueDescription, conversationId) {
  if (!issueDescription) {
      console.error("No issue description provided to AI.");
      return null;
  }
  let prompt = `The test for the following action failed due to a selector issue:\n\n${issueDescription}\n\nBased on best practices in Playwright, please suggest a corrected selector or action.`;
  console.log("Sending request to AI with prompt:", prompt); // Para ver qué se está enviando
  const response = await askAi(prompt, false);
  console.log("Received AI response:", response); // Para confirmar la respuesta recibida
  return response;
}

function applyCorrectionToTest(testFile, correction) {
  const data = fs.readFileSync(testFile, 'utf8');
  const correctedData = data.replace(/selector: '.*?'/g, `selector: '${correction}'`);
  fs.writeFileSync(testFile, correctedData);
  console.log(`Correction applied to ${testFile}: ${correction}`);
}

async function autoHealAndRerun(testFile, page, conversationId) {
  const testResult = await runPlayWright(testFile);
  if (testResult.failed) {
      console.log("Test failed, attempting to auto-heal...");
      const htmlContent = await getHTMLFromPage(page);
      // Asegúrate de que se pasa el error o descripción correcta del fallo
      const errorDescription = testResult.stderr || "Error details not provided by Playwright";
      const correction = await getSuggestionFromAI(errorDescription, conversationId);
      if (correction && correction.trim() !== '') {
          applyCorrectionToTest(testFile, correction);
          return await runPlayWright(testFile);
      }
  }
  return { success: false, message: "Failed to auto-heal the test." };
}



export { autoHealAndRerun, getSuggestionFromAI };
