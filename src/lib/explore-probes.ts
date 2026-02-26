export interface Probe {
  id: string;
  label: string;
  description: string;
  query: string;
}

export const PROBES: Probe[] = [
  {
    id: "debugging",
    label: "Debugging Strategies",
    description: "How agents trace bugs with print statements, logs, and inspections",
    query: "agent adding print statements and debug logs to trace a bug",
  },
  {
    id: "test-failures",
    label: "Test Failures & Fixes",
    description: "Running tests, reading failure output, and iterating on fixes",
    query: "running tests and analyzing failing test output to find the root cause",
  },
  {
    id: "code-reading",
    label: "Reading & Navigating Code",
    description: "How agents explore unfamiliar codebases to understand structure",
    query: "reading source files to understand the codebase structure and find relevant code",
  },
  {
    id: "refactoring",
    label: "Refactoring & Code Changes",
    description: "Applying multi-file patches and restructuring existing code",
    query: "refactoring code and applying a multi-file patch to fix the issue",
  },
  {
    id: "error-handling",
    label: "Error Handling",
    description: "Dealing with exceptions, edge cases, and error paths",
    query: "handling exceptions and edge cases in error paths and raising proper errors",
  },
  {
    id: "config-deps",
    label: "Configuration & Dependencies",
    description: "Fixing imports, setting up environments, and resolving dependency issues",
    query: "fixing import errors and dependency configuration issues in the project setup",
  },
  {
    id: "performance",
    label: "Performance",
    description: "Optimizing slow code paths and improving runtime efficiency",
    query: "optimizing slow code and improving performance by reducing unnecessary work",
  },
  {
    id: "verification",
    label: "Verification & Validation",
    description: "Confirming fixes work and all tests pass before finishing",
    query: "verifying the fix works correctly and all tests pass successfully",
  },
  {
    id: "reproducing",
    label: "Reproducing Issues",
    description: "Writing scripts to reproduce reported bugs before fixing them",
    query: "creating a reproduction script to confirm the reported bug exists before attempting a fix",
  },
  {
    id: "api-design",
    label: "API & Interface Design",
    description: "Designing function signatures, class interfaces, and public APIs",
    query: "designing a new function signature or class interface for a public API",
  },
];
