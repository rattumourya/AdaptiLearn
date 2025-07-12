
import type { Game } from './types';

// Document mock data is no longer needed as it's fetched from Firestore.

export const MOCK_GAMES: Game[] = [
  {
    id: 'game-2',
    name: 'Personalized Practice',
    description: 'A dynamic, 5-minute session with varied mini-games to rapidly boost vocabulary from your document.',
    improves: ['Recall', 'Spelling', 'Visual Learning'],
  },
];
