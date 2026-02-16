"use client";

import { useApp } from "@/contexts/app-context";
import { useDocument } from "@/hooks/use-documents";
import { useHighlightsForDocument } from "@/hooks/use-highlights";
import { useSearchParams, usePathname } from "next/navigation";
import { timeAgo, formatDate, capitalize } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { extractDomain } from "@focus-reader/shared";
import { NotebookHighlightCard } from "@/components/reader/notebook-highlight-card";
import { useCollectionsForDocument } from "@/hooks/use-collections";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { TagInfoPanel } from "@/components/tags/tag-info-panel";
import { useTags } from "@/hooks/use-tags";
import { FeedInfoPanel } from "@/components/feeds/feed-info-panel";
import { useFeeds } from "@/hooks/use-feeds";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground font-medium">{value}</dd>
    </div>
  );
}

function scrollToHighlight(highlightId: string) {
  const mark = document.querySelector(`mark[data-highlight-id="${highlightId}"]`);
  if (!mark) return;
  mark.scrollIntoView({ behavior: "smooth", block: "center" });
  mark.classList.add("highlight-pulse");
  setTimeout(() => mark.classList.remove("highlight-pulse"), 1600);
}

export function RightSidebar() {
  const { rightPanelVisible, selectedDocumentId } = useApp();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlDocId = searchParams.get("doc");
  const selectedId = urlDocId || selectedDocumentId;
  const { document: doc } = useDocument(selectedId);
  const { highlights } = useHighlightsForDocument(selectedId);
  const { collections: docCollections } = useCollectionsForDocument(selectedId);

  const isTagsPage = pathname === "/tags";
  const { tags, mutate: mutateTags } = useTags();

  const isFeedsPage = pathname === "/feeds";
  const { feeds, mutate: mutateFeeds } = useFeeds();

  if (!rightPanelVisible) return null;

  // On tags page, show tag info instead of document info
  if (isTagsPage) {
    const selectedTagId = searchParams.get("tag");
    const selectedTag = tags.find((t) => t.id === selectedTagId) || null;
    return (
      <aside className="flex h-full w-[296px] flex-shrink-0 flex-col border-l bg-background">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold">Tag Details</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          <TagInfoPanel tag={selectedTag} onMutate={mutateTags} />
        </div>
      </aside>
    );
  }

  // On feeds page, show feed info instead of document info
  if (isFeedsPage) {
    const selectedFeedId = searchParams.get("feed");
    const selectedFeed = feeds.find((f) => f.id === selectedFeedId) || null;
    return (
      <aside className="flex h-full w-[296px] flex-shrink-0 flex-col border-l bg-background">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold">Feed Details</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          <FeedInfoPanel feed={selectedFeed} onMutate={mutateFeeds} />
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[296px] flex-shrink-0 flex-col border-l bg-background">
      <Tabs defaultValue="info" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="notebook">
            Notebook
            {highlights.length > 0 && (
              <span className="ml-1 text-[10px] bg-primary/10 text-primary rounded-full px-1.5">
                {highlights.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="flex-1 overflow-y-auto">
          {doc ? (
            <div className="p-4 space-y-6">
              {/* Title */}
              <div>
                <h2 className="text-sm font-semibold leading-snug">
                  {doc.title}
                </h2>
                {doc.url && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {extractDomain(doc.url)}
                  </p>
                )}
              </div>

              {/* Author */}
              {doc.author && (
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {doc.author.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{doc.author}</p>
                    {doc.site_name && (
                      <p className="text-xs text-muted-foreground">
                        {doc.site_name}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {doc.tags.length > 0 && (
                <div>
                  <SectionHeading>TAGS</SectionHeading>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {doc.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{
                            backgroundColor: tag.color || "#6366f1",
                          }}
                        />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Collections */}
              {docCollections.length > 0 && (
                <div>
                  <SectionHeading>COLLECTIONS</SectionHeading>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {docCollections.map((col) => (
                      <Link
                        key={col.id}
                        href={`/collections/${col.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20 transition-colors"
                      >
                        <FolderOpen className="size-3" />
                        {col.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div>
                <SectionHeading>METADATA</SectionHeading>
                <dl className="mt-2 space-y-2">
                  <MetadataRow label="Type" value={capitalize(doc.type)} />
                  {doc.url && (
                    <MetadataRow
                      label="Domain"
                      value={extractDomain(doc.url)}
                    />
                  )}
                  {doc.published_at && (
                    <MetadataRow
                      label="Published"
                      value={formatDate(doc.published_at)}
                    />
                  )}
                  <MetadataRow
                    label="Length"
                    value={`${doc.reading_time_minutes} mins (${doc.word_count} words)`}
                  />
                  <MetadataRow
                    label="Saved"
                    value={timeAgo(doc.saved_at)}
                  />
                  <MetadataRow
                    label="Progress"
                    value={`${Math.round(doc.reading_progress)}%`}
                  />
                </dl>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <p className="text-sm text-muted-foreground">
                Select a document to see its details
              </p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="notebook" className="flex-1 overflow-y-auto">
          {highlights.length > 0 ? (
            <div className="p-3 space-y-2">
              {highlights.map((h) => (
                <NotebookHighlightCard
                  key={h.id}
                  highlight={h}
                  onClick={() => scrollToHighlight(h.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <p className="text-sm text-muted-foreground">
                {selectedId
                  ? "No highlights yet. Select text to highlight."
                  : "Select a document to see its highlights."}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
