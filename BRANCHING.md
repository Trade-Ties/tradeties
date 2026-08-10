# Branching and release

How code reaches customers, and why that way.

[CONTRIBUTING.md](CONTRIBUTING.md) covers the craft of a single change — how to split it, how
to write the commit, what must never break. This file covers what happens to that change
afterwards: the two long-lived branches, the two environments behind them, and the button
between them.

---

## The model

```
feature branch ──PR──▶ main ─────[ Promote button ]─────▶ production
                        │                                     │
                        ▼                                      ▼
                  TEST environment                       CUSTOMERS
```

| Branch | Means | Moved by | Deploys to |
| --- | --- | --- | --- |
| `feat/*`, `fix/*` | work in progress | your commits | nothing |
| `main` | integration — what the next release will be | pull requests, CI-gated | the test environment |
| `production` | **the latest commit approved for production** | [`promote.yml`](.github/workflows/promote.yml) only, never a human | production |

### `production` is not the same as "what is running"

The distinction matters during an incident, which is the only time anyone asks:

| Question | Answer |
| --- | --- |
| What did we last approve for customers? | the tip of `production`, and the newest `release-*` tag |
| **What are customers actually running?** | **the last successful deployment** — Settings → Environments → `production` |

They differ whenever a deployment fails after approval, waits on a reviewer, or after a
rollback, where an older release is redeployed and the branch deliberately stays put. Treat
the deployment record as the source of truth for "running" and the branch as the source of
truth for "approved". [`promote.yml`](.github/workflows/promote.yml) creates that deployment
record automatically, by virtue of its `environment: production` key.

### The two invariants

1. **Merges only ever flow left to right.** Nothing is merged back from `production` into
   `main`. There is no cherry-pick, in either direction.
2. **`production` holds no commit of its own.** Promotion is a *fast-forward*, so the tip of
   `production` is literally a commit on `main` — not a merge of it. Its file tree is
   therefore, by construction, a tree CI has tested.

The second one is stronger than it first appears. A branch that receives merges can diverge
even when every commit is accounted for: a merge commit's tree can contain a manual conflict
resolution present in neither parent, and a check that only walks non-merge commits will not
see it. Fast-forwarding removes the question rather than answering it. There is no merge, so
there is nothing to hide in one — which is why
[`promotion-guard.yml`](.github/workflows/promotion-guard.yml) needs exactly one assertion.

---

## The daily loop: feature → `main`

```bash
git switch main
git pull --ff-only
git switch -c feat/<topic>
# ... work, commit per logical group ...
git push -u origin feat/<topic>
```

Then open the pull request against `main`. CI runs [`ci.yml`](.github/workflows/ci.yml):
`frontend`, `backend` and `commit-convention` must be green, and the branch must be up to
date with `main`, before **Merge pull request** unlocks.

**Merge with a merge commit — never squash, never rebase.** Squashing would destroy the
per-commit granularity that `git bisect` and a clean revert depend on, and the whole argument
in CONTRIBUTING.md's *Why a branch and a merge commit* section applies here unchanged. The
repository setting enforces this: merge commits are the only method enabled.

The moment it lands on `main`, it is in the test environment. It is not at customers.

### What CI takes over from you

CONTRIBUTING.md said *"There is no CI (deliberately deferred). Nothing enforces any of this
but you."* That is no longer true, and three of its manual rituals are now machine-checked:

| Was your job | Now enforced by |
| --- | --- |
| `pnpm build` and `./mvnw verify` before every commit | the `frontend` and `backend` jobs |
| the commit header convention | the `commit-convention` job, running `.githooks/commit-msg` — the same file the local hook uses |
| re-verifying after the merge, because `main` moved | **Require branches to be up to date** — GitHub refuses the merge until you have merged the current `main` in and CI has re-run on the result |

That last row is worth pausing on. CONTRIBUTING.md describes exactly this failure — every
commit on the branch passes, the textual merge succeeds, and the result still does not build,
because the conflict was semantic and Git could not see it. Requiring the branch to be up to
date is the automated form of "verify again after the merge, before committing it."

Keep running the builds locally anyway. CI tells you fifteen minutes later what your own
machine tells you now.

---

## The gate: the Promote button

**Actions → Promote to production → Run workflow.**

Four fields, then an approval, then it runs. [`promote.yml`](.github/workflows/promote.yml)
is the only thing in this repository with permission to move `production`.

