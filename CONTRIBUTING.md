# Contributing

How changes get into `main`, and why that way. Written after the first vertical slice
landed, so the examples are real.

Setup, prerequisites and how to run the app live in the [README](README.md). This file
covers everything from a working checkout to a merged commit.

---

## Before you start

**Enable the commit-message hook**, once per clone:

```bash
git config core.hooksPath .githooks
```

`.githooks/commit-msg` checks the header against the convention below — type, scope, the
72-character limit. It is dependency-free and deliberately checks only what a machine can
judge. Whether the body explains *why* stays a human's job. `--no-verify` bypasses it, for
the rare case you mean to.

**Know what "green" means here** before you commit anything: see
[every commit builds](#the-second-mandatory-rule-every-commit-builds).

---

## The short version

```bash
git switch main
git pull --ff-only                  # if a remote is configured
git switch -c feat/<topic>          # feature work never goes straight to main
# ... work ...
git add <one logical group>
git diff --cached                   # ALWAYS read the diff before committing
git commit -F <message-file>        # repeat per logical group

git switch main
git pull --ff-only
git merge --no-ff --no-commit feat/<topic>
# verify the build here — see "every commit builds"
git commit -F <merge-message-file>
git branch -d feat/<topic>
```

`--ff-only` keeps `git pull` from quietly inventing a merge commit when the histories have
diverged. If it refuses, deal with the divergence deliberately.

**Exception:** a single-file `docs:` or `chore:` change that touches no code and needs no
build may go straight to `main`. Anything that could break a build, or that spans more than
one commit, goes on a branch.

Three questions answer everything else:

1. **Does every commit leave `api/openapi.yaml` and its two consumers consistent?** — the
   invariant that decides how you may split. See below.
2. **Would I ever want to revert this part alone?** — if yes, it is its own commit.
3. **Does the merge commit explain the feature, not the edits?** — that is what it is for.

---

## The central invariant: contract consistency

`api/openapi.yaml` is the single file both builds read. The backend generates its API
interfaces from it; the frontend generates `lib/api/schema.d.ts` from it. **No commit may
leave a consumer calling something the contract does not define.**

This decides whether a change may be split across commits:

| Contract change | Split allowed? | Why |
| --- | --- | --- |
| **Additive** — new path, new schema, new optional property | Yes | A consumer may lag behind. The old client still compiles against the new contract. |
| **Breaking** — renamed field, removed operation, new required property, changed type | **No — one atomic commit** | Any intermediate state may fail to compile, send an invalid request, or misinterpret a response. |

**Enum additions need a decision, not a reflex.** A new value in a *request* enum is
additive — existing clients simply never send it. A new value in a *response* enum reaches
consumers that may not handle it: Jackson rejects unknown enum values by default, and an
exhaustive `switch` over the generated TypeScript union falls through silently. This repo has
`MarketplaceRole` and `RegistrationIntent` on the wire. Treat a response-side addition as
breaking unless every consumer is known to tolerate unknown values.

**Compatible is not the same as complete.** Every commit must build, and must not call
anything the contract does not define. No commit has to *use* everything the contract offers
— a new operation may sit unconsumed for a commit or two. Exactly that gap is what makes an
additive change splittable.

This is exactly what a monorepo is *for*: it makes the atomic cross-language commit
possible. Splitting is a convenience the additive case allows, not a default.

### An operation and its implementation cannot be split

`backend/pom.xml` sets `skipDefaultInterface=true`, so generated API interfaces contain only
abstract methods. **Adding an operation, or changing parameters or return types in a way that
changes the generated Java interface, requires the matching controller change in the same
commit** — otherwise the backend does not compile. The same holds for model changes the
controllers touch.

Contract edits that generate nothing the backend must match — prose and `description`
changes, an unreferenced schema — carry no such coupling and may stand alone.

---

## The second mandatory rule: every commit builds

Contract consistency decides *how* you may split. This one holds for every commit regardless:

```bash
(cd backend && ./mvnw verify)                   # Docker must be running — Testcontainers
pnpm install --frozen-lockfile && pnpm build
```

Neither needs a secret. `application.yml` defaults the WorkOS client id and the backend tests
mock the token, so `verify` runs on a bare checkout with Docker. The frontend reads
`frontend/.env.local` — copy it from `frontend/.env.example` once.

`--frozen-lockfile` fails when `package.json` and `pnpm-lock.yaml` disagree — the check a CI
would run, and the reason a dependency change and its lockfile update belong in one commit.

**Verify again after the merge, before committing it.** Every commit on the branch can pass
while the merge with a moved `main` fails — a semantic conflict git cannot see, because the
textual merge succeeded. If it does:

```bash
git merge --abort
```

then fix the topic branch and merge again.

There is no CI (deliberately deferred). Nothing enforces any of this but you.

---

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org). Chosen because its optional
*scope* maps cleanly onto domain modules, which is what keeps history filterable in a
polyglot monorepo, and because common JavaScript release tooling can read it should we ever
want automated versioning.

