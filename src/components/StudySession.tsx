import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Flashcard, Repertoire, Square, Arrow } from '../types';
import { getRepertoire, updateFlashcard, updateRepertoireStats } from '../utils/storage';
import { calculateSM2, getNextReviewDate } from '../utils/sm2';
import './StudySession.css';

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

export const StudySession: React.FC = () => {
  const { repertoireId, chapterId } = useParams<{ repertoireId: string; chapterId: string }>();
  const navigate = useNavigate();

  if (!repertoireId || !chapterId) {
    navigate('/');
    return null;
  }
  const [repertoire, setRepertoire] = useState<Repertoire | null>(null);
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null);
  const [chess] = useState(new Chess());
  const [boardPosition, setBoardPosition] = useState('');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionIncorrect, setSessionIncorrect] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastWhiteMove, setLastWhiteMove] = useState<MoveAnnotations | null>(null);
  const [lastBlackMove, setLastBlackMove] = useState<MoveAnnotations | null>(null);
  const [playedMoves, setPlayedMoves] = useState<Array<{ san: string; color: 'w' | 'b'; moveNumber: number }>>([]); // Track last 3 played moves with move numbers
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [moveMistakes, setMoveMistakes] = useState<Set<number>>(new Set()); // Track which move indices had mistakes

  useEffect(() => {
    loadSession();
  }, [repertoireId, chapterId]);

  const loadSession = () => {
    const loaded = getRepertoire(repertoireId);
    if (!loaded) {
      navigate(`/repertoire/${repertoireId}`);
      return;
    }

    setRepertoire(loaded);

    // Find the specific chapter
    const chapter = loaded.flashcards.find(card => card.id === chapterId);
    if (!chapter) {
      alert('Chapter not found!');
      navigate(`/repertoire/${repertoireId}`);
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
    setLastWhiteMove(null);
    setLastBlackMove(null);
    setPlayedMoves([]);

    // Initialize move mistakes from saved data
    const mistakes = new Set(card.mistakeIndices || []);
    setMoveMistakes(mistakes);

    // Auto-play to first mistake or from beginning
    setTimeout(() => {
      autoPlayToFirstMistake(card, mistakes);
    }, 500);
  };

  // Auto-play moves up to the first mistake position
  const autoPlayToFirstMistake = async (card: Flashcard, mistakes: Set<number>) => {
    setIsAutoPlaying(true);

    // Find first mistake index (index in the moves array where a white move had an error)
    let firstMistakeIndex = -1;
    for (const mistakeIdx of Array.from(mistakes).sort((a, b) => a - b)) {
      // mistakeIdx is the index of a white move that had mistakes
      if (mistakeIdx < card.moves.length) {
        firstMistakeIndex = mistakeIdx;
        break;
      }
    }

    // If no mistakes, start from beginning
    if (firstMistakeIndex === -1) {
      setIsAutoPlaying(false);
      return;
    }

    // Auto-play all moves up to (but not including) the first mistake
    let moveIdx = 0;
    while (moveIdx < firstMistakeIndex) {
      const move = card.moves[moveIdx];

      try {
        chess.move(move.san);

        // Track move in played moves
        const moveNumber = Math.floor(moveIdx / 2) + 1;
        setPlayedMoves(prev => [...prev, { san: move.san, color: move.color, moveNumber }].slice(-12));

        // Update annotations
        if (move.color === 'w') {
          setLastWhiteMove({
            comment: move.comment,
            highlightedSquares: move.highlightedSquares,
            arrows: move.arrows,
          });
          setLastBlackMove(null);
        } else {
          setLastBlackMove({
            comment: move.comment,
            highlightedSquares: move.highlightedSquares,
            arrows: move.arrows,
          });
        }

        setBoardPosition(chess.fen());
        setCurrentMoveIndex(moveIdx + 1);

        // Wait ~1 second before next move
        await new Promise(resolve => setTimeout(resolve, 1000));

        moveIdx++;
      } catch (e) {
        console.error('Failed to auto-play move:', e);
        break;
      }
    }

    setIsAutoPlaying(false);
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

  // Format played moves with move numbers for display
  // Group moves into complete moves (white + black pairs) and only show complete moves
  const formattedPlayedMoves = useMemo(() => {
    if (playedMoves.length === 0) return '';

    // Group moves by move number
    const moveGroups = new Map<number, { white?: string; blacks: string[] }>();

    for (const move of playedMoves) {
      if (!moveGroups.has(move.moveNumber)) {
        moveGroups.set(move.moveNumber, { blacks: [] });
      }
      const group = moveGroups.get(move.moveNumber)!;
      if (move.color === 'w') {
        group.white = move.san;
      } else {
        group.blacks.push(move.san);
      }
    }

    // Format complete moves
    const completeMoves: string[] = [];
    const sortedMoveNumbers = Array.from(moveGroups.keys()).sort((a, b) => a - b);

    for (const moveNumber of sortedMoveNumbers) {
      const group = moveGroups.get(moveNumber)!;
      // Only include complete moves that have at least a white move
      if (group.white) {
        const blackPart = group.blacks.length > 0 ? ' ' + group.blacks.join(' ') : '';
        completeMoves.push(`${moveNumber}. ${group.white}${blackPart}`);
      }
    }

    // Show only the most recent complete moves to fit in the available space
    // When there are too many, older complete moves disappear entirely (not with ellipsis)
    // Show last 5 complete moves (should fit on most mobile screens)
    const recentMoves = completeMoves.slice(-5);
    return recentMoves.join(' ');
  }, [playedMoves]);

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

    // Show PGN annotations from last white move and last black move
    // Black move annotations take priority if there's overlap
    if (lastWhiteMove) {
      if (lastWhiteMove.highlightedSquares) {
        for (const sq of lastWhiteMove.highlightedSquares) {
          squares[sq.square] = {
            backgroundColor: colorToRgb(sq.color),
          };
        }
      }

      if (lastWhiteMove.arrows) {
        for (const arrow of lastWhiteMove.arrows) {
          arrows.push({
            startSquare: arrow.from,
            endSquare: arrow.to,
            color: colorToRgb(arrow.color),
          });
        }
      }
    }

    if (lastBlackMove) {
      if (lastBlackMove.highlightedSquares) {
        for (const sq of lastBlackMove.highlightedSquares) {
          squares[sq.square] = {
            backgroundColor: colorToRgb(sq.color),
          };
        }
      }

      if (lastBlackMove.arrows) {
        for (const arrow of lastBlackMove.arrows) {
          arrows.push({
            startSquare: arrow.from,
            endSquare: arrow.to,
            color: colorToRgb(arrow.color),
          });
        }
      }
    }

    return { squares, arrows };
  }, [currentExpectedMove, errorCount, showFeedback, lastWhiteMove, lastBlackMove, chess]);

  const handleSquareClick = ({ square }: { square: string }) => {
    if (!currentExpectedMove || isAutoPlaying) return;

    // Check if there's a piece on this square
    const squares = chess.board().flat();
    const clickedSquare = squares.find(sq => sq && sq.square === square);
    const hasWhitePiece = clickedSquare && clickedSquare.type && clickedSquare.color === 'w';

    // If no square selected
    if (!selectedSquare) {
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
    setErrorCount(0);

    // Track this move in played moves (keep last 12 for better display)
    if (currentExpectedMove) {
      const moveNumber = currentFullMove;
      setPlayedMoves(prev => [...prev, { san: currentExpectedMove.move.san, color: 'w' as const, moveNumber }].slice(-12));
    }

    // Save annotations from this correct white move
    if (currentExpectedMove) {
      setLastWhiteMove({
        comment: currentExpectedMove.move.comment,
        highlightedSquares: currentExpectedMove.move.highlightedSquares,
        arrows: currentExpectedMove.move.arrows,
      });
      // Clear black move comment as we're starting a new white-black sequence
      setLastBlackMove(null);
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
    const blackMovesPlayed: Array<{ san: string; color: 'w' | 'b'; moveNumber: number }> = [];

    // Calculate move number for black moves (same as the white move that just happened)
    const moveNumber = currentFullMove;

    // Play all consecutive Black moves
    while (nextIndex < currentCard.moves.length && currentCard.moves[nextIndex].color === 'b') {
      const moveData = currentCard.moves[nextIndex];
      try {
        chess.move(moveData.san);
        blackMovesPlayed.push({ san: moveData.san, color: 'b' as const, moveNumber });
        lastBlackMoveIndex = nextIndex;
        nextIndex++;
      } catch (e) {
        console.error('Failed to play opponent move:', e);
        break;
      }
    }

    // Track black moves in played moves (keep last 12 for better display)
    if (blackMovesPlayed.length > 0) {
      setPlayedMoves(prev => [...prev, ...blackMovesPlayed].slice(-12));
    }

    // Save annotations from the last black move to display until next white move
    if (lastBlackMoveIndex >= 0) {
      const lastBlackMoveData = currentCard.moves[lastBlackMoveIndex];
      setLastBlackMove({
        comment: lastBlackMoveData.comment,
        highlightedSquares: lastBlackMoveData.highlightedSquares,
        arrows: lastBlackMoveData.arrows,
      });
    }

    setBoardPosition(chess.fen());
    setCurrentMoveIndex(nextIndex);
    setShowFeedback(false);

    // Check if line is complete
    if (nextIndex >= currentCard.moves.length) {
      // Line complete, session successful
      // If no errors this session, clear all mistake indices
      if (sessionIncorrect === 0) {
        setMoveMistakes(new Set());
      }
      completeSession(true);
    }
  };

  const handleIncorrectMove = () => {
    setErrorCount(prev => prev + 1);
    setShowFeedback(true);
    setSessionIncorrect(prev => prev + 1);

    // Track this move index as having a mistake
    if (currentExpectedMove) {
      setMoveMistakes(prev => new Set([...prev, currentExpectedMove.index]));
    }
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
        mistakeIndices: Array.from(moveMistakes),
      };

      updateFlashcard(repertoireId, updatedCard);
    } else {
      // Even if not updating SM-2, still update mistake indices
      const updatedCard: Flashcard = {
        ...currentCard,
        mistakeIndices: Array.from(moveMistakes),
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
    navigate(`/repertoire/${repertoireId}`);
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

  // Calculate remaining moves (Due)
  const remainingMoves = totalFullMoves - currentFullMove;

  return (
    <div className="study-session">
      {/* Chess board at the top */}
      <div className={`chessboard-container ${showFeedback ? (errorCount === 0 ? 'feedback-correct' : 'feedback-incorrect') : ''}`}>
        <Chessboard
          options={{
            position: boardPosition,
            onSquareClick: handleSquareClick,
            allowDragging: false,
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

      {/* Scrollable content below board */}
      <div className="scrollable-content">
        {/* Last 3 played moves */}
        <div className="played-moves">
          {isAutoPlaying ? 'Auto-playing to first mistake...' : (formattedPlayedMoves || '\u00A0')}
        </div>

        {/* Back button and stats row */}
        <div className="stats-row">
          <button className="back-button" onClick={handleExit}>
            ← Back
          </button>

          <div className="practice-stats">
            <span className="stat-item">
              <span className="stat-value">{remainingMoves}</span> ⏱️
            </span>
            <span className="stat-item">
              <span className="stat-value">{sessionCorrect}</span> ✅
            </span>
            <span className="stat-item">
              <span className="stat-value">{sessionIncorrect}</span> ❌
            </span>
          </div>
        </div>

        {/* Comment section */}
        {(lastWhiteMove?.comment || lastBlackMove?.comment) && (
          <div className="comment-section">
            {lastWhiteMove?.comment && (
              <div className="move-comment">
                {lastWhiteMove.comment}
              </div>
            )}
            {lastBlackMove?.comment && (
              <div className="move-comment">
                {lastBlackMove.comment}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
