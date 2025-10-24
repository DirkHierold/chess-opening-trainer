// PGN Parser to convert PGN files into flashcards

import { Chess } from 'chess.js';
import type { Flashcard, Square, Arrow } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface ParsedMove {
  fen: string;
  move: string;
  comment?: string;
  highlightedSquares?: Square[];
  arrows?: Arrow[];
}

interface ParsedComment {
  cleanText: string;
  highlightedSquares: Square[];
  arrows: Arrow[];
}

/**
 * Parse a PGN string and extract all positions with moves and comments
 * @param pgnContent - The PGN file content as string
 * @returns Array of flashcards
 */
export function parsePGNToFlashcards(pgnContent: string): Flashcard[] {
  const flashcards: Flashcard[] = [];

  // Split PGN into individual games/variations
  const games = splitPGNGames(pgnContent);

  for (const gameText of games) {
    try {
      const chess = new Chess();
      const moves = extractMovesWithComments(gameText);

      for (const moveData of moves) {
        // Set up the position
        chess.load(moveData.fen);

        // Create flashcard
        const flashcard: Flashcard = {
          id: uuidv4(),
          fen: moveData.fen,
          correctMove: moveData.move,
          comment: moveData.comment,
          highlightedSquares: moveData.highlightedSquares,
          arrows: moveData.arrows,
          easinessFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReviewDate: Date.now(), // Due immediately for new cards
        };

        flashcards.push(flashcard);
      }
    } catch (error) {
      console.warn('Failed to parse game:', error);
    }
  }

  return flashcards;
}

/**
 * Split PGN content into individual games
 * @param pgnContent - Raw PGN content
 * @returns Array of game strings
 */
function splitPGNGames(pgnContent: string): string[] {
  // PGN games are typically separated by blank lines
  // Each game starts with [Event or similar headers
  const games: string[] = [];
  let currentGame = '';
  const lines = pgnContent.split('\n');

  for (const line of lines) {
    if (line.trim().startsWith('[Event') && currentGame.trim()) {
      games.push(currentGame);
      currentGame = line + '\n';
    } else {
      currentGame += line + '\n';
    }
  }

  if (currentGame.trim()) {
    games.push(currentGame);
  }

  return games.filter(g => g.trim().length > 0);
}

/**
 * Extract moves with their positions and comments from a PGN game
 * Only extracts White's moves (for White repertoire training)
 * @param gameText - Single game PGN text
 * @returns Array of positions with moves and comments
 */
function extractMovesWithComments(gameText: string): ParsedMove[] {
  const moves: ParsedMove[] = [];
  const chess = new Chess();

  // Remove headers
  const pgnWithoutHeaders = gameText.replace(/\[.*?\]\n/g, '').trim();

  // Try to load and parse the game
  try {
    chess.loadPgn(pgnWithoutHeaders);
    const history = chess.history({ verbose: true });

    // Reset to initial position
    chess.reset();

    // Extract comments from PGN
    const comments = extractComments(pgnWithoutHeaders);
    let commentIndex = 0;

    for (let i = 0; i < history.length; i++) {
      const currentFen = chess.fen();
      const move = history[i];

      // Check whose turn it is (White to move = 'w', Black to move = 'b')
      const currentTurn = chess.turn();

      // Make the move
      chess.move(move.san);

      // Check if there's a comment for this move
      let parsedComment: ParsedComment | undefined;
      if (commentIndex < comments.length) {
        parsedComment = parseCommentMarkup(comments[commentIndex]);
        commentIndex++;
      }

      // Only create flashcard if it's White's turn (White's move to learn)
      if (currentTurn === 'w') {
        moves.push({
          fen: currentFen,
          move: move.san,
          comment: parsedComment?.cleanText,
          highlightedSquares: parsedComment?.highlightedSquares,
          arrows: parsedComment?.arrows,
        });
      }
    }
  } catch (error) {
    console.warn('Failed to load PGN:', error);
  }

  return moves;
}

/**
 * Extract comments from PGN notation
 * Comments in PGN are enclosed in curly braces {}
 * @param pgn - PGN text
 * @returns Array of comments in order
 */
function extractComments(pgn: string): string[] {
  const comments: string[] = [];
  const commentRegex = /\{([^}]+)\}/g;
  let match;

  while ((match = commentRegex.exec(pgn)) !== null) {
    comments.push(match[1].trim());
  }

  return comments;
}

/**
 * Parse PGN comment to extract markup annotations and clean text
 * Handles [%csl] for colored squares and [%cal] for colored arrows
 * @param comment - Raw comment text from PGN
 * @returns Parsed comment with markup data and clean text
 */
function parseCommentMarkup(comment: string): ParsedComment {
  const result: ParsedComment = {
    cleanText: comment,
    highlightedSquares: [],
    arrows: [],
  };

  // Extract colored square list [%csl Ya2,Rb4]
  const cslRegex = /\[%csl\s+([^\]]+)\]/g;
  let cslMatch;
  while ((cslMatch = cslRegex.exec(comment)) !== null) {
    const squares = cslMatch[1].split(',');
    for (const sq of squares) {
      const trimmed = sq.trim();
      if (trimmed.length >= 3) {
        const color = trimmed[0] as 'Y' | 'R' | 'G' | 'B';
        const square = trimmed.substring(1).toLowerCase();
        result.highlightedSquares.push({ square, color });
      }
    }
  }

  // Extract colored arrow list [%cal Yb4a2,Rd2d4]
  const calRegex = /\[%cal\s+([^\]]+)\]/g;
  let calMatch;
  while ((calMatch = calRegex.exec(comment)) !== null) {
    const arrows = calMatch[1].split(',');
    for (const arrow of arrows) {
      const trimmed = arrow.trim();
      if (trimmed.length >= 5) {
        const color = trimmed[0] as 'Y' | 'R' | 'G' | 'B';
        const from = trimmed.substring(1, 3).toLowerCase();
        const to = trimmed.substring(3, 5).toLowerCase();
        result.arrows.push({ from, to, color });
      }
    }
  }

  // Remove markup from comment text
  result.cleanText = comment
    .replace(/\[%csl\s+[^\]]+\]/g, '')
    .replace(/\[%cal\s+[^\]]+\]/g, '')
    .trim();

  return result;
}

/**
 * Get the filename without extension from a File object
 * @param file - File object
 * @returns Name without extension
 */
export function getRepertoireName(file: File): string {
  return file.name.replace(/\.pgn$/i, '');
}
