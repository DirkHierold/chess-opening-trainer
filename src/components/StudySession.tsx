import React, { useState, useEffect, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Flashcard, Repertoire } from '../types';
import { getRepertoire, updateFlashcard, updateRepertoireStats } from '../utils/storage';
import { calculateSM2, getNextReviewDate } from '../utils/sm2';
import './StudySession.css';

interface StudySessionProps {
  repertoireId: string;
  onExit: () => void;
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

export const StudySession: React.FC<StudySessionProps> = ({ repertoireId, onExit }) => {
  const [repertoire, setRepertoire] = useState<Repertoire | null>(null);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [chess] = useState(new Chess());
  const [boardPosition, setBoardPosition] = useState('');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionIncorrect, setSessionIncorrect] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    loadSession();
  }, [repertoireId]);

  const loadSession = () => {
    const loaded = getRepertoire(repertoireId);
    if (!loaded) {
      onExit();
      return;
    }

    setRepertoire(loaded);
    setCurrentStreak(loaded.streak);

    const now = Date.now();
    const due = loaded.flashcards.filter(card => card.nextReviewDate <= now);

    if (due.length === 0) {
      alert('No cards due for review! Come back later.');
      onExit();
      return;
    }

    // Shuffle due cards
    const shuffled = [...due].sort(() => Math.random() - 0.5);
    setDueCards(shuffled);
    loadCard(shuffled[0]);
  };

  const loadCard = (card: Flashcard) => {
    chess.load(card.startFen);
    setBoardPosition(card.startFen);
    setCurrentMoveIndex(0);
    setErrorCount(0);
    setShowFeedback(false);
    setSelectedSquare(null);
  };

  const currentCard = dueCards[currentCardIndex];

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

  // Calculate squares and arrows to display
  const displayAnnotations = useMemo(() => {
    const squares: { [square: string]: React.CSSProperties } = {};
    const arrows: { startSquare: string; endSquare: string; color: string }[] = [];

    if (!currentExpectedMove || !showFeedback) {
      return { squares, arrows };
    }

    const move = currentExpectedMove.move;

    // First error: highlight target square
    if (errorCount >= 1) {
      try {
        const tempChess = new Chess(chess.fen());
        const madeMove = tempChess.move(move.san);
        if (madeMove) {
          squares[madeMove.to] = {
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

    // Show PGN annotations
    if (move.highlightedSquares) {
      for (const sq of move.highlightedSquares) {
        squares[sq.square] = {
          backgroundColor: colorToRgb(sq.color),
        };
      }
    }

    if (move.arrows) {
      for (const arrow of move.arrows) {
        arrows.push({
          startSquare: arrow.from,
          endSquare: arrow.to,
          color: colorToRgb(arrow.color),
        });
      }
    }

    return { squares, arrows };
  }, [currentExpectedMove, errorCount, showFeedback, chess]);

  const handleSquareClick = ({ square }: { square: string }) => {
    if (!currentExpectedMove) return;

    // If no square selected, select this square
    if (!selectedSquare) {
      // Check if there's a piece on this square that we can move
      const squares = chess.board().flat();
      const clickedSquare = squares.find(sq => sq && sq.square === square);
      if (clickedSquare && clickedSquare.type && clickedSquare.color === 'w') {
        setSelectedSquare(square);
      }
      return;
    }

    // Square already selected, try to move
    if (selectedSquare === square) {
      // Clicked same square, deselect
      setSelectedSquare(null);
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

    // Play opponent's moves automatically after a short delay
    setTimeout(() => {
      playOpponentMoves();
    }, 800);
  };

  const playOpponentMoves = () => {
    if (!currentCard) return;

    let nextIndex = currentMoveIndex + 1;

    // Play all consecutive Black moves
    while (nextIndex < currentCard.moves.length && currentCard.moves[nextIndex].color === 'b') {
      const moveData = currentCard.moves[nextIndex];
      try {
        chess.move(moveData.san);
        nextIndex++;
      } catch (e) {
        console.error('Failed to play opponent move:', e);
        break;
      }
    }

    setBoardPosition(chess.fen());
    setCurrentMoveIndex(nextIndex);
    setShowFeedback(false);

    // Check if line is complete
    if (nextIndex >= currentCard.moves.length) {
      // Line complete, update card and move to next
      updateCardAndAdvance(true);
    }
  };

  const handleIncorrectMove = () => {
    setErrorCount(prev => prev + 1);
    setShowFeedback(true);
    setSessionIncorrect(prev => prev + 1);
    setCurrentStreak(0);
  };

  const updateCardAndAdvance = (success: boolean) => {
    if (!currentCard) return;

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

    // Move to next card
    const nextIndex = currentCardIndex + 1;
    if (nextIndex >= dueCards.length) {
      // Session complete
      updateRepertoireStats(
        repertoireId,
        sessionCorrect,
        sessionIncorrect,
        sessionIncorrect > 0
      );
      onExit();
    } else {
      setCurrentCardIndex(nextIndex);
      loadCard(dueCards[nextIndex]);
    }
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    // Swipe left detected (threshold: 50px) - skip to next line
    if (diff > 50) {
      updateCardAndAdvance(false);
    }

    setTouchStart(null);
  };

  if (!repertoire || !currentCard || !currentExpectedMove) {
    return (
      <div className="study-session loading">
        <p>Loading...</p>
      </div>
    );
  }

  const progress = ((currentCardIndex + 1) / dueCards.length) * 100;
  const moveProgress = `Move ${currentMoveIndex + 1} / ${currentCard.moves.length}`;

  return (
    <div
      className="study-session"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with stats */}
      <div className="session-header">
        <button className="exit-button" onClick={onExit}>
          ← Exit
        </button>
        <div className="session-stats">
          <span className="streak">🔥 {currentStreak}</span>
          <span className="card-counter">
            {currentCardIndex + 1} / {dueCards.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
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

        {/* Comment section - always show when available */}
        {currentExpectedMove.move.comment && (
          <div className="comment-section">
            <div className="move-comment">
              {currentExpectedMove.move.comment}
            </div>
          </div>
        )}

        {/* Swipe hint */}
        <div className="swipe-hint">← Swipe left to skip line</div>
      </div>
    </div>
  );
};
