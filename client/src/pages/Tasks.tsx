import { TaskForm } from '../components/TaskForm.js';
import { TaskList } from '../components/TaskList.js';

export function Tasks() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
      <TaskForm />
      <TaskList />
    </div>
  );
}
