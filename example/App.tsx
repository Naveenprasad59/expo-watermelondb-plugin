import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Q } from '@nozbe/watermelondb';

import { database } from './src/database';
import { Task } from './src/Task';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [jsiStatus, setJsiStatus] = useState<string>('Checking…');

  useEffect(() => {
    // Verify JSI is working
    const adapter = database.adapter;
    // @ts-ignore — _taggedAdapterType or similar internal may not be typed
    const isJsi = (adapter as any)._options?.jsi ?? (adapter as any).jsi;
    setJsiStatus(isJsi ? 'JSI enabled ✅' : 'JSI disabled ⚠️ (using bridge)');

    // Subscribe to tasks
    const subscription = database
      .get<Task>('tasks')
      .query(Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe((fetchedTasks) => {
        setTasks(fetchedTasks);
      });

    return () => subscription.unsubscribe();
  }, []);

  const handleAddTask = useCallback(async () => {
    const name = newTaskName.trim();
    if (!name) return;

    await database.write(async () => {
      await database.get('tasks').create((task: Task) => {
        task.name = name;
        task.isCompleted = false;
      });
    });

    setNewTaskName('');
  }, [newTaskName]);

  const handleToggleTask = useCallback(async (task: Task) => {
    await database.write(async () => {
      await task.update((t) => {
        t.isCompleted = !t.isCompleted;
      });
    });
  }, []);

  const handleDeleteTask = useCallback(async (task: Task) => {
    await database.write(async () => {
      await task.markAsDeleted();
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>🍉 WatermelonDB + Expo</Text>
        <Text style={styles.jsiBadge}>{jsiStatus}</Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="New task…"
          value={newTaskName}
          onChangeText={setNewTaskName}
          onSubmitEditing={handleAddTask}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.taskRow}>
            <TouchableOpacity
              style={styles.taskContent}
              onPress={() => handleToggleTask(item)}
            >
              <Text
                style={[
                  styles.taskText,
                  item.isCompleted && styles.taskTextDone,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteTask(item)}
            >
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tasks yet. Add one above! 👆</Text>
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  jsiBadge: {
    fontSize: 13,
    color: '#666',
  },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginLeft: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 20,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  taskContent: {
    flex: 1,
  },
  taskText: {
    fontSize: 16,
    color: '#333',
  },
  taskTextDone: {
    textDecorationLine: 'line-through',
    color: '#aaa',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  deleteButtonText: {
    color: '#ff3b30',
    fontSize: 18,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
});
