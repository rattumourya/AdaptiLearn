
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
  gameType: z.string().describe('The type of game to customize (e.g., Personalized Practice).'),
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

const TimelineTeaserRoundSchema = z.object({
    miniGameType: z.enum(['timeline-teaser']).describe("The type of this mini-game round."),
    correctOrder: z.array(z.string()).describe("An array of events or items in the correct chronological order."),
    scrambledOrder: z.array(z.string()).describe("An array of the same events, but shuffled, for the user to sort."),
    displayPrompt: z.string().describe("The prompt to show the user, e.g., 'Arrange the events in the correct order.'"),
});


// Union schema for all possible game rounds
const GameRoundSchema = z.union([
    WordImageMatchRoundSchema,
    WordTranslationMatchRoundSchema,
    SpellingCompletionRoundSchema,
    TraceOrTypeRoundSchema,
    TrueFalseChallengeRoundSchema,
    FormulaScrambleRoundSchema,
    TimelineTeaserRoundSchema,
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
            prompt: `Generate a vibrant, clean, flat illustration of "${word}", suitable for a modern educational app. The image should be clear, easily recognizable, and visually engaging.`,
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
  prompt: `You are a master educational game designer, creating a fun, 5-minute learning session based on a user's document.

**INPUT:**
- Document Category: **{{{documentCategory}}}**
- Document Text (first 4000 chars): {{{documentText}}}
- Requested Game Type: **{{{gameType}}}**
- Desired Difficulty: **{{{desiredDifficulty}}}**

**PRIMARY OBJECTIVE:** Generate a list of 5-10 varied, engaging mini-game rounds. The vocabulary, concepts, and complexity MUST align with the document's category, the requested game type, and the desired difficulty.

---

**GAME TYPE RULES (Most Important):**

*   **If Game Type is "Personalized Practice":**
    *   This is a mixed-modality session. Generate a good variety of game types (Word-Image, Spelling, True/False, etc.) based on the category and difficulty rules below.
    *   Prioritize variety to keep the user engaged.

*   **If Game Type is "Formula Scramble":**
    *   **THIS IS THE ONLY GAME TYPE TO GENERATE.** The 'gameData' array should **only** contain 'formula-scramble' rounds.
    *   **Extraction:** Identify 5-10 key formulas or equations from the document.
    *   **Difficulty Scaling:**
        *   **Easy:** Short formulas (2-4 parts).
        *   **Medium:** Formulas with 4-6 parts.
        *   **Hard:** Longer, more complex formulas (6+ parts), broken into smaller, trickier pieces.
    *   **Scrambling:** Break each formula into its logical components (variables, operators, numbers, functions) and provide them shuffled in the 'scrambledParts' array.

*   **If Game Type is "Timeline Teaser":**
    *   **THIS IS THE ONLY GAME TYPE TO GENERATE.** The 'gameData' array should **only** contain 'timeline-teaser' rounds.
    *   **Extraction:** Identify 5-10 sets of historical events, figures, or process steps from the document with a clear chronological order.
    *   **Difficulty Scaling:**
        *   **Easy:** 3-4 widely separated items (e.g., "Stone Age", "Roman Empire", "World War II").
        *   **Medium:** 4-5 items requiring more specific knowledge (e.g., key battles in one war).
        *   **Hard:** 5-6 nuanced, conceptually similar, or closely timed items.

---

**GENERAL DIFFICULTY & CATEGORY RULES (for "Personalized Practice"):**

**1. General Difficulty Scaling (Across all games):**
*   **Easy:** Use common, shorter words (3-6 letters). Focus on core concepts. Distractors should be obviously different.
*   **Medium:** Use moderately complex words (5-9 letters). Combine concepts. Distractors should be plausible.
*   **Hard:** Use long, complex, domain-specific terms (8+ letters). Test nuanced relationships. Distractors should be very similar or conceptually related.

**2. Category-Specific Game Generation (BE CREATIVE!):**
*   **For "Science" or "Engineering":**
    *   Generate \`True/False\` questions testing relationships (e.g., "True or False: Photosynthesis produces carbon dioxide.").
    *   Prioritize \`Spelling Completion\` and \`Trace-or-Type\` for key terminology.
    *   \`Word-Image Match\` is great for physical objects (e.g., a cell, a tool).
*   **For "History & Social Science":**
    *   Generate \`True/False\` questions testing factual accuracy about events or figures.
    *   Could you create a \`True/False\` prompt like "Who am I? I was the 16th president of the USA. My name is George Washington." (Answer: False). This is more engaging.
    *   \`Word Translation Match\` could be used for key terms and their simple definitions.
*   **For "Computer Science & Coding":**
    *   Prioritize \`Spelling Completion\` and \`Trace-or-Type\` for syntax, keywords, and function names.
    *   \`True/False\` can test logic (e.g., "A 'for' loop is a type of conditional statement.").
    *   For \`Spelling Completion\`, make "Hard" mode include special characters like underscores or brackets.
*   **For "Language Learning & Literature" or "General":**
    *   Use a balanced mix of all available game types. \`Word Translation Match\` and \`Word-Image Match\` are particularly effective here.

**3. Specific Mini-Game Mechanics:**
*   **For \`Spelling Completion\`:**
    *   **Easy:** Create \`promptWord\` by removing 1-2 vowels.
    *   **Medium:** Remove ~30% of letters (vowels and common consonants).
    *   **Hard:** Remove ~50% of letters, including less common consonants or symbols for coding.
    *   \`missingLetters\` should contain the correct removed letters. \`decoyLetters\` should contain plausible but incorrect letters.
*   **For \`Word-Image Match\`:**
    *   Pick a concrete noun. The system will handle image generation. Just provide the placeholder \`imageDataUri: "IMAGE_FOR_WORD_YourWord"\`.

---

**FINAL INSTRUCTIONS:**

1.  **Generate a Game Title:** Create a fun, encouraging title (e.g., "Biology Blitz," "Calculus Scramble", "Revolution Timeline").
2.  **Construct \`gameData\` Array:** Build the array of mini-game rounds following all rules above.
3.  **Ensure Output Matches Request:** The \`gameType\` in your output must match the requested \`gameType\`.
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
        const {output: structuredOutput} = await prompt({
            ...input,
            documentText: input.documentText.substring(0, 4000) // Truncate text for performance
        });
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
