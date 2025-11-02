// Core data types for the chess opening trainer

export interface Square {
  square: string;
  color: 'Y' | 'R' | 'G' | 'B';
}

export interface Arrow {
  from: string;
  to: string;
  color: 'Y' | 'R' | 'G' | 'B';
}

export interface Move {
  san: string; // Move in SAN notation (e.g., "Nf3")
  color: 'w' | 'b'; // Which side makes this move
  comment?: string; // PGN comment for the move (cleaned, without markup)
  highlightedSquares?: Square[]; // From [%csl] markup
  arrows?: Arrow[]; // From [%cal] markup
}

export interface Flashcard {
  id: string;
  startFen: string; // Starting position for this line
  moves: Move[]; // Complete sequence of moves in this line
  name?: string; // Name/description of this line
  easinessFactor: number; // SM-2 algorithm parameter
  interval: number; // Days until next review
  repetitions: number; // Number of consecutive correct answers
  nextReviewDate: number; // Timestamp for next review
  lastReviewed?: number; // Timestamp of last review
  mistakeIndices?: number[]; // Indices of white moves that had mistakes
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
