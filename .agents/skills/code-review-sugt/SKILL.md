---
name: code-review-sugt
description: Repo-specific contract for /code-review here — its sub-agents verify by ablation, so they run in an isolated git worktree and owe the shared tree untouched on exit. Read alongside the vendored `code-review` skill for any review in this workspace.
---

# /code-review in sugt

Repo-specific contract for the `code-review` skill. That skill is vendored upstream
(hash-checked in `skills-lock.json`, so it is not edited in place) and says nothing
about whether its sub-agents may touch the working tree. Here they do, and this is
the rule that keeps that safe.

## Its sub-agents modify the working tree, and that is deliberate

Both axes — Standards and Spec — **verify claims by ablation**: they edit a file,
run `tsc`, and revert. That is the right way to check a compile-time claim, and it
is why both axes caught a false comment on [#50](https://github.com/mafiefa02/sugt/issues/50)
that a reading review would have missed. The ablation is a feature, not a lapse.

The hazard is only *where* they ablate. The vendored skill runs the axes as
sub-agents in the **same working tree** the main agent is still staging from. An
ablation sitting on disk at the instant of a `git add` is committed with everything
else.

## What that costs — a migration that looks intentional

On #50 a Spec-axis ablation — `session.status` given `.default("bogus")` to prove an
annotation order was load-bearing — was swept into an amended commit. `pnpm --filter
@sugt/db db:generate`, run afterwards as the ticket's own DDL check, saw a real schema
difference and wrote `migrations/0005_complex_karma.sql` plus a snapshot. That file
was well-formed, plausibly named, and **indistinguishable from an intentional
migration**. Applied to Supabase it would have altered a live column default. The
typecheck happened to fail and caught it — but an ablation of a comment, a reordered
chain, or a string the compiler does not check leaves a green tree, and `db:generate`
still runs.

This is the failure the contract below prevents. It is not a tidiness rule.

## The contract: ablate in a worktree

**Spawn each review sub-agent with `isolation: "worktree"`.** Each axis then ablates
inside its own temporary git checkout under `.claude/worktrees/`, and the shared tree
the main agent stages from is never touched. What the sub-agents owe on exit is **the
shared working tree exactly as they found it** — and with isolation that holds by
construction, even if a sub-agent crashes mid-ablation.

Isolation forces two things, both load-bearing, both easy to get wrong:

- **Commit the work first.** A worktree carries only committed state. The vendored
  `implement` skill reviews *before* it commits ("Once done, use /code-review… Commit
  your work"). Followed literally with isolation, the reviewers open on an empty
  branch and review **nothing** — silently, which is the same shape of failure as #54
  itself. So the order here is fixed: commit to the branch, then review.

- **Diff the branch by name, not `HEAD`.** git refuses to check out a branch already
  checked out in the main working copy, so the isolated worktree lands on `main` and
  its `HEAD` is `main`, not the branch tip. Pass each axis the branch under review and
  have it run `git diff main...<branch>`. `git diff main...HEAD` inside the worktree
  compares `main` to `main` and reviews nothing. The branch ref resolves because the
  worktree shares the repository's `.git`.

Verified under a branch one commit ahead of `main`, not under a branch that happened
to equal it: the isolated worktree opened on `main`, `git diff main...HEAD` was empty,
`git diff main...<branch>` returned the branch's files for review, and the reviewer's
edits — and even a scratch commit — never appeared in the main checkout's `git status`.

The companion rule in `AGENTS.md` — stage explicit paths, never `git add -A` — narrows
the blast radius in the shared tree and is worth keeping. It does not replace
isolation: it cannot save you when the ablated file is one your ticket also touched, so
a per-path `git add` of that file sweeps the ablation anyway. Isolate the reviewers,
and a `git add` in the shared tree has nothing of theirs to catch.
