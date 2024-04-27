// lib/autoHealer.js
import { runPlayWright, getSuggestionFromAI } from './prompts';
import fs from 'fs';

async function autoHealAndRerun(testFile, page) {
    let testResult = await runPlayWright(testFile);

    if (testResult.code !== 0) {
        debug("Test failed, attempting to auto-heal...");
        const issueDescription = `Selector error encountered in test: ${testResult.stderr}`;
        const correction = await getSuggestionFromAI(issueDescription);

        if (correction && correction.trim() !== '') {
            debug("Applying correction suggested by AI:", correction);
            applyCorrectionToTest(testFile, correction);
            testResult = await runPlayWright(testFile); // Re-run the test after applying corrections
        } else {
            debug("No viable correction was suggested by AI.");
        }
    }

    return testResult;
}

function applyCorrectionToTest(testFile, originalSelector, correction) {
    const data = fs.readFileSync(testFile, 'utf8');
    const correctedData = data.replace(new RegExp(`selector: '${originalSelector}'`, 'g'), `selector: '${correction}'`);
    fs.writeFileSync(testFile, correctedData);
    debug(`Correction applied to ${testFile}:`, correction);
}

async function getSuggestionFromAI(issueDescription) {
    let prompt = `The test for the following action failed due to a selector issue:\n\n${issueDescription}\n\nBased on best practices in Playwright, please suggest a corrected selector or action.`;
    
    try {
        const response = await api.sendMessage(prompt, {
            parentMessageId: conversationId,
        });
        debug("AI Suggestion Response:", response.text);
        return response.text;
    } catch (error) {
        console.error("Failed to get suggestion from AI:", error);
        return null;
    }
}
  
  async function autoHealTest(testFile, testResult) {
    console.log("Attempting to auto-heal the test...");
    const correction = await getSuggestionFromAI(testResult);
  
    if (correction && correction.trim() !== '') {
        console.log("AI suggested correction: ", correction);
        const success = applyCorrectionToTest(testFile, correction);
        if (success) {
            testResult = await runPlayWright(testFile); // Re-run the test after applying corrections
        }
    } else {
        console.log("No viable correction was suggested.");
    }
  
    return testResult;
  }
  
export { autoHealAndRerun };
