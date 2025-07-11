
import type { Game } from './types';

// Document mock data is no longer needed as it's fetched from Firestore.

export const MOCK_GAMES: Game[] = [
  {
    id: 'game-1',
    name: 'Wordscapes',
    description: 'Form words from given letters to fill crossword puzzles. Visually calming and addictive.',
    improves: ['Vocabulary', 'Spelling'],
  },
  {
    id: 'game-2',
    name: 'Drops',
    description: '5-minute daily vocab practice. Uses pictures and swipes to remember words.',
    improves: ['Vocabulary (visual)'],
  },
  {
    id: 'game-3',
    name: 'Word Cookies',
    description: 'Drag-and-drop style game where you form words from jumbled letters.',
    improves: ['Spelling', 'Anagrams'],
  },
  {
    id: 'game-4',
    name: 'Elevate',
    description: 'Daily brain-training with an English focus. Tracks progress over time.',
    improves: ['Grammar', 'Reading', 'Writing'],
  },
    {
    id: 'game-5',
    name: 'Spelling Bee (NYT)',
    description: 'Find as many words as you can from 7 given letters. A daily solo challenge.',
    improves: ['Spelling', 'Vocabulary'],
  },
];
