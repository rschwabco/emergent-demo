"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES = [
  { value: "all", label: "All roles" },
  { value: "system", label: "System" },
  { value: "user", label: "User" },
  { value: "assistant", label: "Assistant" },
  { value: "tool", label: "Tool" },
] as const;

const PROJECTS = [
  { value: "all", label: "All projects" },
  { value: "django", label: "Django" },
  { value: "scikit-learn", label: "scikit-learn" },
  { value: "matplotlib", label: "Matplotlib" },
  { value: "pytest-dev", label: "pytest" },
  { value: "sympy", label: "SymPy" },
  { value: "astropy", label: "Astropy" },
  { value: "sphinx-doc", label: "Sphinx" },
  { value: "pallets", label: "Pallets" },
] as const;

interface FilterPanelProps {
  role: string;
  project: string;
  onRoleChange: (role: string) => void;
  onProjectChange: (project: string) => void;
}

export function FilterPanel({
  role,
  project,
  onRoleChange,
  onProjectChange,
}: FilterPanelProps) {
  return (
    <div className="flex items-center gap-2">
      <Select value={role} onValueChange={onRoleChange}>
        <SelectTrigger size="sm" className="text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={project} onValueChange={onProjectChange}>
        <SelectTrigger size="sm" className="text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROJECTS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
