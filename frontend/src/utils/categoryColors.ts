import type { Category } from '@/types/domain';

export const CATEGORY_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#eab308', '#ec4899', '#f97316', '#ef4444', '#14b8a6', '#f43f5e', '#84cc16'];

export function categoryColor(category: Pick<Category, 'id' | 'color'>) {
  return category.color || CATEGORY_COLORS[category.id % CATEGORY_COLORS.length];
}
