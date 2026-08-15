import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Task } from './Task';

/**
 * Database schema — version 1.
 * In a real app you'd evolve this with migrations.
 */
const schema = {
  version: 1,
  tables: {
    tasks: {
      columns: [
        { name: 'name', type: 'string' },
        { name: 'is_completed', type: 'boolean' },
      ],
    },
  },
} as const;

/**
 * Create the adapter with JSI enabled.
 * The expo-watermelondb-plugin configures the native JSI module
 * that makes `{ jsi: true }` work on Android.
 */
const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
  dbName: 'watermelondb-example.db',
});

export const database = new Database({
  adapter,
  modelClasses: [Task],
});
