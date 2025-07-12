
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
    imageOrTranslation: z.string().describe("An image data URI or a translated word to pair with the main word."),
    isCorrectMatch: z.boolean().describe("Whether the word and the image/translation are a correct pair."),
    displayPrompt: z.string().describe("The prompt to show the user, e.g., 'Is this match correct?'"),
});


// Union schema for all possible game rounds
const GameRoundSchema = z.union([
    WordImageMatchRoundSchema,
    WordTranslationMatchRoundSchema,
    SpellingCompletionRoundSchema,
    TraceOrTypeRoundSchema,
    TrueFalseChallengeRoundSchema,
]);

const CustomizeGameDifficultyOutputSchema = z.object({
    gameTitle: z.string().describe('The title for this specific game session.'),
    gameType: z.string().describe('The type of game being played, to be passed to the client.'),
    gameData: z.array(GameRoundSchema).describe('An array of customized mini-game rounds for the 5-minute session.'),
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
  prompt: `You are a senior educational game designer specializing in language acquisition and mobile gamification. Your task is to create an engaging and effective 5-minute learning session based on a user's uploaded document.

Document Text: {{{documentText}}}
Desired Difficulty: {{{desiredDifficulty}}}

**Objective:** Generate a list of 10-15 varied, rapid-fire mini-game rounds. The vocabulary and complexity must match the desired difficulty level.

**Difficulty Scaling Rules:**
- **Easy:** Use common, shorter words (3-6 letters). For spelling games, remove only 1-2 vowels. Distractors should be obviously different.
- **Medium:** Use moderately complex words (5-9 letters). For spelling games, remove ~30% of letters. Distractors should be plausible.
- **Hard:** Use longer, more complex, or less common words (8+ letters). For spelling games, remove ~50% of letters, including consonants. Distractors should be very similar or conceptually related to the correct answer.

**Instructions:**
1.  **Analyze and Extract Vocabulary:** Read the document text and extract a list of 15-20 key vocabulary words appropriate for the requested difficulty level, following the rules above.
2.  **Generate a Game Session Title:** Create a fun, encouraging title for this session (e.g., "Vocabulary Voyage," "Word Power-Up").
3.  **Create a Mixed Array of Game Rounds:** Construct an array for the 'gameData' field. Each element in the array must be an object matching one of the following schemas. Ensure a good variety of game types.

    *   **Word–Image Match (\`WordImageMatchRoundSchema\`):**
        *   **How:** Pick a noun from the vocabulary list to be the correct 'word'. Provide a placeholder value like "IMAGE_FOR_WORD_X" (e.g., "IMAGE_FOR_WORD_apple") for the 'imageDataUri'. The main flow will replace this with a real, AI-generated image.
        *   Select 3 other words from the list to be the 'distractorWords'.

    *   **Word–Translation Match (\`WordTranslationMatchRoundSchema\`):**
        *   **How:** Pick a word. Provide its correct English translation. Create 3 plausible but incorrect 'distractorTranslations'. Assume the user's native language is English.

    *   **Spelling Completion (\`SpellingCompletionRoundSchema\`):**
        *   **How:** Pick a word. Create its 'promptWord' by replacing letters with underscores according to the difficulty rules. List the 'missingLetters' correctly. Provide 3-4 'decoyLetters' that are not in the word.

    *   **Trace or Type (\`TraceOrTypeRoundSchema\`):**
        *   **How:** Pick a moderately complex word from the list suitable for writing practice. This is a simple round.

    *   **True/False Challenge (\`TrueFalseChallengeRoundSchema\`):**
        *   **How:** Pick a word. Pair it with a translation. 50% of the time, the translation should be correct ('isCorrectMatch: true'). 50% of the time, use a translation for a different word from the document ('isCorrectMatch: false'). For 'imageOrTranslation' just provide the translated word.

4.  **Final Output:** Ensure the 'gameType' in the output is set to the input 'gameType', and the 'gameData' is the array of mini-game rounds you designed.
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

        for (const round of structuredOutput.gameData) {
          if (round.miniGameType === 'word-image-match') {
            if (round.imageDataUri.startsWith('IMAGE_FOR_WORD_')) {
              const wordToGenerate = round.word;
              const imageUrl = await generateImageForWord(wordToGenerate);
              round.imageDataUri = imageUrl;
            }
          }
        }
        
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
