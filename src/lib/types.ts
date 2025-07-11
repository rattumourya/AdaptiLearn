export interface Document {
  id: string;
  title: string;
  createdAt: string;
  contentSnippet: string;
  content: string; // full content for AI processing
}

export interface Game {
  id: string;
  name: string;
  description: string;
  improves: string[];
}
