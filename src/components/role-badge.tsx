import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const roleConfig: Record<string, { label: string; className: string }> = {
  system: {
    label: "System",
    className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/25",
  },
  user: {
    label: "User",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25",
  },
  assistant: {
    label: "Assistant",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  },
  tool: {
    label: "Tool",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
  },
};

export function RoleBadge({ role }: { role: string }) {
  const config = roleConfig[role] ?? {
    label: role,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("text-[11px]", config.className)}>
      {config.label}
    </Badge>
  );
}
