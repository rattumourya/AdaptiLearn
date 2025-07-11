
import type { Game } from './types';

// Document mock data is no longer needed as it's fetched from Firestore.

export const MOCK_GAMES: Game[] = [
  {
    id: 'game-1',
    name: 'Wordscapes',
    description: 'Form words from given letters to fill crossword puzzles. A relaxing classic.',
    improves: ['Vocabulary', 'Spelling'],
  },
  {
    id: 'game-2',
    name: 'QuickLearn Session',
    description: 'A dynamic, 5-minute session with varied mini-games to rapidly boost vocabulary.',
    improves: ['Recall', 'Spelling', 'Visual Learning'],
  },
  {
    id: 'game-3',
    name: 'Word Cookies',
    description: 'Drag-and-drop style game where you form words from jumbled letters.',
    improves: ['Spelling', 'Anagrams'],
  },
  {
    id: 'game-4',
    name: 'Flying Word Adventure',
    description: 'Fly a plane and collect the right letters to spell words. Great for kids!',
    improves: ['Spelling', 'Hand-Eye Coordination'],
  },
    {
    id: 'game-5',
    name: 'Spelling Bee (NYT)',
    description: 'Find as many words as you can from 7 given letters. A daily solo challenge.',
    improves: ['Spelling', 'Vocabulary'],
  },
];
