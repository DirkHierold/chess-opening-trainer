import React, { useState, useEffect, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Flashcard, Repertoire, Square, Arrow } from '../types';
import { getRepertoire, updateFlashcard, updateRepertoireStats } from '../utils/storage';
import { calculateSM2, getNextReviewDate } from '../utils/sm2';
import './StudySession.css';

interface StudySessionProps {
  repertoireId: string;
  chapterId: string;
  onExit: () => void;
}

interface MoveAnnotations {
  comment?: string;
  highlightedSquares?: Square[];
  arrows?: Arrow[];
}

// Helper function to convert color codes to RGB
const colorToRgb = (color: 'Y' | 'R' | 'G' | 'B'): string => {
  switch (color) {
    case 'Y': return 'rgb(255, 255, 0)'; // Yellow
    case 'R': return 'rgb(255, 0, 0)';   // Red
    case 'G': return 'rgb(0, 255, 0)';   // Green
    case 'B': return 'rgb(0, 0, 255)';   // Blue
  }
};

export const StudySession: React.FC<StudySessionProps> = ({ repertoireId, chapterId, onExit }) => {
  const [repertoire, setRepertoire] = useState<Repertoire | null>(null);
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null);
  const [chess] = useState(new Chess());
  const [boardPosition, setBoardPosition] = useState('');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionIncorrect, setSessionIncorrect] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastCorrectMove, setLastCorrectMove] = useState<MoveAnnotations | null>(null);

  useEffect(() => {
    // Reset scroll position when entering study session
    window.scrollTo(0, 0);
    loadSession();
  }, [repertoireId, chapterId]);

  const loadSession = () => {
    const loaded = getRepertoire(repertoireId);
    if (!loaded) {
      onExit();
      return;
    }

    setRepertoire(loaded);
    setCurrentStreak(loaded.streak);

    // Find the specific chapter
    const chapter = loaded.flashcards.find(card => card.id === chapterId);
    if (!chapter) {
      alert('Chapter not found!');
      onExit();
      return;
    }

    setCurrentCard(chapter);
    loadCard(chapter);
  };

  const loadCard = (card: Flashcard) => {
    chess.load(card.startFen);
    setBoardPosition(card.startFen);
    setCurrentMoveIndex(0);
    setErrorCount(0);
    setShowFeedback(false);
    setSelectedSquare(null);
    setLastCorrectMove(null);
  };

  // Get the current expected move (always a White move for the user)
  const currentExpectedMove = useMemo(() => {
    if (!currentCard || currentMoveIndex >= currentCard.moves.length) {
      return null;
    }
    // Find next White move
    for (let i = currentMoveIndex; i < currentCard.moves.length; i++) {
      if (currentCard.moves[i].color === 'w') {
        return { move: currentCard.moves[i], index: i };
      }
    }
    return null;
  }, [currentCard, currentMoveIndex]);

  // Calculate move number in chess notation (1 full move = White + Black)
  const currentFullMove = useMemo(() => {
    if (!currentCard) return 0;
    let whiteMoves = 0;
    for (let i = 0; i <= currentMoveIndex && i < currentCard.moves.length; i++) {
      if (currentCard.moves[i].color === 'w') {
        whiteMoves++;
      }
    }
    return whiteMoves;
  }, [currentCard, currentMoveIndex]);

  const totalFullMoves = useMemo(() => {
    if (!currentCard) return 0;
    let whiteMoves = 0;
    for (const move of currentCard.moves) {
      if (move.color === 'w') {
        whiteMoves++;
      }
    }
    return whiteMoves;
  }, [currentCard]);

  // Calculate squares and arrows to display
  const displayAnnotations = useMemo(() => {
    const squares: { [square: string]: React.CSSProperties } = {};
    const arrows: { startSquare: string; endSquare: string; color: string }[] = [];

    // Show error hints
    if (currentExpectedMove && showFeedback && errorCount > 0) {
      const move = currentExpectedMove.move;

      // First error: highlight source square (where piece that should move is)
      if (errorCount >= 1) {
        try {
          const tempChess = new Chess(chess.fen());
          const madeMove = tempChess.move(move.san);
          if (madeMove) {
            squares[madeMove.from] = {
              backgroundColor: 'rgba(255, 0, 0, 0.5)',
            };
          }
        } catch (e) {
          // Ignore
        }
      }

      // Second error: also show arrow
      if (errorCount >= 2) {
        try {
          const tempChess = new Chess(chess.fen());
          const madeMove = tempChess.move(move.san);
          if (madeMove) {
            arrows.push({
              startSquare: madeMove.from,
              endSquare: madeMove.to,
              color: 'rgb(0, 200, 0)',
            });
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    // Show PGN annotations from last correct move or current expected move
    const annotationsSource = lastCorrectMove || (currentExpectedMove?.move);

    if (annotationsSource) {
      if (annotationsSource.highlightedSquares) {
        for (const sq of annotationsSource.highlightedSquares) {
          squares[sq.square] = {
            backgroundColor: colorToRgb(sq.color),
          };
        }
      }

      if (annotationsSource.arrows) {
        for (const arrow of annotationsSource.arrows) {
          arrows.push({
            startSquare: arrow.from,
            endSquare: arrow.to,
            color: colorToRgb(arrow.color),
          });
        }
      }
    }

    return { squares, arrows };
  }, [currentExpectedMove, errorCount, showFeedback, lastCorrectMove, chess]);

  const handleSquareClick = ({ square }: { square: string }) => {
    if (!currentExpectedMove) return;

    // Check if there's a piece on this square
    const squares = chess.board().flat();
    const clickedSquare = squares.find(sq => sq && sq.square === square);
    const hasWhitePiece = clickedSquare && clickedSquare.type && clickedSquare.color === 'w';

    // If no square selected
    if (!selectedSquare) {
      // Clear last correct move annotations when starting a new move
      setLastCorrectMove(null);

      // Select this square if it has a white piece
      if (hasWhitePiece) {
        setSelectedSquare(square);
      }
      return;
    }

    // Square already selected
    if (selectedSquare === square) {
      // Clicked same square, deselect
      setSelectedSquare(null);
      return;
    }

    // Clicked on another white piece - switch selection
    if (hasWhitePiece) {
      setSelectedSquare(square);
      return;
    }

    // Try to make the move
    try {
      const move = chess.move({
        from: selectedSquare,
        to: square,
        promotion: 'q', // Always promote to queen
      });

      if (!move) {
        setSelectedSquare(null);
        return;
      }

      // Check if this is the correct move
      const isCorrect = move.san === currentExpectedMove.move.san;

      if (isCorrect) {
        handleCorrectMove();
      } else {
        // Undo the incorrect move
        chess.undo();
        handleIncorrectMove();
      }

      setSelectedSquare(null);
    } catch (error) {
      setSelectedSquare(null);
    }
  };

  const handleCorrectMove = () => {
    setBoardPosition(chess.fen());
    setShowFeedback(true);
    setSessionCorrect(prev => prev + 1);
    setCurrentStreak(prev => prev + 1);
    setErrorCount(0);

    // Save annotations from this correct move
    if (currentExpectedMove) {
      setLastCorrectMove({
        comment: currentExpectedMove.move.comment,
        highlightedSquares: currentExpectedMove.move.highlightedSquares,
        arrows: currentExpectedMove.move.arrows,
      });
    }

    // Play opponent's moves automatically after a short delay
    setTimeout(() => {
      playOpponentMoves();
    }, 800);
  };

  const playOpponentMoves = () => {
    if (!currentCard) return;

    let nextIndex = currentMoveIndex + 1;
    let lastBlackMoveIndex = -1;

    // Play all consecutive Black moves
    while (nextIndex < currentCard.moves.length && currentCard.moves[nextIndex].color === 'b') {
      const moveData = currentCard.moves[nextIndex];
      try {
        chess.move(moveData.san);
        lastBlackMoveIndex = nextIndex;
        nextIndex++;
      } catch (e) {
        console.error('Failed to play opponent move:', e);
        break;
      }
    }

    // Save annotations from the last black move to display until next white move
    if (lastBlackMoveIndex >= 0) {
      const lastBlackMove = currentCard.moves[lastBlackMoveIndex];
      setLastCorrectMove({
        comment: lastBlackMove.comment,
        highlightedSquares: lastBlackMove.highlightedSquares,
        arrows: lastBlackMove.arrows,
      });
    }

    setBoardPosition(chess.fen());
    setCurrentMoveIndex(nextIndex);
    setShowFeedback(false);

    // Check if line is complete
    if (nextIndex >= currentCard.moves.length) {
      // Line complete, session successful
      completeSession(true);
    }
  };

  const handleIncorrectMove = () => {
    setErrorCount(prev => prev + 1);
    setShowFeedback(true);
    setSessionIncorrect(prev => prev + 1);
    setCurrentStreak(0);
  };

  const completeSession = (success: boolean, updateCard: boolean = true) => {
    if (!currentCard) return;

    // Only update flashcard if requested (not on manual exit)
    if (updateCard) {
      // Update flashcard with SM-2
      const sm2Result = calculateSM2(
        success ? 1 : 0,
        currentCard.easinessFactor,
        currentCard.interval,
        currentCard.repetitions
      );

      const updatedCard: Flashcard = {
        ...currentCard,
        easinessFactor: sm2Result.easinessFactor,
        interval: sm2Result.interval,
        repetitions: sm2Result.repetitions,
        nextReviewDate: getNextReviewDate(sm2Result.interval),
        lastReviewed: Date.now(),
      };

      updateFlashcard(repertoireId, updatedCard);
    }

    // Always update repertoire stats
    updateRepertoireStats(
      repertoireId,
      sessionCorrect,
      sessionIncorrect,
      sessionIncorrect > 0
    );

    // Exit back to chapter selection
    onExit();
  };

  const handleExit = () => {
    // Save progress on exit without updating the flashcard
    completeSession(false, false);
  };

  if (!repertoire || !currentCard || !currentExpectedMove) {
    return (
      <div className="study-session loading">
        <p>Loading...</p>
      </div>
    );
  }

  const moveProgress = `Move ${currentFullMove} / ${totalFullMoves}`;

  return (
    <div className="study-session">
      {/* Header with stats */}
      <div className="session-header">
        <button className="exit-button" onClick={handleExit}>
          ← Exit
        </button>
        <div className="session-stats">
          <span className="streak">🔥 {currentStreak}</span>
        </div>
      </div>

      {/* Main content area */}
      <div className="content-area">
        {/* Line name and move progress */}
        <div className="line-info">
          {currentCard.name && <div className="line-name">{currentCard.name}</div>}
          <div className="move-progress">{moveProgress}</div>
        </div>

        {/* Chess board with feedback border */}
        <div className={`chessboard-container ${showFeedback ? (errorCount === 0 ? 'feedback-correct' : 'feedback-incorrect') : ''}`}>
          <Chessboard
            options={{
              position: boardPosition,
              onSquareClick: handleSquareClick,
              allowDragging: false, // Disable drag-and-drop
              arrows: displayAnnotations.arrows,
              squareStyles: {
                ...displayAnnotations.squares,
                ...(selectedSquare ? { [selectedSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } } : {}),
              },
              boardOrientation: 'white',
              boardStyle: {
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              },
            }}
          />
        </div>

        {/* Comment section - show from last correct move or current expected move */}
        {(lastCorrectMove?.comment || currentExpectedMove.move.comment) && (
          <div className="comment-section">
            <div className="move-comment">
              {lastCorrectMove?.comment || currentExpectedMove.move.comment}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
