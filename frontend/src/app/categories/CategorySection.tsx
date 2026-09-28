import type { Category } from '@/types/domain';
import { categoryColor } from '@/utils/categoryColors';
import styles from './Categories.module.css';

export default function CategorySection({ title, kind, categories, emptyText, onEdit }: {
  title: string;
  kind: 'income' | 'expense';
  categories: Category[];
  emptyText: string;
  onEdit: (category: Category) => void;
}) {
  return <section>
    <h3 className={`${styles.groupTitle} ${kind === 'expense' ? styles.expenseTitle : styles.incomeTitle}`}>{title}</h3>
    <div className="list-container">
      {categories.map(category => <button type="button" key={category.id} className={`list-item ${styles.categoryCard}`} onClick={() => onEdit(category)}>
        <span className={styles.colorStripe} style={{ background: categoryColor(category) }} />
        <span className={styles.categoryEmoji}>{category.emoji || '📝'}</span>
        <span className={styles.categoryName}>{category.name}</span>
      </button>)}
      {categories.length === 0 && <p className={styles.empty}>{emptyText}</p>}
    </div>
  </section>;
}
