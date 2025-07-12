
import type { Timestamp } from 'firebase/firestore';

export interface Document {
  id: string;
  userId: string;
  title: string;
  createdAt: Timestamp | { seconds: number, nanoseconds: number };
  content: string;
  category: string; // e.g., "Science", "History", "Coding"
}

export interface Game {
  id: string;
  name: string;
  description: string;
  improves: string[];
  // An array of categories this game is suitable for. Empty means suitable for all.
  supportedCategories: string[];
  isPlayable: boolean;
}

export interface UserProfile {
    uid: string;
    email: string;
    name?: string;
    photoURL?: string;
    createdAt?: string;
}
