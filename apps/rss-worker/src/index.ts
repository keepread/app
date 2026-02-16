import { pollDueFeeds } from "@focus-reader/api";

export interface Env {
  FOCUS_DB: D1Database;
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const db = env.FOCUS_DB;
    const results = await pollDueFeeds(db);

    const processed = results.filter((r) => r.success).length;
    const errors = results.length - processed;
    console.log(
      `RSS poll complete: ${processed} feeds processed, ${errors} errors`
    );
  },
} satisfies ExportedHandler<Env>;
