'use server';

/**
 * @fileOverview A flow to analyze and categorize document content.
 * - categorizeDocument - Classifies the text into a predefined subject category.
 * - CategorizeDocumentInput - Input schema for the categorization flow.
 * - CategorizeDocumentOutput - Output schema for the categorization flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DocumentCategoryEnum = z.enum([
    "Science",
    "History & Social Science",
    "Mathematics",
    "Computer Science & Coding",
    "Engineering",
    "Language Learning & Literature",
    "General & Other"
]);

const CategorizeDocumentInputSchema = z.object({
  documentText: z
    .string()
    .describe('The text content of the document to be categorized.'),
});
export type CategorizeDocumentInput = z.infer<typeof CategorizeDocumentInputSchema>;

const CategorizeDocumentOutputSchema = z.object({
  category: DocumentCategoryEnum.describe(
      'The most likely category for the document content.'
    ),
});
export type CategorizeDocumentOutput = z.infer<
  typeof CategorizeDocumentOutputSchema
>;

export async function categorizeDocument(
  input: CategorizeDocumentInput
): Promise<CategorizeDocumentOutput> {
  return categorizeDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeDocumentPrompt',
  input: {schema: CategorizeDocumentInputSchema},
  output: {schema: CategorizeDocumentOutputSchema},
  prompt: `You are an expert librarian AI. Your task is to analyze the provided text and classify it into one of the following categories. Choose the single best fit.

Categories:
- Science (Biology, Chemistry, Physics, etc.)
- History & Social Science (Politics, Sociology, etc.)
- Mathematics
- Computer Science & Coding (Programming, Algorithms, Software, etc.)
- Engineering (Mechanical, Electrical, Civil, etc.)
- Language Learning & Literature (Fiction, Poetry, Grammar, etc.)
- General & Other (News articles, miscellaneous topics, etc.)

Analyze the following document text and determine its primary category.

Document Text (first 1000 characters): {{{documentText}}}`,
});

const categorizeDocumentFlow = ai.defineFlow(
  {
    name: 'categorizeDocumentFlow',
    inputSchema: CategorizeDocumentInputSchema,
    outputSchema: CategorizeDocumentOutputSchema,
  },
  async (input) => {
    // Truncate the text to save on tokens and processing time for categorization.
    const truncatedText = input.documentText.substring(0, 4000);
    const {output} = await prompt({ documentText: truncatedText });
    return output!;
  }
);

    