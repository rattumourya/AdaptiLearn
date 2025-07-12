
'use server';

/**
 * @fileOverview A flow to generate a 5-minute, gamified learning session.
 *
 * - customizeGameDifficulty - A function that handles the game customization process.
 * - CustomizeGameDifficultyInput - The input type for the customizeGameDifficulty function.
 * - CustomizeGameDifficultyOutput - The return type for the customizeGameDifficulty function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input schema remains the same
const CustomizeGameDifficultyInputSchema = z.object({
  documentText: z.string().describe('The text content of the uploaded document.'),
  documentCategory: z.string().describe('The identified category of the document (e.g., Science, Coding, History).'),
  gameType: z.string().describe('The type of game to customize (e.g., QuickLearn Session).'),
  desiredDifficulty: z
    .enum(['easy', 'medium', 'hard'])
    .describe('The desired difficulty level for the game.'),
});
export type CustomizeGameDifficultyInput = z.infer<
  typeof CustomizeGameDifficultyInputSchema
>;


// --- NEW Educational Mini-Game Schemas ---

const WordImageMatchRoundSchema = z.object({
    miniGameType: z.enum(['word-image-match']).describe("The type of this mini-game round."),
    word: z.string().describe("The target word for the player to identify, which matches the image."),
    imageDataUri: z.string().describe("A data URI of the image that correctly represents the word. Format: 'data:image/png;base64,...'"),
    distractorWords: z.array(z.string()).length(3).describe("An array of 3 other words from the document to serve as incorrect options."),
    displayPrompt: z.string().describe("The prompt to show the user, e.g., 'Which word matches the image?'"),
});

const WordTranslationMatchRoundSchema = z.object({
    miniGameType: z.enum(['word-translation-match']).describe("The type of this mini-game round."),
    word: z.string().describe("The target word in the source language (from the document)."),
    correctTranslation: z.string().describe("The correct translation of the word into the native language (assume English)."),
    distractorTranslations: z.array(z.string()).length(3).describe("An array of 3 plausible but incorrect translations."),
    displayPrompt: z.string().describe("The prompt to show the user, e.g., 'What is the correct translation?'"),
});


const SpellingCompletionRoundSchema = z.object({
    miniGameType: z.enum(['spelling-completion']).describe("The type of this mini-game round."),
    word: z.string().describe("The full, correct word."),
    promptWord: z.string().describe("The word with some letters replaced by underscores for the user to fill in (e.g., 'a_p_e')."),
    missingLetters: z.array(z.string()).describe("An array of the correct letters the user needs to drag in."),
    decoyLetters: z.array(z.string()).describe("An array of incorrect letters to act as distractors."),
    displayPrompt: z.string().describe("The prompt to show the user, e.g., 'Complete the spelling.'"),
});

const TraceOrTypeRoundSchema = z.object({
    miniGameType: z.enum(['trace-or-type']).describe("The type of this mini-game round."),
    word: z.string().describe("The word for the user to trace or type."),
    displayPrompt: z.string().describe("The prompt to show the user, e.g., 'Trace the word' or 'Type the word.'"),
});

const TrueFalseChallengeRoundSchema = z.object({
    miniGameType: z.enum(['true-false-challenge']).describe("The type of this mini-game round."),
    word: z.string().describe("The word being tested."),
    statement: z.string().describe("A true or false statement using the word in the context of the document."),
    isCorrect: z.boolean().describe("Whether the statement is true or false."),
    displayPrompt: z.string().describe("The prompt to show the user, e.g., 'True or False?'"),
});

const FormulaScrambleRoundSchema = z.object({
    miniGameType: z.enum(['formula-scramble']).describe("The type of this mini-game round."),
    correctFormula: z.string().describe("The correct, full formula or equation as a string."),
    scrambledParts: z.array(z.string()).describe("An array of the formula's parts, broken up and shuffled."),
    displayPrompt: z.string().describe("The prompt to show the user, e.g., 'Unscramble the formula.'"),
});


// Union schema for all possible game rounds
const GameRoundSchema = z.union([
    WordImageMatchRoundSchema,
    WordTranslationMatchRoundSchema,
    SpellingCompletionRoundSchema,
    TraceOrTypeRoundSchema,
    TrueFalseChallengeRoundSchema,
    FormulaScrambleRoundSchema,
]);

const CustomizeGameDifficultyOutputSchema = z.object({
    gameTitle: z.string().describe('The title for this specific game session.'),
    gameType: z.string().describe('The type of game being played, to be passed to the client.'),
    gameData: z.array(GameRoundSchema).describe('An array of customized mini-game rounds for the session.'),
});

export type CustomizeGameDifficultyOutput = z.infer<
  typeof CustomizeGameDifficultyOutputSchema
>;


export async function customizeGameDifficulty(
  input: CustomizeGameDifficultyInput
): Promise<CustomizeGameDifficultyOutput> {
  return customizeGameDifficultyFlow(input);
}


const generateImageForWord = ai.defineFlow(
    {
        name: 'generateImageForWord',
        inputSchema: z.string(),
        outputSchema: z.string(),
    },
    async (word) => {
        const {media} = await ai.generate({
            model: 'googleai/gemini-2.0-flash-preview-image-generation',
            prompt: `Generate a clean, simple, vector-style image of a "${word}" on a plain white background, suitable for a language learning app. The image should be clear and easily recognizable.`,
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
            },
        });
        return media.url!;
    }
);


const prompt = ai.definePrompt({
  name: 'customizeGameDifficultyPrompt',
  input: {schema: CustomizeGameDifficultyInputSchema},
  output: {schema: CustomizeGameDifficultyOutputSchema},
  prompt: `You are a senior educational game designer. Your task is to create a learning session based on a user's document and chosen game type.

**Document Analysis:**
- Document Category: **{{{documentCategory}}}**
- Document Text: {{{documentText}}}
- Desired Game Type: **{{{gameType}}}**
- Desired Difficulty: **{{{desiredDifficulty}}}**

**Objective:** Generate a list of 10-15 themed, rapid-fire mini-game rounds. The vocabulary, concepts, and complexity must align with the document category, game type, and difficulty.

---

**GAME TYPE RULES:**

*   **If Game Type is "Personalized Practice":**
    *   Generate a good variety of game types (Word-Image, Spelling, True/False, etc.).
    *   Follow the general difficulty and category rules below.

*   **If Game Type is "Formula Scramble":**
    *   **This is the ONLY game type to generate.** The 'gameData' array should only contain 'formula-scramble' rounds.
    *   **Extraction:** Identify 5-10 key formulas or equations from the document.
    *   **Difficulty Scaling for Formulas:**
        *   **Easy:** Use shorter formulas (2-4 parts).
        *   **Medium:** Use formulas with 4-6 parts.
        *   **Hard:** Use longer, more complex formulas (6+ parts) and break them into smaller, trickier pieces.
    *   **Scrambling:** For each formula, break it into its logical components (variables, operators, numbers, functions) and provide these as the 'scrambledParts' array. Ensure the array is shuffled. Example: for "E = mc^2", the parts could be ["E", "=", "m", "c^2"].

---

**GENERAL DIFFICULTY & CATEGORY RULES (for "Personalized Practice"):**

**General Difficulty Scaling:**
-   **Easy:** Use common, shorter words (3-6 letters). Focus on core concepts. Distractors should be obviously different. For spelling, remove only 1-2 vowels.
-   **Medium:** Use moderately complex words (5-9 letters). Combine concepts. Distractors should be plausible. For spelling, remove ~30% of letters (vowels and common consonants).
-   **Hard:** Use longer, complex, or domain-specific terms (8+ letters). Test nuanced relationships between concepts. Distractors should be very similar or conceptually related. For spelling, remove ~50% of letters, including less common consonants.

**Category-Specific Adjustments:**
-   **For "Science" or "Engineering":** Focus on terminology, definitions, and processes. True/False questions should test relationships between concepts (e.g., "Photosynthesis produces carbon dioxide.").
-   **For "History" or "Social Science":** Focus on names, dates, events, and concepts. True/False questions should test factual accuracy.
-   **For "Computer Science & Coding":** Focus on syntax, keywords, function names, and formulas. Spelling/Typing games are very important here. Distractors should include common typos (e.g., 'functoin' vs 'function'). True/False can test logic (e.g., "A 'for' loop is a type of conditional statement.").
-   **For "Language Learning" or "General":** Use a balanced mix of all game types.

---

**INSTRUCTIONS:**

1.  **Analyze and Extract:** Read the document and extract key terms/formulas appropriate for the requested game type, category, and difficulty.
2.  **Generate a Game Title:** Create a fun, encouraging title based on the game type and document (e.g., "Biology Blitz," "Calculus Formula Scramble").
3.  **Create Game Rounds:** Construct an array for 'gameData' following the specific rules for the chosen 'gameType'.

    *   **For Word–Image Match:**
        *   Pick a concrete noun from the vocabulary list.
        *   For 'imageDataUri', provide a placeholder like "IMAGE_FOR_WORD_X" (e.g., "IMAGE_FOR_WORD_Mitochondria"). The system will generate the image.

    *   **For other "Personalized Practice" games:** Follow the general difficulty and category rules.

4.  **Final Output:** Ensure the 'gameType' in the output matches the input 'gameType', and 'gameData' is the array of mini-game rounds you designed.
`,
});

const customizeGameDifficultyFlow = ai.defineFlow(
  {
    name: 'customizeGameDifficultyFlow',
    inputSchema: CustomizeGameDifficultyInputSchema,
    outputSchema: CustomizeGameDifficultyOutputSchema,
  },
  async (input) => {
    let attempts = 0;
    while (attempts < 2) {
      try {
        const {output: structuredOutput} = await prompt(input);
        if (!structuredOutput) throw new Error("AI did not return a structured output.");

        // Asynchronously generate images if needed
        const imageGenerationPromises = structuredOutput.gameData
          .filter(round => round.miniGameType === 'word-image-match' && round.imageDataUri.startsWith('IMAGE_FOR_WORD_'))
          .map(async (round) => {
            if (round.miniGameType === 'word-image-match') {
              const wordToGenerate = round.word;
              round.imageDataUri = await generateImageForWord(wordToGenerate);
            }
          });

        await Promise.all(imageGenerationPromises);
        
        return structuredOutput;

      } catch (error: any) {
        attempts++;
        if (attempts >= 2) {
          console.error("AI call failed after multiple attempts:", error);
          throw new Error("The AI model is currently overloaded. Please try again in a few moments.");
        }
        console.log("AI call failed, retrying...", error.message);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error("Failed to get a response from the AI model.");
  }
);
