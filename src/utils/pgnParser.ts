// PGN Parser to convert PGN files into flashcards (complete lines)

import { Chess } from 'chess.js';
import type { Flashcard, Square, Arrow, Move } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface ParsedComment {
  cleanText: string;
  highlightedSquares: Square[];
  arrows: Arrow[];
}

/**
 * Parse a PGN string and extract complete lines as flashcards
 * @param pgnContent - The PGN file content as string
 * @returns Array of flashcards (each flashcard is a complete line)
 */
export function parsePGNToFlashcards(pgnContent: string): Flashcard[] {
  const flashcards: Flashcard[] = [];

  // Split PGN into individual games/variations
  const games = splitPGNGames(pgnContent);

  for (const gameText of games) {
    try {
      const chess = new Chess();
      const moves = extractCompleteLine(gameText);

      if (moves.length === 0) {
        continue;
      }

      // Create flashcard with complete line
      const flashcard: Flashcard = {
        id: uuidv4(),
        startFen: chess.fen(), // Starting position
        moves,
        name: extractLineName(gameText),
        easinessFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: Date.now(), // Due immediately for new cards
      };

      flashcards.push(flashcard);
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
  // Each game starts with [Event "..."] (not [EventDate, EventType, etc.)
  const games: string[] = [];
  let currentGame = '';
  const lines = pgnContent.split('\n');

  for (const line of lines) {
    // Match specifically [Event "..."] not [EventDate, EventType, etc.
    if (line.trim().match(/^\[Event\s+"/) && currentGame.trim()) {
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
 * Extract complete line (all moves) from a PGN game
 * Includes both White and Black moves
 * @param gameText - Single game PGN text
 * @returns Array of moves with comments and markup
 */
function extractCompleteLine(gameText: string): Move[] {
  const moves: Move[] = [];
  const chess = new Chess();

  // Remove headers
  const pgnWithoutHeaders = gameText.replace(/\[.*?\]\n/g, '').trim();

  // Remove comments for chess.js parsing (it can't handle some comment formats)
  const pgnWithoutComments = pgnWithoutHeaders.replace(/\{[^}]*\}/g, '').trim();

  // Try to load and parse the game
  try {
    chess.loadPgn(pgnWithoutComments);
    const history = chess.history({ verbose: true });

    // Reset to initial position
    chess.reset();

    // Build move list with SAN notation for comment matching
    const moveList = history.map(h => h.san);

    for (let i = 0; i < history.length; i++) {
      const currentTurn = chess.turn();
      const move = history[i];

      // Make the move
      chess.move(move.san);

      // Look for comments associated with this move in the original PGN
      const commentsForMove = findCommentsForMoveImproved(pgnWithoutHeaders, moveList, i);

      // Combine multiple comments into one
      const combinedComment = commentsForMove.join(' ');
      const parsedComment = combinedComment ? parseCommentMarkup(combinedComment) : undefined;

      // Add move to sequence (both White and Black)
      moves.push({
        san: move.san,
        color: currentTurn,
        comment: parsedComment?.cleanText,
        highlightedSquares: parsedComment?.highlightedSquares,
        arrows: parsedComment?.arrows,
      });
    }
  } catch (error) {
    console.warn('Failed to load PGN:', error);
  }

  return moves;
}

/**
 * Improved comment finder that uses the actual move sequence from chess.js
 * @param pgn - Original PGN text
 * @param moveList - Complete list of moves in SAN notation from chess.js
 * @param moveIndex - Index of the move we want comments for
 * @returns Array of comment strings
 */
function findCommentsForMoveImproved(pgn: string, moveList: string[], moveIndex: number): string[] {
  // Remove variations recursively
  let pgnClean = pgn;
  let prevLength = 0;
  while (pgnClean.length !== prevLength) {
    prevLength = pgnClean.length;
    pgnClean = pgnClean.replace(/\([^()]*\)/g, ' ');
  }

  // Build a search string that represents the sequence of moves we're looking for
  // We'll find this move and the next move, then extract comments between them

  const nextMove = moveIndex + 1 < moveList.length ? moveList[moveIndex + 1] : null;

  // Escape special regex characters in move notation
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Find the position of this move in the cleaned PGN
  // We need to be careful because the same move can appear multiple times
  // So we search sequentially through all moves up to our index

  let searchPos = 0;
  for (let i = 0; i <= moveIndex; i++) {
    const moveToFind = moveList[i];
    // Create a regex that matches the move with optional move number before it
    const moveRegex = new RegExp(`\\b${escapeRegex(moveToFind)}\\b`);
    const match = pgnClean.substring(searchPos).match(moveRegex);

    if (!match || match.index === undefined) {
      console.warn(`Could not find move ${i} (${moveToFind}) in PGN`);
      return [];
    }

    if (i === moveIndex) {
      // This is our move! Find its end position
      const moveStartInSubstring = match.index;
      const moveEndInSubstring = moveStartInSubstring + match[0].length;
      const moveEndPosition = searchPos + moveEndInSubstring;

      // Now find where the next move starts (or use end of string)
      let nextMovePosition = pgnClean.length;
      if (nextMove) {
        const nextMoveRegex = new RegExp(`\\b${escapeRegex(nextMove)}\\b`);
        const nextMatch = pgnClean.substring(moveEndPosition).match(nextMoveRegex);
        if (nextMatch && nextMatch.index !== undefined) {
          nextMovePosition = moveEndPosition + nextMatch.index;
        }
      }

      // Extract all comments between current move end and next move start
      const textBetween = pgnClean.substring(moveEndPosition, nextMovePosition);
      const commentRegex = /\{([^}]*)\}/g;
      const comments: string[] = [];
      let commentMatch;
      while ((commentMatch = commentRegex.exec(textBetween)) !== null) {
        comments.push(commentMatch[1].trim());
      }

      return comments;
    }

    // Move search position forward
    searchPos += match.index + match[0].length;
  }

  return [];
}

/**
 * Extract line name from PGN headers
 * @param gameText - PGN game text
 * @returns Line name or undefined
 */
function extractLineName(gameText: string): string | undefined {
  // Special case: Check for White + Black header combination (ChessBase chapter format)
  const whiteMatch = gameText.match(/\[White\s+"([^"]+)"\]/);
  const blackMatch = gameText.match(/\[Black\s+"([^"]+)"\]/);

  if (whiteMatch && blackMatch && whiteMatch[1] && blackMatch[1]) {
    const whitePart = whiteMatch[1].trim();
    const blackPart = blackMatch[1].trim();

    // Check if these look like move sequences (contain numbers and moves)
    const looksLikeMoves = /\d+\.|\.\.\./.test(whitePart) || /\d+\.|\.\.\./.test(blackPart);

    if (looksLikeMoves && whitePart !== '?' && blackPart !== '?') {
      // Combine White and Black headers to form chapter name
      const result = `${whitePart} - ${blackPart}`;
      return result;
    }
  }

  // Try other header types in order of preference
  const headerPriority = [
    'Event',
    'Opening',
    'Variation',
    'ECO',
    'Site',
    'Annotator',
    'White',
    'Black'
  ];

  for (const headerType of headerPriority) {
    const regex = new RegExp(`\\[${headerType}\\s+"([^"]+)"\\]`);
    const match = gameText.match(regex);
    if (match && match[1] && match[1] !== '?' && match[1].trim() !== '') {
      return match[1];
    }
  }

  // Fallback: try to extract from first comment
  const commentMatch = gameText.match(/\{([^}]+)\}/);
  if (commentMatch) {
    // Take first line of comment as name
    const firstLine = commentMatch[1].split('\n')[0].trim();
    // Remove ALL markup commands (not just csl and cal, but also evp, clk, emt, etc.)
    const cleaned = firstLine
      .replace(/\[%[^\]]+\]/g, '') // Remove all [%...] markup commands
      .trim();
    if (cleaned && cleaned.length > 0 && cleaned.length < 100) {
      return cleaned;
    }
  }

  return undefined;
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

  // Remove ALL markup from comment text (not just csl and cal)
  result.cleanText = comment
    .replace(/\[%[^\]]+\]/g, '') // Remove all [%...] markup commands
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
