// SM-2 Spaced Repetition Algorithm (like Anki)
// Based on SuperMemo 2 algorithm

import type { SM2Result } from '../types';

/**
 * Calculate next review parameters using SM-2 algorithm
 * @param quality - 0 (incorrect) or 1 (correct)
 * @param easinessFactor - Current easiness factor (default: 2.5)
 * @param interval - Current interval in days (default: 0)
 * @param repetitions - Number of consecutive correct answers (default: 0)
 * @returns Updated SM-2 parameters
 */
export function calculateSM2(
  quality: number,
  easinessFactor: number = 2.5,
  interval: number = 0,
  repetitions: number = 0
): SM2Result {
  let newEasinessFactor = easinessFactor;
  let newInterval = interval;
  let newRepetitions = repetitions;

  // Update easiness factor based on quality
  // For binary (correct/incorrect), we treat correct as quality 4 and incorrect as quality 0
  const adjustedQuality = quality === 1 ? 4 : 0;

  newEasinessFactor = Math.max(
    1.3,
    easinessFactor + (0.1 - (5 - adjustedQuality) * (0.08 + (5 - adjustedQuality) * 0.02))
  );

  if (quality === 0) {
    // Incorrect answer - reset repetitions and interval
    newRepetitions = 0;
    newInterval = 1; // Review tomorrow
  } else {
    // Correct answer
    newRepetitions += 1;

    if (newRepetitions === 1) {
      newInterval = 1; // Review in 1 day
    } else if (newRepetitions === 2) {
      newInterval = 6; // Review in 6 days
    } else {
      newInterval = Math.round(interval * newEasinessFactor);
    }
  }

  return {
    easinessFactor: newEasinessFactor,
    interval: newInterval,
    repetitions: newRepetitions,
  };
}

/**
 * Check if a flashcard is due for review
 * @param nextReviewDate - Timestamp of next scheduled review
 * @returns true if card is due
 */
export function isDue(nextReviewDate: number): boolean {
  return Date.now() >= nextReviewDate;
}

/**
 * Get the next review date timestamp
 * @param intervalDays - Number of days until next review
 * @returns Timestamp for next review
 */
export function getNextReviewDate(intervalDays: number): number {
  return Date.now() + intervalDays * 24 * 60 * 60 * 1000;
}
