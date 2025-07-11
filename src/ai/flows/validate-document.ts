'use server';

/**
 * @fileOverview A flow to validate document content using AI.
 * - validateDocument - Checks if the text is suitable for creating educational games.
 * - ValidateDocumentInput - Input schema for the validation flow.
 * - ValidateDocumentOutput - Output schema for the validation flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ValidateDocumentInputSchema = z.object({
  documentText: z
    .string()
    .describe('The text content of the document to be validated.'),
});
export type ValidateDocumentInput = z.infer<typeof ValidateDocumentInputSchema>;

const ValidateDocumentOutputSchema = z.object({
  isValid: z
    .boolean()
    .describe(
      'Whether the document content is valid for generating a learning game.'
    ),
  reason: z
    .string()
    .describe(
      'The reason why the document is not valid. Provide a helpful, user-facing explanation. If valid, this should be an empty string.'
    ),
});
export type ValidateDocumentOutput = z.infer<
  typeof ValidateDocumentOutputSchema
>;

export async function validateDocument(
  input: ValidateDocumentInput
): Promise<ValidateDocumentOutput> {
  return validateDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'validateDocumentPrompt',
  input: {schema: ValidateDocumentInputSchema},
  output: {schema: ValidateDocumentOutputSchema},
  prompt: `You are an AI assistant for a language learning app. Your task is to validate document content to ensure it's suitable for creating educational games.

The content should be coherent, primarily text-based, and contain learnable vocabulary. It should not be gibberish, random characters, source code, or inappropriate content.

Analyze the following document text. Determine if it's valid based on these criteria.

Document Text: {{{documentText}}}

If the document is not valid, provide a concise, user-friendly reason. For example: "The document appears to contain code, not learnable text." or "The content is too short or lacks clear vocabulary." If it is valid, the reason should be empty.`,
});

const validateDocumentFlow = ai.defineFlow(
  {
    name: 'validateDocumentFlow',
    inputSchema: ValidateDocumentInputSchema,
    outputSchema: ValidateDocumentOutputSchema,
  },
  async (input) => {
    // Add a basic length check before calling the AI
    if (input.documentText.length < 50) {
        return {
            isValid: false,
            reason: "The document is too short. Please provide at least 50 characters of text."
        }
    }
    const {output} = await prompt(input);
    return output!;
  }
);
