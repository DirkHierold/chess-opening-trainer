import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Flashcard } from '../types';
import { getRepertoire } from '../utils/storage';
import './ChapterSelection.css';

export const ChapterSelection: React.FC = () => {
  const { repertoireId } = useParams<{ repertoireId: string }>();
  const navigate = useNavigate();

  if (!repertoireId) {
    navigate('/');
    return null;
  }

  const repertoire = getRepertoire(repertoireId);

  if (!repertoire) {
    navigate('/');
    return null;
  }

  const { name: repertoireName, flashcards: chapters } = repertoire;
  const isDue = (chapter: Flashcard): boolean => {
    return chapter.nextReviewDate <= Date.now();
  };

  const getAccuracy = (chapter: Flashcard): number => {
    // Show 0% for chapters never reviewed
    if (chapter.repetitions === 0) {
      return 0;
    }
    // Calculate accuracy based on easiness factor
    // EF ranges from 1.3 to 2.5, where higher is better
    const normalized = (chapter.easinessFactor - 1.3) / (2.5 - 1.3);
    return Math.round(normalized * 100);
  };

  const formatNextReview = (timestamp: number): string => {
    const now = Date.now();
    if (timestamp <= now) return 'Due now';

    const diffMs = timestamp - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < 30) return `In ${Math.ceil(diffDays / 7)} weeks`;
    return `In ${Math.ceil(diffDays / 30)} months`;
  };

  const dueChapters = chapters.filter(isDue);

  return (
    <div className="chapter-selection">
      <header className="chapter-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="header-info">
          <h1>{repertoireName}</h1>
          <p className="subtitle">{dueChapters.length} of {chapters.length} due for review</p>
        </div>
      </header>

      <div className="chapters-section">
        {chapters.length === 0 ? (
          <div className="empty-state">
            <p>No chapters found</p>
          </div>
        ) : (
          <div className="chapters-list">
            {chapters.map((chapter, index) => {
              const due = isDue(chapter);
              const accuracy = getAccuracy(chapter);

              return (
                <div
                  key={chapter.id}
                  className={`chapter-card ${due ? 'due' : ''}`}
                  onClick={() => navigate(`/repertoire/${repertoireId}/chapter/${chapter.id}`)}
                >
                  <div className="chapter-header-row">
                    <h3 className="chapter-name">
                      {chapter.name || `Chapter ${index + 1}`}
                    </h3>
                    {due && <span className="due-badge">Due</span>}
                  </div>

                  <div className="chapter-stats">
                    <div className="stat">
                      <span className="stat-label">Moves</span>
                      <span className="stat-value">{chapter.moves.length}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Accuracy</span>
                      <span className="stat-value">{accuracy}%</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Reviews</span>
                      <span className="stat-value">{chapter.repetitions}</span>
                    </div>
                  </div>

                  <div className="next-review">
                    Next review: {formatNextReview(chapter.nextReviewDate)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
