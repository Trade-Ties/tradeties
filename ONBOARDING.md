# Your first pull request

The checklist version: what to do, in order, from a fresh clone to a merged pull request.

[CONTRIBUTING.md](CONTRIBUTING.md) and [BRANCHING.md](BRANCHING.md) explain *why* each of
these steps exists. Read them once when you have an hour. This file is what you keep open
while you work.

---

## Step 0 — Set up the clone (once)

You need Node.js >= 20.9, pnpm 11 (via Corepack), JDK 25, and Docker Desktop.

```bash
git clone <repo-url> tradeties
cd tradeties

git config core.hooksPath .githooks     # DO NOT SKIP — see below
```

Without that `git config` line your commit messages are not checked locally. They are still
checked in CI, so the only thing you gain by skipping it is finding out fifteen minutes later
instead of immediately.

Then the credentials — both sides need WorkOS, or neither starts:

```bash
cp frontend/.env.example frontend/.env.local   # fill in from the WorkOS dashboard
export WORKOS_CLIENT_ID=client_...             # backend; must match the frontend's
```

Register `http://localhost:3000/callback` as a redirect URI in the WorkOS dashboard.
Details are in the [README](README.md#getting-started).

Finally, prove the checkout is healthy before you change anything. Start Docker Desktop first
— the backend tests provision PostgreSQL through Testcontainers:

```bash
pnpm install
pnpm --filter @tradeties/frontend generate:api
pnpm lint
pnpm build
cd backend && ./mvnw verify
```

`generate:api` writes `frontend/lib/api/schema.d.ts` from `api/openapi.yaml`. That file is
generated and gitignored, so a fresh clone does not have it and the code that reads the API
types has nothing to resolve. `pnpm build` regenerates it on its own; `pnpm lint` does not.
CI generates first for that reason, and so should you.

If these fail on an untouched checkout, stop and ask. Do not start debugging your own change
on top of a broken baseline.

---

## Step 1 — Start from a fresh `main`

```bash
git switch main
git pull --ff-only
git switch -c feat/<topic>          # or fix/<topic>
```

**Never commit on `main`.** The ruleset rejects the push, including for a one-line typo fix.
Branch for that too — it costs about thirty seconds.

`--ff-only` stops `git pull` from silently creating a merge commit if your local `main` has
drifted. If it refuses, you have something local that should not be there; sort that out
first.

---

## Step 2 — Commit, one logical group at a time

For each group of changes that belongs together:

```bash
git add <paths>
git status --short                  # anything forgotten or untracked?
git diff --cached --name-status     # exactly the intended files? deletions show as D
git diff --cached                   # read the actual content — not optional
git commit -F <message-file>
```

Reading the staged diff is the highest-value habit in this repo. File names tell you *which*
files you staged, never *what* is in them — debug output, a stray credential and a
half-finished refactor all look identical in a name list.

### The message format

```
type(scope): imperative summary, no trailing period

Body wrapped at 72 characters. Explains WHY, not what — the what is in
the diff. State the problem first, then the fix.
```

| Part | Rule |
| --- | --- |
| **type** | one of `feat` `fix` `refactor` `perf` `test` `docs` `build` `chore` |
| **scope** | the domain module — `identity`, `portal`, `job`, `auth`. **Not** `backend` or `frontend`; git already knows the path |
| **header** | ≤ 72 characters including the scope, no full stop at the end |
| **body** | why this change exists, wrapped at 72 |

A real one from this repo:

```
fix(auth): use the client-scoped WorkOS issuer

Tokens were validated against the tenant issuer, so every request was
rejected as untrusted. Use the client-scoped issuer WorkOS actually
signs with.
```

**On Windows, always write the message to a file and use `-F`.** Quoting multi-line strings
in PowerShell and Git Bash is a reliable way to lose half your message.

**Breaking change?** Mark it twice — `feat(identity)!:` in the header *and* a
`BREAKING CHANGE:` footer in the body.

---

## Step 3 — Check that the commit builds

Before every commit, not just the last one:

```bash
pnpm install --frozen-lockfile
pnpm --filter @tradeties/frontend generate:api
pnpm lint
pnpm build
cd backend && ./mvnw verify         # Docker must be running
```

The same commands CI runs, in the same order. Running them locally answers in minutes what
CI answers in fifteen.

**Two rules decide whether you may split a change into several commits:**

1. **Every commit builds on its own.** Not just the branch tip.
2. **No commit may leave `api/openapi.yaml` and its two consumers inconsistent.** The backend
   generates its API interfaces from that file; the frontend generates its TypeScript types
   from it.

That second rule is the one that bites. It means:

| Your contract change | What you may do |
| --- | --- |
| **Additive** — new path, new schema, new optional property | split across commits, but always **backend before frontend** |
| **Breaking** — renamed field, removed operation, new required property, changed type, or a new value in a *response* enum | **one single commit**, backend and frontend together |

If you are unsure which one you have, treat it as breaking and keep it in one commit. The
full reasoning is in
[CONTRIBUTING.md](CONTRIBUTING.md#the-central-invariant-contract-consistency).

---

## Step 4 — Push and open the pull request

```bash
git push -u origin feat/<topic>
```

Open the pull request **against `main`** on GitHub. The template gives you four sections —
fill in all four:

| Section | What goes in |
| --- | --- |
| **Why** | what was wrong or missing, and what is true once this lands. Feature altitude, no file names |
| **Contract impact** | keep exactly one of `None` / `Additive` / `Breaking`, delete the other two |
| **How to test it** | the steps someone follows to see it work. "CI is green" is not a test plan |
| **Risk** | what breaks if this is wrong, and who notices. "Low, UI only" is a fine answer when true |

All four are the draft of your merge message — you will paste them again in step 7,
headings included, so write them properly now.

---

## Step 5 — Get CI green

Three checks must pass before the merge button unlocks:

| Check | Red means | Fix |
| --- | --- | --- |
| `frontend` | `pnpm lint` or `pnpm build` failed | reproduce locally, fix, push |
| `backend` | `./mvnw verify` failed | reproduce locally with Docker running, fix, push |
| `commit-convention` | a commit header breaks the format | `git rebase -i` and reword the offending commits, then `git push --force-with-lease` |

Force-pushing your own feature branch is fine. Never force-push `main`.

---

## Step 6 — If `main` moved while you worked

GitHub blocks the merge until your branch is up to date. Press **Update branch** on the pull
request, or:

```bash
git switch feat/<topic>
git merge main
```

**Then run both builds again on the result.** Every commit on your branch can pass, the
textual merge can succeed, and the combination still not build — a semantic conflict git
cannot see. This is exactly what that step exists to catch.

---

## Step 7 — Merge

Use **Create a merge commit**. It is the only method the repository leaves enabled — squash
and rebase are off on purpose.

GitHub's merge dialog has two fields:

- **Title** — describes the *feature*, not the edits.
- **Second field** — a full body, not a subtitle. Paste all four sections from the pull
  request, headings included. If you split the change into several commits, say why.

No file names, no function names, no list of the commits. Those are one `git log` away. The
merge message carries the part that is nowhere else.

---

## After the merge

**Merging is not shipping.** Your change is on `main`, which is the state the test
environment runs — once there is one. Nothing deploys anywhere yet, so today that is a
promise the branches make and the infrastructure does not keep.

Reaching customers is a separate, deliberate act: the **Promote to production** button under
Actions. See [BRANCHING.md](BRANCHING.md) — you do not need it for day-to-day work.

---

## Things that will bite you

- **Docker must be running** for anything touching the backend — tests and
  `spring-boot:test-run` both need it.
- **Never commit `.env` files.** They are ignored repo-wide; commit the `.env.example`
  template instead.
- **Never commit generated sources.** `frontend/lib/api/schema.d.ts` and everything under
  `backend/target/` are generated and gitignored. If one shows up in
  `git diff --cached --name-status`, something is wrong.
- **A dependency change and its lockfile update are one commit.** `--frozen-lockfile` fails
  when `package.json` and `pnpm-lock.yaml` disagree.
- **Commit size is not a quality signal.** A one-file `docs:` commit is not too small. A
  commit mixing two unrelated things is the expensive mistake — it cannot be reviewed or
  reverted cleanly.

---

## When something goes wrong

**Uncommitted changes are not recoverable.** `git reset --hard`, `git restore` and
`git clean -fd` overwrite the working tree with no backup. Run `git status` first, and if
unsure, save everything:

```bash
git stash push -u -m "before history repair"
```

| Situation | Fix |
| --- | --- |
| staged one file by mistake | `git restore --staged <path>` — keeps the local change |
| staged the wrong group entirely | `git reset` — unstages everything, working tree untouched |
| last commit has the wrong changes | `git reset HEAD~1`, restage, recommit |
| message has a typo | `git commit --amend -F <file>` |
| commits in the wrong order | `git rebase -i HEAD~<n>`, reorder the `pick` lines |
| merge half-done | `git merge --abort` |

These rewrite history — only use them on your own unpushed or unshared feature branch, never
on `main`. The longer list is in
[CONTRIBUTING.md](CONTRIBUTING.md#when-something-goes-wrong).

**Git Bash paste problem.** If a pasted command fails with
`bash: [200~git: command not found`, fix it once:

```bash
echo 'set enable-bracketed-paste off' >> ~/.inputrc
```
