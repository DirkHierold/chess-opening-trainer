import React, { useState, useEffect, useCallback } from 'react';
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

type FeedbackState = 'none' | 'correct' | 'incorrect';

export const StudySession: React.FC<StudySessionProps> = ({ repertoireId, onExit }) => {
  const [repertoire, setRepertoire] = useState<Repertoire | null>(null);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [chess] = useState(new Chess());
  const [boardPosition, setBoardPosition] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionIncorrect, setSessionIncorrect] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

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
      // No cards due
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
    chess.load(card.fen);
    setBoardPosition(card.fen);
    setFeedback('none');
  };

  const currentCard = dueCards[currentCardIndex];

  const handleMove = ({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }): boolean => {
    if (feedback !== 'none' || !targetSquare) {
      return false; // Don't allow moves during feedback
    }

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Always promote to queen for simplicity
      });

      if (!move) {
        return false;
      }

      // Check if this is the correct move
      const isCorrect = move.san === currentCard.correctMove;

      if (isCorrect) {
        handleCorrectAnswer();
      } else {
        // Undo the incorrect move
        chess.undo();
        handleIncorrectAnswer();
      }

      return isCorrect;
    } catch (error) {
      return false;
    }
  };

  const handleCorrectAnswer = () => {
    setFeedback('correct');
    setSessionCorrect(prev => prev + 1);
    setCurrentStreak(prev => prev + 1);

    // Update flashcard with SM-2
    const sm2Result = calculateSM2(
      1,
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

    // Auto-advance after 1.5 seconds
    setTimeout(() => {
      advanceToNextCard(false);
    }, 1500);
  };

  const handleIncorrectAnswer = () => {
    setFeedback('incorrect');
    setSessionIncorrect(prev => prev + 1);
    setCurrentStreak(0);

    // Update flashcard with SM-2
    const sm2Result = calculateSM2(
      0,
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

    // Show correct move
    chess.move(currentCard.correctMove);
    setBoardPosition(chess.fen());
  };

  const advanceToNextCard = useCallback((streakBroken: boolean) => {
    const nextIndex = currentCardIndex + 1;

    if (nextIndex >= dueCards.length) {
      // Session complete
      updateRepertoireStats(
        repertoireId,
        sessionCorrect,
        sessionIncorrect,
        streakBroken || sessionIncorrect > 0
      );
      onExit();
    } else {
      setCurrentCardIndex(nextIndex);
      loadCard(dueCards[nextIndex]);
    }
  }, [currentCardIndex, dueCards, repertoireId, sessionCorrect, sessionIncorrect, onExit]);

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientY;
    const diff = touchStart - touchEnd;

    // Swipe up detected (threshold: 50px)
    if (diff > 50 && feedback === 'incorrect') {
      advanceToNextCard(true);
    }

    setTouchStart(null);
  };

  if (!repertoire || !currentCard) {
    return (
      <div className="study-session loading">
        <p>Loading...</p>
      </div>
    );
  }

  const progress = ((currentCardIndex + 1) / dueCards.length) * 100;

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

      {/* Main card area */}
      <div className={`flashcard ${feedback}`}>
        <div className="chessboard-container">
          <Chessboard
            options={{
              id: 'study-board',
              position: boardPosition,
              onPieceDrop: handleMove,
              allowDragging: feedback === 'none',
              allowDrawingArrows: false,
              boardOrientation: 'white',
              boardStyle: {
                borderRadius: '8px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
              },
            }}
          />
        </div>

        {/* Feedback overlay */}
        {feedback === 'correct' && (
          <div className="feedback-overlay correct">
            <div className="feedback-content">
              <div className="feedback-icon">✓</div>
              <div className="feedback-text">Correct!</div>
            </div>
          </div>
        )}

        {feedback === 'incorrect' && (
          <div className="feedback-overlay incorrect">
            <div className="feedback-content">
              <div className="feedback-icon">✗</div>
              <div className="feedback-text">Incorrect</div>
              <div className="correct-move">
                Correct move: <strong>{currentCard.correctMove}</strong>
              </div>
              {currentCard.comment && (
                <div className="move-comment">{currentCard.comment}</div>
              )}
              <button
                className="continue-button"
                onClick={() => advanceToNextCard(true)}
              >
                Continue →
              </button>
              <div className="swipe-hint mobile-only">👆 Swipe up to continue</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
