import { useState, useEffect } from "react";
import { getConfig, saveConfig, testConnection } from "@/lib/api-client";

export function App() {
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "testing" | "connected" | "failed">("idle");

  useEffect(() => {
    getConfig().then((config) => {
      if (config) {
        setApiUrl(config.apiUrl);
        setApiKey(config.apiKey);
      }
    });
  }, []);

  const handleSave = async () => {
    setStatus("saving");
    await saveConfig({ apiUrl, apiKey });
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  };

  const handleTest = async () => {
    setStatus("testing");
    await saveConfig({ apiUrl, apiKey });
    const ok = await testConnection();
    setStatus(ok ? "connected" : "failed");
    setTimeout(() => setStatus("idle"), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-10">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-xl font-semibold mb-5">Focus Reader Settings</h1>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-600">API URL</span>
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://your-focus-reader.example.com"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-600">API Key</span>
          <div className="mt-1 flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your API key"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSave}
            disabled={status === "saving"}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {status === "saving" ? "Saving..." : status === "saved" ? "Saved!" : "Save"}
          </button>
          <button
            onClick={handleTest}
            disabled={status === "testing" || !apiUrl || !apiKey}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {status === "testing" ? "Testing..." : "Test Connection"}
          </button>
        </div>

        {status === "connected" && (
          <p className="mt-3 text-sm text-green-700 bg-green-50 rounded px-3 py-2">
            Connected successfully!
          </p>
        )}
        {status === "failed" && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded px-3 py-2">
            Connection failed. Check your URL and API key.
          </p>
        )}
      </div>
    </div>
  );
}