| Field | What it is for |
| --- | --- |
| **Summary** | What ships, in customer terms. Becomes the release notes. |
| **Tested** | A signature, not a checkbox — it puts your name and a timestamp on the claim that you exercised this against the test environment. CI proves the code builds, not that it behaves. |
| **Migrations** | `none`, `expand` or `contract`. See [migrations](#migrations-expand-then-contract) — this is the field that decides whether a rollback is available. |
| **Commit** | Leave empty for the tip of `main`. Fill it in to ship a specific commit and hold back everything merged after it. |

### What happens, in order

The order is the point, and it is why this is one workflow rather than several triggered by
the same event. Separate workflows start independently: a deploy can be under way while the
check that should have stopped it is still running. `needs:` is what makes a sequence real.

1. **verify** — before anyone is asked to approve anything. The commit must be on **main's
   first-parent history**; it must move `production` forward; and `frontend` and `backend`
   must be **green on that exact SHA**, in a `push` run of `ci.yml` on `main`, asked of the
   API directly rather than assumed from a branch rule. A required status check governs pull
   requests and says nothing about a SHA typed into a box.

   First-parent, not merely "reachable from `main`". Merging a pull request makes every commit
   of the feature branch reachable, so the weaker test would accept a commit from *inside* a
   branch — a tree `main` itself never had, missing whatever else has landed since it forked.
   Promote the merge commit, not something out of the branch it merged.
2. **approval** — GitHub pauses on the `production` environment. This is the human gate, and
   with one maintainer it is the *only* one; nothing else about the day required a second
   confirmation of the same decision.
3. **verify again** — an approval takes as long as a human takes, and `main` and `production`
   can both move inside that window. Everything step 1 established is a fact before the pause
   and only a claim after it.
4. **move the branch** — a fast-forward push, and a compare-and-swap: it names the SHA
   `production` was when the decision was made and is refused if the branch is no longer
   exactly there. Not a merge.
5. **deploy** — *not implemented yet*; see [what is not here yet](#what-is-deliberately-not-here-yet).
6. **smoke test** — a successful infrastructure deploy is not yet a successful release.
7. **tag** — `release-YYYY-MM-DD.N`, last, so a tag can only ever name something that got
   this far. A tag written before the deploy would name a release that may never have
   shipped, and the rollback list is the one place that must not lie.

### Why a button and not a promotion pull request

A pull request cannot say *"deploy commit X"*. It can only say *"merge branch Y"*, and by the
time it merges, Y may have moved. A button takes a SHA, and taking a SHA is what lets every
guarantee above be checked before anything happens.

The pull request also drags in a merge commit, and with it the whole class of drift the
second invariant above exists to rule out. And it is the wrong shape for a solo maintainer:
merging your own promotion pull request and then approving your own environment is the same
decision confirmed twice.

What a pull request had that a button must not lose is the *written record*. The four input
fields are that record. They end up in the run log, in the release notes, and in the
deployment history, which is more durable than a pull request description nobody reopens.

---

## Hotfixes

**There is no hotfix path that skips the test environment.** A hotfix is an ordinary change
that moves faster:

```bash
git switch main && git pull --ff-only
git switch -c fix/<topic>
# fix, commit, push, PR into main, merge
```

then press Promote, with the commit field pointing at that merge if other work has landed on
`main` since the last promotion and you do not want to ship it too. That field is what makes
a targeted hotfix possible without a separate branch model for it.

Patching `production` directly is not merely discouraged — the ruleset rejects the push, and
[`promotion-guard.yml`](.github/workflows/promotion-guard.yml) would go red if it somehow
landed. The version of a fix that gets forgotten is always the urgent one someone applied at
23:00, and it is forgotten in exactly one way: it never reached `main`.

If the fix cannot wait even for that, **roll back instead of fixing forward.** A rollback is
faster than any hotfix and cannot introduce a second bug.

---

## Rollback

**A rollback is a deployment action, not a Git action.** You redeploy an older release; you
do not move the branch back. Rewinding `production` would be a non-fast-forward push, which
the ruleset rejects, and it would erase the record of what was once approved — during an
incident, that record is evidence.

```bash
git tag --list 'release-*' --sort=-creatordate | head -5
```

The runbook:

1. **Identify** the failing version and confirm the last release that demonstrably worked.
2. **Check schema compatibility first.** Can the older application still run against the
   current database? If the last promotion was `contract`, the answer may be no — and then
   rolling back makes things worse, not better.
3. **Redeploy the previous artefact.** Do not rebuild it. The artefact that worked is the one
   you want, not a fresh build of the same source.
4. **Smoke test**, then record the incident and which version is now running.
5. **Fix forward through `main`** afterwards, as an ordinary change.

Step 3 is the one that does not exist yet, and it is the strongest argument for
[build once, promote the digest](#what-is-deliberately-not-here-yet). Until there is an
artefact to redeploy, the honest rollback is: revert the offending merge on `main` through a
normal pull request, then Promote. That is minutes, not seconds, and it ships everything else
that has landed on `main` in the meantime.

### Migrations: expand, then contract

An application rollback does not undo a migration, and it does not undo data customers have
already written. So the schema must be changed in a shape that keeps the previous version of
the application working:

1. **Expand** — add tables, columns and indexes. Never rename, never drop. Deploy code that
   tolerates both the old and the new shape. Promote with `migrations: expand`.
2. **Backfill** — move data across in a controlled, idempotent step.
3. **Contract** — in a *later* release, once the old application version is no longer a
   rollback target, remove what is now unused. Promote with `migrations: contract`.

A `contract` promotion is the one where the rollback plan needs to be written down rather
than assumed. Before pressing the button on one, know: does the migration run before or after
the application starts, is it idempotent, what does it lock and for how long, is there a
tested backup, and do background workers need to pause.

---

## What is deliberately not here yet

**Deployment.** `infra/compose.yaml` does not exist, and the deploy step in
[`promote.yml`](.github/workflows/promote.yml) is a marked placeholder guarded by the
repository variable `PRODUCTION_DEPLOY_ENABLED`. Until that variable is set, the button moves
the branch — `production` means *approved*, and an approval did happen — but writes **no
`release-*` tag**, because a release tag names something that shipped and nothing shipped. The
run says so plainly in its summary. Everything around the gap — ordering, approval,
verification, tagging, the deployment record — is real and does not change when the gap is
filled.

One thing in the interface does lie in the meantime, and cannot be made not to: referencing
the `production` environment is what produces the approval prompt, and GitHub writes a
deployment record for it automatically. While deployment is off, that record marks the
approval, not a deployment. The run summary says this; the Environments page cannot.

Three things to get right when filling it in, in this order:

**1. Build once, promote the digest.** Build an immutable artefact — a container image — once
per `main` SHA, tag it with the SHA, and deploy *that digest* to test and later that same
digest to production. Rebuilding at promotion time can produce a different image from
identical source: a moved base image, an unpinned transitive dependency, a different runner.
The thing you tested is then not the thing customers get, and this is the single most
expensive way to lose the value of a test environment. This needs a Dockerfile for each of
`frontend` and `backend`, which is also why it cannot be done today.

**2. Two GitHub Environments** (Settings → Environments), `test` and `production`, with a
required reviewer on `production`. Give them genuinely separate resources, not just separate
values: WorkOS applications and redirect URLs, databases and database users, storage buckets,
webhook endpoints and secrets, mail/SMS provider or its sandbox, domains and cookie names,
queues and workers, monitoring channels. `WORKOS_COOKIE_PASSWORD` in particular **must**
differ — sharing it lets a test session be replayed against production. For cloud
credentials prefer short-lived OIDC identities over stored keys.

**3. Smoke tests and version visibility.** After deploying, exercise the WorkOS sign-in round
trip, one authenticated API call, a database read, and one business-critical action. Then
expose the release SHA in the logs and on a health endpoint, so during an incident you can
read which version is running instead of inferring it.

---

## Why this shape and not one of the others

**Not Git Flow.** In Git Flow `main` is production and `develop` is integration. It was
designed in 2010 for versioned software with several releases supported in the field
simultaneously; its author has since put a note at the top of the original article saying it
is not the right model for continuously delivered web applications. TradeTies is one. Its
specific cost is the hotfix: it lands on `main` and must then be merged *back* into
`develop`, and the day that second merge is forgotten, production runs code the test branch
has never seen. The model above has no backwards merge to forget.

**Not a chain of environment branches** (`dev` → `test` → `prod`, each merged into the next).
This is the setup this one is most often confused with, and the difference is that here only
`main` accumulates work. In a true environment-branch chain each branch collects its own
merges, they drift within weeks, and teams start cherry-picking between them — at which point
no branch can answer what is deployed anywhere.

**Not yet pure trunk-based development** — one branch, production deployed from an approved
artefact, which is what Google, Meta, Netflix and Shopify actually run, and the only
branching practice the DORA research associates with elite delivery performance. The model
above is a strict subset of it, and the Promote button is already the trunk-based shape: it
promotes a *commit*, not a branch. `production` is a visible pointer that a deployment
platform would otherwise hold on its own.

Once the deployment record reliably answers "what is running", `production` has no job left.
Delete it, delete its ruleset, and change one line in `promote.yml`. Nothing about the daily
loop changes — which is the migration Git Flow does not offer.

---

## One-time setup

Everything below happens in the GitHub web interface, in this order. **The order matters:**
the workflows must exist on `main` before any check can be marked as required — a required
check that has never reported is stuck pending and blocks every pull request, with no error
message explaining why.

### 1. Land this configuration on `main`

Ordinary branch and merge, per CONTRIBUTING.md. Do not add the rulesets yet.

### 2. Create `production` from `main`

```bash
git switch main && git pull --ff-only
git branch production
git push -u origin production
```

`production` starts life identical to `main`. From here on only the button moves it.

### 3. Settings → General → Pull Requests

| Setting | Value | Why |
| --- | --- | --- |
| Allow merge commits | **on** | the merge commit is the unit CONTRIBUTING.md's model is built on |
| Allow squash merging | **off** | destroys per-commit granularity and the revert story |
| Allow rebase merging | **off** | rewrites SHAs, so the checks that ran no longer belong to the commits that land |
| Automatically delete head branches | **on** | feature branches are disposable |

### 4. Settings → Environments → New environment: `production`

Add **yourself as a required reviewer**. This is the pause in the middle of the Promote
workflow, and without it the button runs straight through. It is also what makes GitHub write
the deployment record that answers "what is actually running".

Create `test` too while you are here, even though nothing deploys to it yet.

### 5. Let CI run once on `main`

Push anything so `frontend`, `backend` and `commit-convention` have each reported at least
once. Their names then appear in the search box in the next step — if a name is missing
there, do not type it by hand, find out why the job did not run.

### 6. Settings → Rules → Rulesets → New ruleset → Import a ruleset

Import [`.github/rulesets/main.json`](.github/rulesets/main.json) and
[`.github/rulesets/production.json`](.github/rulesets/production.json).

**Set both to "Evaluate" first, not "Active".** Evaluate mode logs what *would* have been
blocked without blocking it. Open a throwaway pull request, read the rule insights, and only
then switch to Active. Locking yourself out of your own repository is a fifteen-minute
problem, but it is fifteen minutes you get to have at the worst possible moment otherwise.

**Then, on the `production` ruleset, add GitHub Actions to the bypass list.** Bypass list →
Add bypass → GitHub Actions. Without it the Promote button cannot push, because
`production`'s **Restrict updates** rule blocks every actor that is not on that list — which
is precisely how humans are kept out. The exported JSON cannot carry this entry; the app ID
differs per installation.

What the two rulesets contain:

| Rule | `main` | `production` | Why |
| --- | --- | --- | --- |
| Require a pull request | yes | — | `production` is not written by pull request at all |
| Restrict updates | — | **yes** | only bypass actors may move the branch: GitHub Actions, i.e. the Promote button, plus admin break-glass |
| Required approvals | **0** | — | GitHub never lets you approve your own pull request. With one maintainer, 1 would lock you out. Raise it the day someone else gets write access — see [`.github/CODEOWNERS`](.github/CODEOWNERS) |
| Allowed merge method | merge only | — | mirrors step 3, and rulesets outrank repository settings |
| Required checks | `frontend`, `backend`, `commit-convention` | — | on `production` the equivalent check lives inside `promote.yml`, where it can inspect a specific SHA |
| Require branches up to date | yes | — | the semantic-conflict guard |
| Block force pushes | yes | yes | published history stays published; on `production` it is also what forces a rollback to be a redeploy rather than a rewind |
| Restrict deletions | yes | yes | |
| Linear history | **no** | — | would forbid the `--no-ff` merge commit the model depends on |

The imported rulesets grant **repository admin an always-bypass**. That is break-glass for a
CI outage, not a convenience — using it routinely means none of the above is real, and a
bypassed push is exactly what [`promotion-guard.yml`](.github/workflows/promotion-guard.yml)
exists to catch. Remove the admin bypass once a second maintainer exists.

**If Settings → Rules is missing or refuses to save:** rulesets on a *private* repository may
require a paid organisation plan. Either make the repository public, upgrade the org, or
accept that the workflows still run and report — they simply cannot block anything, and the
discipline goes back to being yours.

### 7. Optional: turn on the merge queue

Settings → General → Pull Requests → **Allow merge queue**, then add "Require merge queue" to
the `main` ruleset. Instead of updating your branch from `main` yourself when someone else
merges first, GitHub tests each pull request against the queued result and only lands it if
that is green. [`ci.yml`](.github/workflows/ci.yml) already carries the `merge_group` trigger
this requires — without it the required checks never run for the queued commit and every
merge blocks forever. Worth turning on once two people merge on the same day; pointless
before that, and it needs a paid plan for private repositories.
