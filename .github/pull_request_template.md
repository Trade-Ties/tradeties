<!--
Feature branch -> main. This lands the change in the TEST environment, not at
customers. Reaching customers is a separate, deliberate act: the "Promote to
production" button under Actions — see BRANCHING.md.

Why and Contract impact are the draft of the merge message — merge time is
the worst possible moment to write one well, so write them here and paste
them there. How to test it and Risk are scaffolding for the review; they do
not survive it.

Every section below applies to every change. Contract impact always states one
of its three lines; the rest is prose.
-->

## Why

<!--
What was wrong or missing, and what is true instead once this lands. At feature
altitude — the diff carries the edits, and file names belong nowhere near here.

More than one commit? Say why it is more than one. The split is a decision,
and git log --first-parent is where it gets questioned.
-->

## Contract impact

None

<!--
Keep exactly one of the three below and delete the other two. Do not delete the
section itself: a missing heading cannot tell "checked, does not apply" apart
from "never thought about it", and that is the one question this section exists
to answer.

None      — api/openapi.yaml is untouched
Additive  — new path, new schema, new optional property
Breaking  — renamed field, removed operation, new required property, changed
            type, new value in a RESPONSE enum — landed as ONE commit

CONTRIBUTING.md explains why a breaking contract change may not be split.
-->

## How to test it

<!--
The steps a reviewer, or you in the test environment, follows to see this work.
"CI is green" is not a test plan — CI proves it builds, not that it behaves.

For a fix, name the test that fails without it. A bug that only prose says is
fixed comes back.
-->

## Risk

<!--
What breaks if this is wrong, and who notices. Data migrations, auth changes and
anything touching the WorkOS round trip belong here. Write "low, UI only" if
that is the truth.

If this carries a migration, say expand or contract. The Promote button asks
for that word weeks later, when nobody remembers — and it is the word that
decides whether a rollback exists.
-->

---

- [ ] Every commit builds on its own — no commit leaves `api/openapi.yaml` and its two consumers inconsistent
- [ ] The merge title describes the feature, not the edits
