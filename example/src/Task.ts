import { Model } from '@nozbe/watermelondb';
import { field, table } from '@nozbe/watermelondb/decorators';

/**
 * Minimal model to verify WatermelonDB + JSI works end-to-end.
 */
@table('tasks')
export class Task extends Model {
  static table = 'tasks' as const;

  @field('name')
  name!: string;

  @field('is_completed')
  isCompleted!: boolean;
}
