import React, { useState, useEffect } from 'react';
import type { Repertoire } from '../types';
import { getAllRepertoires, saveRepertoire, getDueFlashcards } from '../utils/storage';
import { parsePGNToFlashcards, getRepertoireName } from '../utils/pgnParser';
import { v4 as uuidv4 } from 'uuid';
import './HomePage.css';

interface HomePageProps {
  onStartStudy: (repertoireId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onStartStudy }) => {
  const [repertoires, setRepertoires] = useState<Repertoire[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    loadRepertoires();
  }, []);

  const loadRepertoires = () => {
    const loaded = getAllRepertoires();
    setRepertoires(loaded);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const content = await file.text();
      const flashcards = parsePGNToFlashcards(content);

      if (flashcards.length === 0) {
        setUploadError('No valid moves found in PGN file');
        setIsUploading(false);
        return;
      }

      const newRepertoire: Repertoire = {
        id: uuidv4(),
        name: getRepertoireName(file),
        flashcards,
        createdAt: Date.now(),
        totalCards: flashcards.length,
        streak: 0,
        longestStreak: 0,
        stats: {
          totalReviews: 0,
          correctReviews: 0,
          accuracy: 0,
        },
      };

      saveRepertoire(newRepertoire);
      loadRepertoires();

      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Failed to parse PGN:', error);
      setUploadError('Failed to parse PGN file. Please check the file format.');
    } finally {
      setIsUploading(false);
    }
  };

  const getDueCount = (repertoire: Repertoire): number => {
    return getDueFlashcards(repertoire.id).length;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <h1>♟️ Chess Opening Trainer</h1>
        <p className="subtitle">Master your repertoire with spaced repetition</p>
      </header>

      <div className="upload-section">
        <label htmlFor="pgn-upload" className="upload-button">
          {isUploading ? (
            <span className="uploading">📤 Processing...</span>
          ) : (
            <>
              <span className="upload-icon">📁</span>
              <span>Upload PGN File</span>
            </>
          )}
        </label>
        <input
          id="pgn-upload"
          type="file"
          accept=".pgn"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="file-input"
        />
        {uploadError && <div className="error-message">{uploadError}</div>}
      </div>

      <div className="repertoires-section">
        {repertoires.length === 0 ? (
          <div className="empty-state">
            <p>No repertoires yet</p>
            <p className="empty-hint">Upload a PGN file to get started</p>
          </div>
        ) : (
          <div className="repertoires-list">
            {repertoires.map((repertoire) => {
              const dueCount = getDueCount(repertoire);
              return (
                <div
                  key={repertoire.id}
                  className="repertoire-card"
                  onClick={() => onStartStudy(repertoire.id)}
                >
                  <div className="repertoire-header">
                    <h3 className="repertoire-name">{repertoire.name}</h3>
                    {dueCount > 0 && (
                      <span className="due-badge">{dueCount} due</span>
                    )}
                  </div>

                  <div className="repertoire-stats">
                    <div className="stat">
                      <span className="stat-label">Total Cards</span>
                      <span className="stat-value">{repertoire.totalCards}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Accuracy</span>
                      <span className="stat-value">{repertoire.stats.accuracy}%</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Streak</span>
                      <span className="stat-value">
                        🔥 {repertoire.streak}
                        {repertoire.longestStreak > 0 && (
                          <span className="stat-subvalue"> (best: {repertoire.longestStreak})</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {repertoire.lastStudied && (
                    <div className="last-studied">
                      Last studied: {formatDate(repertoire.lastStudied)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
