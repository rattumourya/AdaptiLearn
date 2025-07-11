// src/ai/flows/generate-hint.ts
'use server';
/**
 * @fileOverview A flow to generate a game hint from the context of an uploaded document.
 *
 * - generateHint - A function that generates a hint for a word game based on a document's context.
 * - GenerateHintInput - The input type for the generateHint function.
 * - GenerateHintOutput - The return type for the generateHint function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateHintInputSchema = z.object({
  documentContext: z
    .string()
    .describe('The context of the uploaded document to generate the hint from.'),
  word: z.string().describe('The word the user needs a hint for.'),
});
export type GenerateHintInput = z.infer<typeof GenerateHintInputSchema>;

const GenerateHintOutputSchema = z.object({
  hint: z.string().describe('A hint for the word, based on the document context.'),
});
export type GenerateHintOutput = z.infer<typeof GenerateHintOutputSchema>;

export async function generateHint(input: GenerateHintInput): Promise<GenerateHintOutput> {
  return generateHintFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateHintPrompt',
  input: {schema: GenerateHintInputSchema},
  output: {schema: GenerateHintOutputSchema},
  prompt: `You are a game master providing hints to players of word games based on the context of the document they uploaded.  The user is stuck on the word '{{word}}'.  Provide a hint based on the following document context:

{{documentContext}}

Give a hint without giving away the answer.`,
});

const generateHintFlow = ai.defineFlow(
  {
    name: 'generateHintFlow',
    inputSchema: GenerateHintInputSchema,
    outputSchema: GenerateHintOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
