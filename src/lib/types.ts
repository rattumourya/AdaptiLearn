
import type { Timestamp } from 'firebase/firestore';

export interface Document {
  id: string;
  userId: string;
  title: string;
  createdAt: Timestamp | string; // Can be a Timestamp from Firestore or string
  content: string;
}

export interface Game {
  id: string;
  name: string;
  description: string;
  improves: string[];
}

export interface UserProfile {
    uid: string;
    email: string;
    name?: string;
    photoURL?: string;
    createdAt?: string;
}
