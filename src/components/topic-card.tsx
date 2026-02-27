"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RoleBadge } from "@/components/role-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import type { SearchHit } from "@/components/search-results";

function truncate(text: string, maxLen = 120) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

export interface TopicData {
  id: string;
  label: string;
  description: string;
  query: string;
  hits: SearchHit[];
}

export function TopicCard({
  topic,
  onClick,
}: {
  topic: TopicData;
  onClick: (topic: TopicData) => void;
}) {
  return (
    <Card
      className="group cursor-pointer py-4 transition-colors hover:border-ring/50"
      onClick={() => onClick(topic)}
    >
      <CardHeader className="gap-1 pb-0">
        <CardTitle className="text-sm">{topic.label}</CardTitle>
        <CardDescription className="text-xs">
          {topic.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mt-1 space-y-2">
          {topic.hits.slice(0, 3).map((hit) => (
            <div
              key={hit.id}
              className="bg-muted/40 rounded-md px-3 py-2 text-xs"
            >
              <div className="mb-1 flex items-center gap-1.5">
                <RoleBadge role={hit.role} />
                <span className="text-muted-foreground">
                  {hit.framework}/{hit.trace}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {truncate(hit.chunkText)}
              </p>
            </div>
          ))}
        </div>
        <div className="text-muted-foreground mt-3 flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
          Explore topic <ArrowRight className="size-3" />
        </div>
      </CardContent>
    </Card>
  );
}

export function TopicCardSkeleton() {
  return (
    <Card className="py-4">
      <CardHeader className="gap-1 pb-0">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent>
        <div className="mt-1 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted/40 rounded-md px-3 py-2">
              <Skeleton className="mb-1 h-3 w-24" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
