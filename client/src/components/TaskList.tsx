import { useTasks, useDeleteTask } from '../hooks/useTasks.js';

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-gray-100 text-gray-600',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-red-100 text-red-700',
};

export function TaskList() {
  const { data: tasks, isLoading } = useTasks();
  const { mutate: deleteTask } = useDeleteTask();

  if (isLoading) return <div className="text-gray-400 text-sm">Loading tasks…</div>;
  if (!tasks?.length) return <div className="text-gray-400 text-sm">No tasks yet. Add one above.</div>;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div key={task.id} className="bg-white rounded-xl shadow p-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-800 truncate">{task.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[1]}`}>
                P{task.priority}
              </span>
              {task.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{task.category}</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {task.durationMin} min · {task.weeklyGoal}× per week
            </p>
          </div>
          <button
            onClick={() => deleteTask(task.id)}
            className="text-gray-300 hover:text-red-400 transition text-lg leading-none shrink-0"
            title="Delete task"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
