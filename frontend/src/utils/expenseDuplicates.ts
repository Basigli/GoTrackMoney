import { ApiError } from './api';

export interface DuplicateExpenseMatch {
  id: number;
  name: string;
  description: string;
  amount: number;
  category_id: number;
  category_name: string;
  category_emoji: string;
  spent_on: string;
  is_periodic: boolean;
}

export interface DuplicateExpenseReview {
  code: 'possible_duplicate';
  matches: DuplicateExpenseMatch[];
  total: number;
}

export function readDuplicateExpenseReview(error: unknown): DuplicateExpenseReview | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  try {
    const review: DuplicateExpenseReview = JSON.parse(error.body);
    if (review.code !== 'possible_duplicate' || !Number.isInteger(review.total) || review.total < 1 ||
      !Array.isArray(review.matches) || review.matches.length === 0 ||
      !review.matches.every(match => Number.isFinite(match.amount) &&
        typeof match.category_name === 'string' && typeof match.description === 'string' &&
        typeof match.name === 'string' && Number.isFinite(Date.parse(match.spent_on)))) return null;
    return review;
  } catch {
    return null;
  }
}
