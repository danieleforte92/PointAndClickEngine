# How to review project changes with Git

This guide shows how to review a Point & Click Engine project without giving
the editor control of your Git repository. It assumes the project directory is
already inside a Git worktree.

## Initialize an existing project

New projects already contain a history baseline. For an existing project, run:

```powershell
pnpm history init path/to/project
```

Commit the generated `.pointclick/changes/` baseline with the project. It is
metadata only: the JSON project documents remain authoritative.

## Review an editor edit

Save a scene, flow, asset, locale, or workflow change in the editor. The editor
writes one new `.change.json` record alongside the affected JSON documents.

```powershell
git status --short
pnpm history list path/to/project
git diff -- path/to/project
```

Review the content diff and its matching change record together. The record
lists the authoring scope, operation, impacted documents, and before/after
hashes; it never stores provider credentials.

## Compare two project snapshots

Check out the compared commits into separate worktrees, then run:

```powershell
pnpm project:diff path/to/project-before path/to/project-after
```

The command reports added, removed, and changed project documents by their
semantic kind and stable ID. Use the normal Git workflow for branches, commits,
merges, and conflict resolution.

## Inspect one recorded change

Use either its sequence number or UUID:

```powershell
pnpm project:impact path/to/project 12
```

This lists the documents directly affected by that authoring command. If a
project is changed outside the editor, commit the JSON change normally; Git is
still the final audit trail.
