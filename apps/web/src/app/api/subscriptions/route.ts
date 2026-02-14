import { getSubscriptions } from "@focus-reader/api";
import { getDb } from "@/lib/bindings";
import { json, jsonError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const db = await getDb();
    const subscriptions = await getSubscriptions(db);
    return json(subscriptions);
  } catch {
    return jsonError("Failed to fetch subscriptions", "FETCH_ERROR", 500);
  }
}
