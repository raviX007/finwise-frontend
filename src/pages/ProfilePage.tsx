import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { auth as authApi } from "../lib/api";

const RISK_OPTIONS = [
  {
    value: "CONSERVATIVE",
    label: "Conservative",
    desc: "Low risk, stable returns. FDs, PPF, debt funds.",
  },
  {
    value: "MODERATE",
    label: "Moderate",
    desc: "Balanced mix of equity and debt. Hybrid funds, large-cap stocks.",
  },
  {
    value: "AGGRESSIVE",
    label: "Aggressive",
    desc: "High risk, high reward. Small-cap, mid-cap, direct equity.",
  },
];

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [riskAppetite, setRiskAppetite] = useState<"CONSERVATIVE" | "MODERATE" | "AGGRESSIVE">(
    user?.riskAppetite || "MODERATE"
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const { user: updated } = await authApi.updateProfile({
        name,
        riskAppetite,
      });
      updateUser(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile</h1>
      <p className="text-gray-500 mb-8">
        Manage your account and investment preferences
      </p>

      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">
          Profile updated successfully
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Personal Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            Risk Appetite
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            This helps the AI advisor tailor investment suggestions
          </p>

          <div className="space-y-3">
            {RISK_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  riskAppetite === opt.value
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="riskAppetite"
                  value={opt.value}
                  checked={riskAppetite === opt.value}
                  onChange={(e) => setRiskAppetite(e.target.value as "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE")}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            Account Info
          </h2>
          <div className="text-sm text-gray-500 space-y-1">
            <p>
              Member since:{" "}
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "N/A"}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
