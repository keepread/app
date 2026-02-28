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
import { FolderOpen, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClick}>
          <PanelRightClose className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <span>Hide right panel</span>
        <kbd className="ml-2 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">]</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

function scrollToHighlight(highlightId: string) {
  const mark = document.querySelector(`mark[data-highlight-id="${highlightId}"]`);
  if (!mark) return;
  mark.scrollIntoView({ behavior: "smooth", block: "center" });
  mark.classList.add("highlight-pulse");
  setTimeout(() => mark.classList.remove("highlight-pulse"), 1600);
}

interface RightSidebarProps {
  forceVisible?: boolean;
}

export function RightSidebar({ forceVisible = false }: RightSidebarProps) {
  const { rightPanelVisible, toggleRightPanel, selectedDocumentId, hoveredDocumentId } = useApp();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlDocId = searchParams.get("doc");
  const selectedId = urlDocId || hoveredDocumentId || selectedDocumentId;
  const { document: doc } = useDocument(selectedId);
  const { highlights } = useHighlightsForDocument(selectedId);
  const { collections: docCollections } = useCollectionsForDocument(selectedId);

  const isTagsPage = pathname === "/tags";
  const { tags, mutate: mutateTags } = useTags();

  const isFeedsPage = pathname === "/feeds";
  const { feeds, mutate: mutateFeeds } = useFeeds();

  if (!rightPanelVisible && !forceVisible) return null;

  // On tags page, show tag info instead of document info
  if (isTagsPage) {
    const selectedTagId = searchParams.get("tag");
    const selectedTag = tags.find((t) => t.id === selectedTagId) || null;
    return (
      <aside className="flex h-full w-[296px] flex-shrink-0 flex-col border-l bg-background">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="text-sm font-semibold">Tag Details</h3>
          <CloseButton onClick={toggleRightPanel} />
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
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="text-sm font-semibold">Feed Details</h3>
          <CloseButton onClick={toggleRightPanel} />
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
        <div className="flex items-center border-b">
          <TabsList className="flex-1 flex h-auto rounded-none bg-transparent p-0 px-4">
            <TabsTrigger
              value="info"
              className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-3 mr-5 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent"
            >
              Info
            </TabsTrigger>
            <TabsTrigger
              value="notebook"
              className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent"
            >
              Notebook
              {highlights.length > 0 && (
                <span className="ml-1 text-[10px] bg-primary/10 text-primary rounded-full px-1.5">
                  {highlights.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="px-4 pb-1 pt-2">
            <CloseButton onClick={toggleRightPanel} />
          </div>
        </div>
        <TabsContent value="info" className="flex-1 overflow-y-auto">
          {doc ? (
            <div className="space-y-0">
              {/* Cover image */}
              {doc.cover_image_url && (
                <div className="w-full aspect-[16/9] bg-muted overflow-hidden">
                  <img
                    src={`/api/covers/${doc.id}`}
                    alt=""
                    className="size-full object-cover"
                    onError={(e) => {
                      const parent = (e.target as HTMLElement).parentElement;
                      if (parent) parent.style.display = "none";
                    }}
                  />
                </div>
              )}
            <div className="p-4 space-y-6">
              {/* Title */}
              <div>
                <h2 className="text-sm font-semibold leading-snug">
                  {doc.title}
                </h2>
                {doc.url && (
                  <div className="flex items-center gap-1.5 mt-1">
                    {doc.favicon_url && (
                      <img
                        src={doc.favicon_url}
                        alt=""
                        className="size-3.5 rounded-sm flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {extractDomain(doc.url)}
                    </p>
                  </div>
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
