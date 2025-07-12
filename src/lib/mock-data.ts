
import type { Game } from './types';

export const MOCK_GAMES: Game[] = [
  {
    id: 'game-1',
    name: 'Personalized Practice',
    description: 'A dynamic, 5-minute session with varied mini-games to rapidly boost vocabulary from your document.',
    improves: ['Recall', 'Spelling', 'Context'],
    supportedCategories: [], // Empty means it supports ALL categories
    isPlayable: true,
  },
  {
    id: 'game-2',
    name: 'Formula Scramble',
    description: 'Unscramble key formulas and equations from your document. A great way to test your memory of core principles.',
    improves: ['Recall', 'Logic', 'Pattern Recognition'],
    supportedCategories: ["Mathematics", "Science", "Engineering"],
    isPlayable: true,
  },
  {
    id: 'game-3',
    name: 'Spelling Bee',
    description: 'A classic spelling challenge using the key vocabulary from your uploaded document. How many can you get right?',
    improves: ['Spelling', 'Syntax', 'Memory'],
    supportedCategories: ["Computer Science & Coding", "Language Learning & Literature", "Science", "General & Other"],
    isPlayable: true, // This is now playable
  },
  {
    id: 'game-4',
    name: 'Timeline Teaser',
    description: 'Place key events, dates, and figures in the correct chronological order based on your history text.',
    improves: ['Recall', 'Sequencing', 'History'],
    supportedCategories: ["History & Social Science"],
    isPlayable: true,
  },
];
