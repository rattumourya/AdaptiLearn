import type { Document, Game } from './types';

export const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'doc-1',
    title: 'The Great Gatsby - Chapter 1',
    createdAt: '2024-05-20T14:48:00.000Z',
    contentSnippet: 'In my younger and more vulnerable years my father gave me some advice that I’ve been turning over in my mind ever since...',
    content: 'In my younger and more vulnerable years my father gave me some advice that I’ve been turning over in my mind ever since. ‘Whenever you feel like criticizing any one,’ he told me, ‘just remember that all the people in this world haven’t had the advantages that you’ve had.’ He didn’t say any more, but we’ve always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I’m inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.'
  },
  {
    id: 'doc-2',
    title: 'A Brief History of Time',
    createdAt: '2024-05-18T09:22:00.000Z',
    contentSnippet: 'Our picture of the universe has changed a great deal in the last few centuries. From the idea of a flat Earth to the model of a vast, expanding cosmos...',
    content: 'Our picture of the universe has changed a great deal in the last few centuries. From the idea of a flat Earth to the model of a vast, expanding cosmos, our understanding has evolved. Early models of the universe were geocentric, placing Earth at the center. Later, Copernicus proposed a heliocentric model, which was a major step forward. Now, we know we are just a small part of an immense and dynamic universe governed by the laws of physics, like general relativity and quantum mechanics.'
  },
];

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
