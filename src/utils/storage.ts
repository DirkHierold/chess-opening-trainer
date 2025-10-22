// LocalStorage management for repertoires and flashcards

import type { Repertoire, Flashcard } from '../types';

const STORAGE_KEY = 'chess-opening-trainer';

interface StorageData {
  repertoires: Repertoire[];
  version: number;
}

/**
 * Get all stored data from LocalStorage
 */
function getStorageData(): StorageData {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to read from LocalStorage:', error);
  }

  return {
    repertoires: [],
    version: 1,
  };
}

/**
 * Save data to LocalStorage
 */
function saveStorageData(data: StorageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to write to LocalStorage:', error);
  }
}

/**
 * Get all repertoires
 */
export function getAllRepertoires(): Repertoire[] {
  return getStorageData().repertoires;
}

/**
 * Get a specific repertoire by ID
 */
export function getRepertoire(id: string): Repertoire | undefined {
  const data = getStorageData();
  return data.repertoires.find(r => r.id === id);
}

/**
 * Save a new repertoire
 */
export function saveRepertoire(repertoire: Repertoire): void {
  const data = getStorageData();
  const existingIndex = data.repertoires.findIndex(r => r.id === repertoire.id);

  if (existingIndex >= 0) {
    data.repertoires[existingIndex] = repertoire;
  } else {
    data.repertoires.push(repertoire);
  }

  saveStorageData(data);
}

/**
 * Delete a repertoire
 */
export function deleteRepertoire(id: string): void {
  const data = getStorageData();
  data.repertoires = data.repertoires.filter(r => r.id !== id);
  saveStorageData(data);
}

/**
 * Update a flashcard within a repertoire
 */
export function updateFlashcard(repertoireId: string, flashcard: Flashcard): void {
  const repertoire = getRepertoire(repertoireId);
  if (!repertoire) {
    console.error('Repertoire not found:', repertoireId);
    return;
  }

  const cardIndex = repertoire.flashcards.findIndex(c => c.id === flashcard.id);
  if (cardIndex >= 0) {
    repertoire.flashcards[cardIndex] = flashcard;
    saveRepertoire(repertoire);
  }
}

/**
 * Get due flashcards for a repertoire (cards that need review)
 */
export function getDueFlashcards(repertoireId: string): Flashcard[] {
  const repertoire = getRepertoire(repertoireId);
  if (!repertoire) {
    return [];
  }

  const now = Date.now();
  return repertoire.flashcards.filter(card => card.nextReviewDate <= now);
}

/**
 * Update repertoire stats after a study session
 */
export function updateRepertoireStats(
  repertoireId: string,
  correctCount: number,
  incorrectCount: number,
  streakBroken: boolean
): void {
  const repertoire = getRepertoire(repertoireId);
  if (!repertoire) {
    return;
  }

  repertoire.lastStudied = Date.now();
  repertoire.stats.totalReviews += correctCount + incorrectCount;
  repertoire.stats.correctReviews += correctCount;
  repertoire.stats.accuracy =
    repertoire.stats.totalReviews > 0
      ? Math.round((repertoire.stats.correctReviews / repertoire.stats.totalReviews) * 100)
      : 0;

  if (streakBroken) {
    repertoire.streak = 0;
  } else {
    repertoire.streak += correctCount;
  }

  if (repertoire.streak > repertoire.longestStreak) {
    repertoire.longestStreak = repertoire.streak;
  }

  saveRepertoire(repertoire);
}

/**
 * Clear all stored data (for debugging/testing)
 */
export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
