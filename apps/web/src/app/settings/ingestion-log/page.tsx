"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { IngestionLog } from "@focus-reader/shared";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function IngestionLogPage() {
  const { data: logs, isLoading } = useSWR("/api/ingestion-log", (url: string) =>
    apiFetch<IngestionLog[]>(url)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Ingestion Log</h1>
        <p className="text-sm text-muted-foreground">
          Recent email ingestion events.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      )}

      {!isLoading && (!logs || logs.length === 0) && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No ingestion events yet.
        </p>
      )}

      {logs && logs.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Time</th>
                <th className="px-4 py-2 text-left font-medium">Channel</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Error</th>
                <th className="px-4 py-2 text-right font-medium">Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {formatDate(log.received_at)}
                  </td>
                  <td className="px-4 py-2">{log.channel_type}</td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={log.status === "success" ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {log.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">
                    {log.error_detail || log.error_code || "—"}
                  </td>
                  <td className="px-4 py-2 text-right">{log.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
