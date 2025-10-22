// Core data types for the chess opening trainer

export interface Flashcard {
  id: string;
  fen: string; // Position to show
  correctMove: string; // Expected move in SAN notation
  comment?: string; // PGN comment for the move
  easinessFactor: number; // SM-2 algorithm parameter
  interval: number; // Days until next review
  repetitions: number; // Number of consecutive correct answers
  nextReviewDate: number; // Timestamp for next review
  lastReviewed?: number; // Timestamp of last review
}

export interface Repertoire {
  id: string;
  name: string; // From PGN filename
  flashcards: Flashcard[];
  createdAt: number;
  lastStudied?: number;
  totalCards: number;
  streak: number; // Current streak of consecutive correct answers
  longestStreak: number;
  stats: {
    totalReviews: number;
    correctReviews: number;
    accuracy: number; // Percentage
  };
}

export interface StudySession {
  repertoireId: string;
  startTime: number;
  cardsReviewed: number;
  correctCount: number;
  incorrectCount: number;
}

export type FeedbackType = 'correct' | 'incorrect';

export interface SM2Result {
  easinessFactor: number;
  interval: number;
  repetitions: number;
}
