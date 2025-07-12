
import type { Game } from './types';

// Document mock data is no longer needed as it's fetched from Firestore.

export const MOCK_GAMES: Game[] = [
  {
    id: 'game-1',
    name: 'Personalized Practice',
    description: 'A dynamic, 5-minute session with varied mini-games to rapidly boost vocabulary from your document.',
    improves: ['Recall', 'Spelling', 'Context'],
    supportedCategories: [], // Empty means it supports ALL categories
  },
  {
    id: 'game-2',
    name: 'Formula Scramble',
    description: 'Unscramble key formulas and equations from your document. A great way to test your memory of core principles.',
    improves: ['Recall', 'Logic', 'Pattern Recognition'],
    supportedCategories: ["Mathematics", "Science", "Engineering"],
  },
  {
    id: 'game-3',
    name: 'Code Completion Challenge',
    description: 'Type the missing pieces of code snippets taken directly from your notes or files. Perfect for syntax practice.',
    improves: ['Spelling', 'Syntax', 'Memory'],
    supportedCategories: ["Computer Science & Coding"],
  },
  {
    id: 'game-4',
    name: 'Timeline Teaser',
    description: 'Place key events, dates, and figures in the correct chronological order based on your history text.',
    improves: ['Recall', 'Sequencing', 'History'],
    supportedCategories: ["History & Social Science"],
  },
];

    