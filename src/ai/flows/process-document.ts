// src/ai/flows/process-document.ts
'use server';

/**
 * @fileOverview Extracts key vocabulary from uploaded documents for game personalization.
 *
 * - processDocument - Analyzes document text to identify and extract key vocabulary.
 * - ProcessDocumentInput - The input type for the processDocument function.
 * - ProcessDocumentOutput - The return type for the processDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProcessDocumentInputSchema = z.object({
  documentText: z
    .string()
    .describe('The text content of the document to be analyzed.'),
});
export type ProcessDocumentInput = z.infer<typeof ProcessDocumentInputSchema>;

const ProcessDocumentOutputSchema = z.object({
  vocabularyList: z
    .array(z.string())
    .describe('A list of key vocabulary words extracted from the document.'),
});
export type ProcessDocumentOutput = z.infer<typeof ProcessDocumentOutputSchema>;

export async function processDocument(input: ProcessDocumentInput): Promise<ProcessDocumentOutput> {
  return processDocumentFlow(input);
}

const extractVocabularyPrompt = ai.definePrompt({
  name: 'extractVocabularyPrompt',
  input: {schema: ProcessDocumentInputSchema},
  output: {schema: ProcessDocumentOutputSchema},
  prompt: `You are an expert vocabulary extractor. Please analyze the given document text and identify key vocabulary words that are most relevant and useful for language learning games. Return a list of these words.

Document Text: {{{documentText}}}`,
});

const processDocumentFlow = ai.defineFlow(
  {
    name: 'processDocumentFlow',
    inputSchema: ProcessDocumentInputSchema,
    outputSchema: ProcessDocumentOutputSchema,
  },
  async (input) => {
    let attempts = 0;
    while (attempts < 2) {
      try {
        const {output} = await extractVocabularyPrompt(input);
        return output!;
      } catch (error: any) {
        attempts++;
        if (attempts >= 2) {
          console.error("AI call failed after multiple attempts:", error);
          throw new Error("The AI model is currently overloaded. Please try again in a few moments.");
        }
        console.log("AI call failed, retrying...", error.message);
        // Wait for a second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
     // This part should be unreachable, but it satisfies TypeScript's need for a return path.
    throw new Error("Failed to get a response from the AI model.");
  }
);
