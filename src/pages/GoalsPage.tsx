import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Target, X } from "lucide-react";
import { goals as goalsApi } from "../lib/api";
import type { Goal } from "../lib/api";

const CATEGORIES = [
  "RETIREMENT",
  "EDUCATION",
  "HOME",
  "EMERGENCY",
  "TRAVEL",
  "INVESTMENT",
  "OTHER",
];

const CATEGORY_COLORS: Record<string, string> = {
  RETIREMENT: "bg-purple-50 text-purple-700",
  EDUCATION: "bg-blue-50 text-blue-700",
  HOME: "bg-amber-50 text-amber-700",
  EMERGENCY: "bg-red-50 text-red-700",
  TRAVEL: "bg-teal-50 text-teal-700",
  INVESTMENT: "bg-primary-50 text-primary-700",
  OTHER: "bg-gray-50 text-gray-700",
};

export default function GoalsPage() {
  const [goalsList, setGoalsList] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState("INVESTMENT");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = () => {
    goalsApi
      .list()
      .then(({ goals }) => setGoalsList(goals))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const resetForm = () => {
    setTitle("");
    setTargetAmount("");
    setCurrentAmount("");
    setDeadline("");
    setCategory("INVESTMENT");
    setFormError("");
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setTitle(goal.title);
    setTargetAmount(String(goal.targetAmount));
    setCurrentAmount(String(goal.currentAmount));
    setDeadline(goal.deadline ? goal.deadline.split("T")[0] : "");
    setCategory(goal.category);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const data = {
        title,
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount || "0"),
        deadline: deadline ? new Date(deadline).toISOString() : null,
        category,
      };

      if (editing) {
        const { goal } = await goalsApi.update(editing.id, data);
        setGoalsList((prev) =>
          prev.map((g) => (g.id === goal.id ? goal : g))
        );
      } else {
        const { goal } = await goalsApi.create(data);
        setGoalsList((prev) => [goal, ...prev]);
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this goal?")) return;
    try {
      await goalsApi.delete(id);
      setGoalsList((prev) => prev.filter((g) => g.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const formatAmount = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Goals</h1>
          <p className="text-gray-500 mt-1">
            Track your savings targets and progress
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          Add Goal
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editing ? "Edit Goal" : "New Goal"}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  placeholder="e.g., Buy a house in Bangalore"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Amount
                  </label>
                  <input
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    required
                    min="1"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                    placeholder="50,00,000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Saved So Far
                  </label>
                  <input
                    type="number"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.charAt(0) + c.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? "Saving..."
                  : editing
                    ? "Update Goal"
                    : "Create Goal"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Goals grid */}
      {goalsList.length === 0 ? (
        <div className="text-center py-16">
          <Target size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            No goals yet
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Set your first savings goal to start tracking progress
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goalsList.map((goal) => {
            const progress = goal.targetAmount > 0
              ? Math.min(
                  100,
                  Math.round((goal.currentAmount / goal.targetAmount) * 100)
                )
              : 0;

            return (
              <div
                key={goal.id}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[goal.category] || CATEGORY_COLORS.OTHER}`}
                    >
                      {goal.category.charAt(0) +
                        goal.category.slice(1).toLowerCase()}
                    </span>
                    <h3 className="text-base font-semibold text-gray-900 mt-2">
                      {goal.title}
                    </h3>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(goal)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">
                      {formatAmount(goal.currentAmount)}
                    </span>
                    <span className="font-medium text-gray-900">
                      {formatAmount(goal.targetAmount)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{progress}% achieved</p>
                </div>

                {goal.deadline && (
                  <p className="text-xs text-gray-400">
                    Deadline:{" "}
                    {new Date(goal.deadline).toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
