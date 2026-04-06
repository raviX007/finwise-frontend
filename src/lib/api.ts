const API_BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// Auth
export const auth = {
  register: (data: { email: string; name: string; password: string }) =>
    request<{ user: User; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    request<{ user: User; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  me: () => request<{ user: User }>("/auth/me"),
  updateProfile: (data: { name?: string; riskAppetite?: string }) =>
    request<{ user: User }>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// Goals
export const goals = {
  list: () => request<{ goals: Goal[] }>("/goals"),
  create: (data: Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">) =>
    request<{ goal: Goal }>("/goals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Goal>) =>
    request<{ goal: Goal }>(`/goals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/goals/${id}`, { method: "DELETE" }),
};

// Chat
export const chat = {
  listSessions: () => request<{ sessions: ChatSession[] }>("/chat/sessions"),
  createSession: () =>
    request<{ session: ChatSession }>("/chat/sessions", { method: "POST" }),
  getMessages: (sessionId: string) =>
    request<{ messages: ChatMessage[] }>(`/chat/sessions/${sessionId}/messages`),
  deleteSession: (sessionId: string) =>
    request<{ message: string }>(`/chat/sessions/${sessionId}`, {
      method: "DELETE",
    }),
  stream: async function* (sessionId: string, message: string) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId, message }),
    });

    if (!res.ok) {
      throw new Error("Stream request failed");
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) return;
            if (data.content) yield data.content;
            if (data.error) throw new Error(data.error);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
  },
};

// Dashboard
export const dashboard = {
  stats: () =>
    request<{
      stats: DashboardStats;
      recentChats: { id: string; title: string; updatedAt: string }[];
    }>("/dashboard/stats"),
};

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  riskAppetite: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface DashboardStats {
  totalGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  overallProgress: number;
  goalsOnTrack: number;
  totalChatSessions: number;
  goalsByCategory: Record<string, number>;
}