```
type(scope): imperative summary, no trailing period

Body wrapped at 72 characters. Explains WHY, not what — the what is in
the diff. State the problem first, then the fix.

Optional trailers at the end.
```

**Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `chore`.

**Scope is the domain module, not the language.** `identity`, `portal`, `job`, `auth` — not
`backend`, `frontend`. A vertical slice crosses languages; `backend:` tells you only *where*
a file sits, which git already knows from the path. Use `build`/`chore` for tooling.

**Header ≤ 72 characters** including the scope. Body wrapped at 72.

Good bodies answer: what was wrong, why the obvious alternative was rejected, what a
reviewer would otherwise assume incorrectly, and why an odd-looking hunk is in the diff.

### Breaking changes

Mark them twice — in the header and in a footer:

```
feat(identity)!: require a legal name during registration

Registration accepted profiles without a legal name, so identity
verification could receive an incomplete one. Require it.

BREAKING CHANGE: RegistrationRequest now requires legalName.
```

The `!` makes it visible in `git log --oneline`; the footer says what breaks and for whom.

A breaking **contract** change is also the case that may not be split — see the invariant
above. The marking and the splitting rule describe the same thing from two angles.

### Writing multi-line messages on Windows

Quoting multi-line strings in PowerShell and Git Bash is error-prone. Write the message to a
file and use `-F`:

```bash
git commit -F /path/to/message.txt
```

---

## How to split a change

Split by **revert profile**, not by language or by directory:

- **Bugfixes to existing code go first, alone.** They are independent of the feature, ship
  value on their own, and stay cherry-pickable.
- **Producer before consumer.** The contract plus its backend implementation, then the
  frontend that calls it. Never the other way round — the consumer commit would not build.
- **Tooling changes** (scripts, deps, generators) either stand alone or ride with the code
  that needs them. A dependency declaration and its lockfile update always belong in the
  same commit.
- **Documentation follows what it documents.** Docs that *describe* a change ride with that
  change — the README section on WorkOS setup shipped inside `feat(portal)`, because without
  that commit the instructions describe nothing. Docs that stand on their own get their own
  commit: this file did, because it applies to every future change and to no particular one.

**Commit size is not a quality signal.** A one-file `docs:` commit is not too small — the
Linux kernel and the Git project are full of them. The expensive mistake runs the other way:
a commit mixing two unrelated things cannot be reverted or reviewed cleanly, however
convenient bundling them felt at the time.

---

## Why a branch and a merge commit, not commits straight on `main`

**A branch keeps mistakes local.** Reordering, amending or dropping a commit on a topic
branch is a non-event. The same operation on `main` rewrites the history others pull.
`main` stays at a known-good state the whole time you are building.

**The merge commit makes the feature a thing that exists in the history.** Without it, a
feature is just N commits that happen to be adjacent, and nothing records that they belong
together. With it:

| You want to… | Linear history | With merge commit |
| --- | --- | --- |
| revert the whole feature | N commits, in the right order | `git revert -m 1 <merge>` — one command, though later dependent changes can still conflict |
| see what happened on `main` | a list of edits | `git log --first-parent` — one line per feature |
| know *why* the feature exists | scattered across N messages | in the merge message |

So the merge commit is the atomic unit the monorepo promises, while the commits underneath
keep the granularity that review and `git bisect` need. You do not have to choose.

Always `--no-ff`. A fast-forward merge produces no merge commit and loses all of this.

`git merge` has no `-F`, so use two steps when the message comes from a file:

```bash
git merge --no-ff --no-commit feat/<topic>
git commit -F <merge-message-file>
```

---

## Review and merge

Today this repo has one contributor, and the workflow above reflects that: you merge your own
topic branch into `main`.

**That changes the moment a second person commits.** Self-merging is defensible only while
nobody else is exposed to a mistake on `main`. With more than one contributor the topic
branch becomes a pull request, and someone other than the author approves it before it lands.

Everything else in this file stays exactly as it is — the split, the invariant, the merge
commit. Only the merge itself gains a second pair of eyes.

Do not read the solo workflow as this project's position on review. It is a consequence of
the head count, and it expires with it.

---

## Repo-specific traps

- **`frontend/lib/api/schema.d.ts` is generated** and gitignored. If it ever shows up in
  `git diff --cached --name-status`, something is wrong with `.gitignore`.
