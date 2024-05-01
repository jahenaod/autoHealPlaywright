// lib/autoHealer.js
import { runPlayWright, getHTMLFromPage } from './prompts.js';
import fs from 'fs';


async function getSuggestionFromAI(issueDescription, api, conversationId) {
    let prompt = `The test for the following action failed due to a selector issue:\n\n${issueDescription}\n\nBased on best practices in Playwright, please suggest a corrected selector or action.`;
    
    try {
        const response = await api.sendMessage(prompt, {
            parentMessageId: conversationId,
        });
        console.log("AI Suggestion Response:", response.text);
        return response.text;
    } catch (error) {
        console.error("Failed to get suggestion from AI:", error);
        return null;
    }
}

async function autoHealAndRerun(testFile, page) {
    const testResult = await runPlayWright(testFile);
    if (testResult.code !== 0) {
      console.log("Test failed, attempting to auto-heal...");
      const htmlContent = await getHTMLFromPage(page);  // Uso del HTML para entender el contexto del fallo
      const correction = await getSuggestionFromAI(testResult.stderr);
      if (correction && correction.trim() !== '') {
        applyCorrectionToTest(testFile, correction);
        return await runPlayWright(testFile);
      }
    }
    return { success: false, message: "Failed to auto-heal the test." };
  }

function applyCorrectionToTest(testFile, correction) {
    const data = fs.readFileSync(testFile, 'utf8');
    const correctedData = data.replace(/selector: '.*?'/g, `selector: '${correction}'`);
    fs.writeFileSync(testFile, correctedData);
    console.log(`Correction applied to ${testFile}: ${correction}`);
}

export { autoHealAndRerun, getSuggestionFromAI };
