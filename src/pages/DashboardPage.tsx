import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Target, MessageSquare, TrendingUp, CheckCircle } from "lucide-react";
import { dashboard } from "../lib/api";
import type { DashboardStats } from "../lib/api";
import { useAuth } from "../context/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentChats, setRecentChats] = useState<
    { id: string; title: string; updatedAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboard
      .stats()
      .then(({ stats, recentChats }) => {
        setStats(stats);
        setRecentChats(recentChats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const formatAmount = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-gray-500 mt-1">
          Here's your financial overview
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Target size={20} />}
          label="Total Goals"
          value={String(stats?.totalGoals || 0)}
          color="primary"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Target Savings"
          value={formatAmount(stats?.totalTargetAmount || 0)}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          label="Progress"
          value={`${stats?.overallProgress || 0}%`}
          color="purple"
        />
        <StatCard
          icon={<MessageSquare size={20} />}
          label="AI Conversations"
          value={String(stats?.totalChatSessions || 0)}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals by category */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Goals by Category
          </h2>
          {stats && Object.keys(stats.goalsByCategory).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.goalsByCategory).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 capitalize">
                    {cat.toLowerCase()}
                  </span>
                  <span className="text-sm font-medium bg-primary-50 text-primary-700 px-2.5 py-0.5 rounded-full">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">
              No goals yet.{" "}
              <button
                onClick={() => navigate("/goals")}
                className="text-primary-600 hover:underline"
              >
                Create your first goal
              </button>
            </p>
          )}
        </div>

        {/* Recent chats */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Conversations
          </h2>
          {recentChats.length > 0 ? (
            <div className="space-y-3">
              {recentChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => navigate("/chat")}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <MessageSquare
                    size={16}
                    className="text-gray-400 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {chat.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(chat.updatedAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">
              No conversations yet.{" "}
              <button
                onClick={() => navigate("/chat")}
                className="text-primary-600 hover:underline"
              >
                Start chatting with AI
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    primary: "bg-primary-50 text-primary-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div
        className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