- **Deletions are staged automatically.** Since Git 2.0, `git add <path>` on a directory also
  records removed files; `git add -A <path>` is explicit but not required. Either way, verify
  with `git diff --cached --name-status` — a deletion appears as `D`.
- **`.env` files are ignored repo-wide.** Commit `frontend/.env.example` instead; the
  `!.env.example` exception in `frontend/.gitignore` is what allows it.
- **Docker must run** for anything that touches the backend — tests and
  `spring-boot:test-run` provision PostgreSQL through Testcontainers.
- **Never commit generated sources.** Backend generates into `target/`, frontend into
  `lib/api/`. Both are ignored.

---

## Before every commit

```bash
git status --short                  # anything forgotten or untracked?
git diff --cached --name-status     # exactly the intended files? deletions as D?
git diff --cached --check           # whitespace errors, leftover conflict markers?
git diff --cached                   # read the actual content
```

The last one is not optional. File names tell you *which* files you staged, never *what* is
in them — debug output, a stray credential and a half-finished refactor all look identical in
a name list.

Checking the staged list is the single highest-value habit here. The first slice landed with
one commit accidentally skipped: the frontend went in on top of a contract that did not yet
define the endpoint it called. The list would have shown it before the commit instead of
after.

---

## When something goes wrong

**Unpushed commits are normally recoverable for a limited time** through `git reflog` —
entries expire, so it is not an archive. **Uncommitted changes are not recoverable at all.**
`git reset --hard`, `git restore <path>` and `git clean -fd` overwrite the working tree with
no backup. Run `git status` first, and save anything you are unsure about:

```bash
git stash push -u -m "before history repair"
```

`-u` includes untracked files; ignored files stay out either way.

**The history-rewriting entries below are for unpushed, unshared commits only.**

| Situation | Fix |
| --- | --- |
| staged one file by mistake | `git restore --staged <path>` — keeps the local change |
| staged the wrong group entirely | `git reset` — unstages everything, working tree untouched |
| last commit has the wrong group of changes | `git reset HEAD~1`, restage, recommit |
| message has a typo | `git commit --amend -F <file>` |
| commits in the wrong order | `git rebase -i HEAD~<n>`, reorder the `pick` lines — unshared topic branch only |
| merge half-done | `git merge --abort` |
| merge committed, not pushed | `git reset --hard HEAD~1` — **also discards uncommitted work**; check `git status` first |

**Git Bash paste problem.** If a pasted command fails with `bash: [200~git: command not
found`, the terminal leaked a bracketed-paste escape sequence. Fix it once:

```bash
echo 'set enable-bracketed-paste off' >> ~/.inputrc
```

---

## Worked example — slice 1, identity

The change: 38 files, Java backend and Next.js frontend, one shared contract change.

```
*   c6f8482 Merge branch 'feat/tradesperson-identity'
|\
| * 7b31ae7 feat(portal): sign in tradespeople through AuthKit
| * 7d541ce feat(identity): register marketplace users
| * afb73ff fix(auth): use the client-scoped WorkOS issuer
|/
* 5932a04 Initial commit
```

Why this shape:

1. **`fix(auth)` first and alone.** A wrong issuer value was rejecting every token — a bug
   that predates the feature, useful on its own, cherry-pickable.
2. **`feat(identity)` carries the contract.** The new operation and its implementation cannot
   be separated (`skipDefaultInterface`), and the producer must precede the consumer.
3. **`feat(portal)` last.** The frontend calls `POST /api/v1/me/registration`, which only
   exists from commit 2 onward. Committed before it, `pnpm build` fails on a path that is not
   in the generated types — the mistake this ordering exists to prevent.
4. **`--no-ff` merge.** `git log --first-parent main` shows the slice as one entry;
   `git revert -m 1 c6f8482` takes backend, frontend and contract out together.

The split was legitimate only because the contract change was purely additive. A breaking one
would have had to land as a single commit.

### The merge message it shipped with

A merge message describes the *feature*, not the edits, and records why the split was
allowed. This is the real one, abridged:

```
Merge branch 'feat/tradesperson-identity'

Brings the first vertical identity slice to main: a tradesperson signs
in through WorkOS AuthKit at /portal, is registered in the marketplace,
and lands on a dashboard backed by a local user projection.

Three commits rather than one, because the parts have different revert
profiles. The issuer fix stands alone and is cherry-pickable, the
identity module is what later backend work builds on, and the portal is
the only part a UI problem should roll back.

Safe to split because the contract change is purely additive: no
intermediate commit leaves api/openapi.yaml and its two generated
clients inconsistent. A breaking contract change would have had to land
as a single commit instead.
```

Note what it does not contain: file names, function names, or a list of the commits. Those
are one `git log` away. The message carries the part that is nowhere else — why the feature
exists and why it landed in this shape.