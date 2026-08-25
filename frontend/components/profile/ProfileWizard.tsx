"use client";

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UNREACHABLE_DETAIL } from "@/lib/api/failure";
import type { ProfileReadiness } from "@/lib/api/wire";
import type { ReferenceData } from "@/lib/api/reference";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, CircleAlert, Info, Rocket } from "lucide-react";

import {
  checkSlug,
  loadReadiness,
  publishProfile,
  refreshDashboard,
} from "@/app/(pro)/profile/create/actions";
import { DASHBOARD_PATH, STEPS, blankForm, dayName, nothingStored } from "./constants";
import { buildReview, type ReviewGroup } from "./review";
import {
  hasUnwrittenAnswers,
  saveStep,
  type Confirmation,
  type Deferral,
  type SaveOptions,
} from "./save";
import { useLeaveGuard } from "./leaving";
import type { PricingForm, ProfileFormData, StepKey, StoredState } from "./types";
import {
  claimedTradeIds,
  misshapenProfileFields,
  missingPricingFields,
  missingProfileFields,
  overlappingBlockKeys,
  profileIsWritable,
} from "./validate";
import { StepIndicator } from "./StepIndicator";

import { BusinessStep } from "./steps/BusinessStep";
import { TradeStep } from "./steps/TradeStep";
import { ServicesStep } from "./steps/ServicesStep";
import { PricingStep } from "./steps/PricingStep";
import { LicensesStep } from "./steps/LicensesStep";
import { HoursStep } from "./steps/HoursStep";
import { LocationStep } from "./steps/LocationStep";
import { BookingStep } from "./steps/BookingStep";
import { CancellationStep } from "./steps/CancellationStep";
import { PublishStep } from "./steps/PublishStep";

const NOTHING_TO_REVIEW: ReviewGroup[] = [];

/**
 * What the flush after the first successful save of steps 1 and 2 writes.
 *
 * `business` is out of it because in that moment it *is* the step that was just written, and
 * `publish` because it writes nothing. Every other list of steps to catch up is built elsewhere;
 * this one is only that flush.
 */
const DEFERRED_UNTIL_THE_PROFILE_EXISTS: StepKey[] = STEPS.map((step) => step.key).filter(
  (key) => key !== "business" && key !== "publish"
);

/** The steps between two positions. `business` is the first, so a jump forward slices past it. */
const stepsBetween = (from: number, to: number): StepKey[] =>
  STEPS.slice(from, to).map((entry) => entry.key);

/**
 * Every screen that has been open except the one being stood on, which the save above has just
 * dealt with. What "Save & finish later" writes.
 *
 * `business` belongs here and in no other list. It is normally written by the act of moving
 * forward off it — but a move whose save was refused moves on anyway, and from then on those
 * answers exist nowhere but in this component. This is what retries them.
 */
const everyScreenOpened = (current: StepKey, visited: ReadonlySet<StepKey>): StepKey[] =>
  STEPS.map((entry) => entry.key).filter(
    (key) => key !== "publish" && key !== current && visited.has(key)
  );

interface ProfileWizardProps {
  reference: ReferenceData;
  /**
   * The stored profile restored into the form; absent before onboarding has started.
   *
   * Both halves or neither: a save compares the form's rows against `stored`, so a form
   * without it reads every existing service as new and creates a second copy of each.
   */
  initial?: { formData: ProfileFormData; stored: StoredState };
  /** Where to reopen, derived on the server from `onboardingCompletedStep`. */
  initialStep?: number;
  /**
   * The server's publish checklist as of the page read. `null` both for a business that does
   * not exist yet and for a checklist that could not be read; the wizard treats them alike.
   */
  initialReadiness?: ProfileReadiness | null;
}

function MergedStep({ children }: { children: React.ReactNode }) {
  return <div className="space-y-8">{children}</div>;
}

const FOOTER_BUTTON = "h-11 px-4";

/** What the footer is waiting for. One value, not two flags: the two cannot overlap. */
type Pending = null | "saving" | "publishing";

/** Where a save was heading, for replaying it once the time zone question is answered. */
type PendingMove = { to: "step"; index: number } | { to: "dashboard" };

export default function ProfileWizard({
  reference,
  initial,
  initialStep = 0,
  initialReadiness = null,
}: ProfileWizardProps) {
  const [step, setStep] = useState(initialStep);
  /**
   * Which screens have been open, seeded with the one the wizard reopens on.
   *
   * The mark tells a screen somebody looked at and left as it stood from one they never reached,
   * which `save.ts` cannot work out for itself — an accepted default and an untouched form are
   * the same body. Two things read it: the three single-resource steps, which write a screen
   * that was shown even when nothing on it was edited, and "Save & finish later", which has to
   * write every screen that has been open rather than only the one being stood on.
   */
  const [visited, setVisited] = useState<ReadonlySet<StepKey>>(
    () => new Set([STEPS[initialStep].key])
  );
  // `blankForm()` returns a fresh form rather than a shared constant: the arrays inside a
  // shared one would belong to every future form as well.
  const [formData, setFormData] = useState<ProfileFormData>(
    () => initial?.formData ?? blankForm()
  );
  const [stored, setStored] = useState<StoredState>(initial?.stored ?? nothingStored);
  const [pending, setPending] = useState<Pending>(null);
  /** What the server said about the last attempt, shown above the footer until it is retried. */
  const [problem, setProblem] = useState<string | null>(null);
  /**
   * Why the last step was not written, where not writing it was correct. Separate from
   * `problem` because nothing has gone wrong and it must not render as an error.
   */
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * Set when leaving was asked for and the step could not be written on the way out.
   *
   * The wizard renders on a route of its own with no header and no sign-out, and the Business
   * step disables Next and every step circle until it is complete, so withholding the way out
   * leaves a screen nothing but the browser's back button escapes. A second control rather
   * than the same one leaving anyway, because this one discards answers.
   */
  const [leaveOffered, setLeaveOffered] = useState(false);
  /**
   * Set while the time zone change is waiting to be confirmed. It carries the move the save
   * was going to make, because either button can raise the question and confirming one made
   * on the way out has to still lead out.
   */
  const [question, setQuestion] = useState<{
    kind: Confirmation;
    detail: string;
    then: PendingMove;
  } | null>(null);
  /**
   * The server's checklist: what publishing would say if it were attempted now.
   *
   * Seeded from the page load and asked again on the way into the publish step, so it
   * describes what is stored, which is what publishing acts on. Never derived from the form:
   * every condition behind it reads more than one table, and the contract says a client
   * reproducing them would be a second implementation to keep in step.
   */
  const [readiness, setReadiness] = useState<ProfileReadiness | null>(initialReadiness);
  const router = useRouter();

  const currentKey = STEPS[step].key;
  const isPublishStep = currentKey === "publish";
  const busy = pending !== null;

  /**
   * The two ways out the wizard's own buttons do not cover — see `useLeaveGuard`.
   *
   * Whether anything is unwritten is asked of the bookkeeping rather than remembered as a flag:
   * a step written a moment ago is clean again, a step edited and navigated away from is not,
   * and only the recorded bodies know which is which. Handed over as a question so that it is
   * only asked when somebody presses something.
   *
   * Back is answered in the wizard's own vocabulary — the same notice and the same way out it
   * offers when a save on the way out could not be made.
   */
  useLeaveGuard(() => hasUnwrittenAnswers(formData, stored), () => {
    setNotice(UNSAVED_ON_THE_WAY_BACK);
    setLeaveOffered(true);
  });

  // Only on the publish step: walking the whole form on every keystroke of every other step
  // would be work nobody is waiting for.
  const review = isPublishStep ? buildReview(formData, reference) : NOTHING_TO_REVIEW;
  /**
   * Whether publishing is worth attempting. The server's answer, not this side's: `review`
   * says what is on the screen but does not decide, because the conditions publishing applies
   * read from more than one table.
   *
   * With no checklist to consult — no business yet, or the read did not come back — the button
   * stays enabled so the server gets to answer rather than this side guessing at its rules.
   *
   * Whatever greys this button out is on the screen above it: `PublishStep` renders the same
   * checklist, line by line, in the server's own words.
   */
  const canPublish =
    stored.businessVersion !== null && (readiness === null || readiness.ready);

  /**
   * Whether the Business step is complete enough to bring the profile into existence. Run on
   * every keystroke rather than on blur, because the Next button below reads it.
   */
  const profileWritable = useMemo(() => profileIsWritable(formData.profile), [formData.profile]);

  /**
   * The one place in the wizard you cannot move forward from.
   *
   * The Business step creates `business_profile`, and every endpoint from Trades on resolves
   * the business from the token and answers 404 without one, so anyone let past would fill in
   * five more screens that cannot store a keystroke. It therefore holds both ways forward, the
   * Next button and the step circles. "Save & finish later" is deliberately not among them.
   */
  const heldOnBusiness = currentKey === "business" && !profileWritable;

  /**
   * The reason the Next button is grey, standing rather than raised once.
   *
   * It names fields, which nothing else here does — the rule being that a field states its own
   * problem, which needs a field somebody has touched. Three at a time and a count for the
   * rest, because on an untouched form the full list is every label on the screen.
   */
  const standingNotice = useMemo(() => {
    if (heldOnBusiness) {
      const missing = missingProfileFields(formData.profile);

      if (missing.length === 0) {
        // Named here rather than left to the field, which stays silent until it has been left —
        // so on a box nobody has blurred, "the field says which" would point at nothing.
        const misshapen = misshapenProfileFields(formData.profile);

        return (
          (misshapen.length > 0
            ? `Check ${misshapen.join(", ")}. `
            : "One of the answers above is not in the shape it needs. ") +
          "Everything else in the wizard hangs off this step, so it has to be complete before " +
          "you can move on."
        );
      }

      const named = missing.slice(0, 3).join(", ");
      const rest = missing.length > 3 ? ` and ${missing.length - 3} more` : "";

      return (
        `Still to fill in: ${named}${rest}. Everything else in the wizard hangs off this step, ` +
        "so it has to be complete before you can move on."
      );
    }

    // Stands for as long as it is true: the publish button is disabled, and this is why.
    if (isPublishStep && stored.businessVersion === null) return NOTHING_CAN_BE_STORED_YET;

    return null;
  }, [heldOnBusiness, formData.profile, isPublishStep, stored.businessVersion]);

  const shownNotice = notice ?? standingNotice;

  /**
   * The per-slice update functions, built once for the life of the wizard.
   *
   * Nothing in here may close over `formData` — the updater form is what lets these be built
   * once at all, and a slice read from a closure would be the one this was built with rather
   * than the current one.
   */
  const set = useMemo(() => {
    const into =
      <K extends keyof ProfileFormData>(key: K) =>
      (value: ProfileFormData[K]) =>
        setFormData((prev) => ({ ...prev, [key]: value }));

    return {
      profile: into("profile"),
      trades: into("trades"),
      services: into("services"),
      pricing: into("pricing"),
      licenses: into("licenses"),
      workingHours: into("workingHours"),
      bookingPolicy: into("bookingPolicy"),
      ui: into("ui"),
    };
  }, []);

  /**
   * The trades a service may be filed under. Memoised because the service rows' trade dropdown
   * compares this array by identity.
   *
   * Unticking one deliberately leaves the services filed under it in the form. They are what a
   * re-tick has to bring back, and until the step is written there is nothing to bring back
   * from: dropping them here would let unticking a checkbox destroy a catalogue the server still
   * holds, with no request sent and nothing to undo it. `ServicesStep` badges such a row and
   * `saveTradesAndServices` drops it at the moment the server retires it.
   */
  const selectedTradeIds = useMemo(() => claimedTradeIds(formData.trades), [formData.trades]);

  /**
   * The URL field's availability check. A refusal collapses to `null`: the field has nothing
   * to say about why a check could not be made. Memoised because the field holds it in two
   * effect dependency arrays.
   */
  const askIfSlugIsFree = useCallback(async (slug: string) => {
    const result = await checkSlug(slug);

    return result.ok ? { available: result.data.available } : null;
  }, []);

  /**
   * No `refresh()` alongside the push: `bustCard` has already revalidated the dashboard, and
   * refreshing here races the push because it targets the route being left.
   */
  const leaveToDashboard = () => {
    router.push(DASHBOARD_PATH);
  };

  /**
   * Moving to a step, and marking it as having been on screen. Every way `step` changes goes
   * through here, or the mark is only as good as the paths that remembered to set it.
   */
  const showStep = (index: number) => {
    const key = STEPS[index].key;

    setVisited((seen) => (seen.has(key) ? seen : new Set(seen).add(key)));
    setStep(index);
  };

  /**
   * Arriving at a step from a save, asking for the checklist on the way into the one that shows
   * it.
   *
   * Every way in rather than only the way in from a move that wrote everything: a step refused
   * or held back is exactly when the publish screen has something to say, and the checklist it
   * renders is the only thing on it that describes what is stored rather than what is typed. A
   * failed read leaves the previous answer standing — see `refreshReadiness`.
   */
  const enter = async (index: number) => {
    if (STEPS[index].key === "publish") await refreshReadiness();
    showStep(index);
  };

  /**
   * Writes the current step on the way out of it, and moves on either way.
   *
   * Everything that leaves a step goes through here, because the step is the unit of saving:
   * each endpoint advances `onboardingCompletedStep` by itself, so a step navigated past
   * without being written is a step the server has never heard of.
   *
   * A deferral and a refusal both still move on — an empty field is allowed right up to
   * publishing, and what a refusal is about stays on the screen being left. Only the time zone
   * question holds a move, because answering it re-runs the write and completes it.
   */
  const persist = async (move: PendingMove, options: SaveOptions = {}): Promise<void> => {
    setPending("saving");
    clearLastAttempt();

    /**
     * The dashboard's cached card, busted once for the whole move.
     *
     * Before anything navigates, never after: `leaveToDashboard` pushes to the very page this
     * marks stale, and a bust landing after the push renders the payload it was meant to
     * replace.
     *
     * Once, because a server action that revalidates makes Next re-render the route the caller
     * is on — this wizard, whose loader fans out to eleven backend reads plus the identity call.
     * The write actions therefore do not bust it themselves.
     */
    const bustCard = async (wrote: boolean | undefined) => {
      if (wrote === true) await refreshDashboard();
    };

    try {
      // `shown` unconditionally: this is the step being stood on, so whatever it holds is what
      // somebody left there — a default included.
      const outcome = await saveStep(currentKey, formData, stored, {
        ...options,
        shown: true,
        leaving: move.to === "dashboard",
      });

      // Before anything else: the write is waiting on an answer, and moving on would take the
      // question off the screen.
      if ("needsConfirmation" in outcome) {
        setQuestion({ kind: outcome.needsConfirmation, detail: outcome.detail, then: move });
        return;
      }

      if (!outcome.ok) {
        // Part of a list step can land before the rest is refused, and what landed has to be
        // recorded even though the step failed — otherwise the retry writes it a second time.
        if (outcome.formData !== undefined) setFormData(outcome.formData);
        if (outcome.stored !== undefined) setStored(outcome.stored);

        // And what landed moved `onboardingCompletedStep` with it, so the card is as stale
        // after a step refused halfway as after one that finished.
        await bustCard(outcome.wrote);

        // A refusal does not hold you here: what it is about is on this screen and will still
        // be on it when you come back. The Business step before the profile exists is the
        // exception — the business was not created, so the steps ahead have nothing to hang
        // off and would refuse every save in turn.
        const heldByRefusal = currentKey === "business" && stored.businessVersion === null;

        setProblem(outcome.failure.detail);

        // Leaving would unmount the wizard in the same tick the message appears, so the
        // tradesperson would reach the dashboard believing the step had been stored. The way
        // out is offered instead — see `leaveOffered`.
        if (move.to === "dashboard") setLeaveOffered(true);
        else if (!heldByRefusal) await enter(move.index);
        return;
      }

      let saved = outcome.formData;
      let bookkeeping = outcome.stored;

      /**
       * The steps to write behind this one, which is one of three lists.
       *
       * The first successful write of steps 1 and 2 is what makes every other endpoint answer
       * at all, so it is also the moment to write whatever was filled in while they did not.
       * Without it a profile could be complete on screen and half empty on the server.
       *
       * A jump forward leaves steps behind it that were never written, while `buildReview` reads
       * the form and goes on showing their answers as present — so the publish checklist says
       * everything is there and the tradesperson publishes believing it. A move of one step
       * forward slices to nothing, which `writeSteps` answers without a request.
       *
       * Leaving takes every screen that has been open with it. Moving back writes nothing, and
       * deliberately so — a step mid-edit should not be sent by the act of leaving it — which
       * makes this the only thing between those answers and a component about to be unmounted:
       * the form lives nowhere else, and the button says it is saving.
       */
      const behind =
        stored.businessVersion === null && bookkeeping.businessVersion !== null
          ? DEFERRED_UNTIL_THE_PROFILE_EXISTS
          : move.to === "step"
            ? stepsBetween(step + 1, move.index)
            : everyScreenOpened(currentKey, visited);

      const done = await writeSteps(behind, saved, bookkeeping, {
        ...options,
        leaving: move.to === "dashboard",
      });

      saved = done.formData;
      bookkeeping = done.stored;

      /** What a step written behind this one was refused for, if any of them was. */
      const partial = done.failure;

      await bustCard(outcome.wrote === true || done.wrote);

      setFormData(saved);
      setStored(bookkeeping);

      if (partial !== undefined) setProblem(partial);

      // A step behind this one is waiting on an answer. Moving on would take the question off
      // the screen, so this stays put exactly as the current step's own question does.
      if (done.asks !== undefined) {
        setQuestion({ ...done.asks, then: move });
        return;
      }

      /**
       * A screen was deliberately not written — this one, or one written behind it. A notice
       * rather than a problem, because nothing has gone wrong, and the move still goes through:
       * the answers are written as soon as there is somewhere to put them.
       *
       * Leaving is the one move they do not survive — they exist nowhere but in this component —
       * so the way out is offered beside the notice rather than taken silently. Which is why
       * this sits after `writeSteps` rather than returning ahead of it: everything that could be
       * written has been by now, and what could not is what this reports, wherever it was.
       */
      const held = outcome.deferred ?? done.held;

      // Leaving was asked for and is not going to happen, so somebody is about to be left
      // standing where they are. On the publish step that means its checklist is about to be
      // read again with the steps behind it freshly written — the same question `enter` asks on
      // the way in, on the one path that is not a way in.
      if (isPublishStep && move.to === "dashboard" && (held !== undefined || partial !== undefined)) {
        await refreshReadiness();
      }

      if (held !== undefined) {
        const say = move.to === "dashboard" ? NOTHING_TO_LEAVE_BEHIND : NOT_SAVED;

        setNotice(say[held](saved));

        if (move.to === "dashboard") setLeaveOffered(true);
        else await enter(move.index);
        return;
      }

      // Reported on the screen it happened on, for the same reason a refusal is: `writeSteps`
      // stops at the first refusal, so every step behind it was skipped too, and leaving in the
      // same tick takes that message off the screen unread.
      if (partial !== undefined && move.to === "dashboard") {
        setLeaveOffered(true);
        return;
      }

      if (move.to === "dashboard") leaveToDashboard();
      else await enter(move.index);
    } catch (cause) {
      // `saveStep` answers a refusal by the server with a result and rethrows everything else:
      // an offline browser, a dead Next server, an expired session cookie. Reported rather than
      // swallowed, because a button that goes back to "Next" in silence reads as a save that
      // worked.
      console.error("Saving the step failed", cause);
      setProblem(UNREACHABLE_DETAIL);
    } finally {
      setPending(null);
    }
  };

  /**
   * A run of steps written in order, each handed what the one before it settled.
   *
   * Stops at the first refusal and hands back what got through. Carrying on and reporting the
   * last failure would leave the bookkeeping claiming steps that were never written.
   */
  const writeSteps = async (
    keys: StepKey[],
    data: ProfileFormData,
    from: StoredState,
    /**
     * Handed on whole, and that is the part worth stating. A step behind is as unsurvivable as
     * the one in front, so it needs `leaving` — and an answer to a question one of them raised
     * has to reach the step that asked it, or confirming would replay the same question for as
     * long as anybody kept pressing the button.
     */
    options: SaveOptions
  ): Promise<{
    formData: ProfileFormData;
    stored: StoredState;
    failure?: string;
    /**
     * The first of them that was deliberately not written.
     *
     * Carried out rather than swallowed: a step behind is held back for the same reasons the one
     * in front is, and it costs the same. Dropped here, "Save & finish later" would write four
     * screens, silently skip the fifth and leave for the dashboard reporting success.
     */
    held?: Deferral;
    /**
     * A question raised by a step behind this one, carried rather than answered: answering means
     * putting it to somebody, and this runs with no screen and nobody in front of it.
     */
    asks?: { kind: Confirmation; detail: string };
    /** Whether any of them sent anything, so the caller can bust the card once for the lot. */
    wrote: boolean;
  }> => {
    let formData = data;
    let stored = from;
    let wrote = false;
    let held: Deferral | undefined;

    for (const key of keys) {
      // Only a screen that has been open counts as answered — see `visited`. A step written from
      // a screen nobody reached would report progress that was never made, and the server's
      // `onboardingCompletedStep` is where the wizard reopens.
      const outcome = await saveStep(key, formData, stored, {
        ...options,
        shown: visited.has(key),
      });

      // Before `wrote` is read off it: a question carries no bookkeeping, because the write it
      // is about was refused whole.
      if ("needsConfirmation" in outcome) {
        return {
          formData,
          stored,
          asks: { kind: outcome.needsConfirmation, detail: outcome.detail },
          held,
          wrote,
        };
      }

      wrote = wrote || outcome.wrote === true;

      if (!outcome.ok) {
        // As in `persist`: a list step can have written part of itself before being refused,
        // and taking that here is what stops the next attempt creating those rows again. A
        // question is not a refusal and is handled above.
        return {
          formData: outcome.formData ?? formData,
          stored: outcome.stored ?? stored,
          failure: outcome.failure.detail,
          held,
          wrote,
        };
      }

      held = held ?? outcome.deferred;

      formData = outcome.formData;
      stored = outcome.stored;
    }

    return { formData, stored, held, wrote };
  };

  /**
   * Moving to another step, which always works.
   *
   * Nothing on the way out of a step can hold you on it. An empty field is not an error: the
   * one moment everything has to be there is the publish, where `buildReview` counts what is
   * still open and the server counts it again inside the transaction that would go live.
   *
   * Forward still writes on the way past, because each endpoint advances
   * `onboardingCompletedStep` by itself. Backward does not write at all, which keeps a step
   * that is mid-edit from being sent by the act of leaving it.
   */
  const goTo = async (index: number) => {
    if (busy || index === step) return;

    // The step circles are navigation too, so guarding only the button would leave them as
    // the way round it.
    if (heldOnBusiness && index > step) return;

    if (index < step) {
      clearLastAttempt();
      // Through `enter` like every other arrival. Backward cannot reach the publish step while
      // that one is last, but nothing here should depend on it staying last.
      await enter(index);
      return;
    }

    await persist({ to: "step", index });
  };

  const goNext = () => goTo(Math.min(STEPS.length - 1, step + 1));
  const goBack = () => void goTo(Math.max(0, step - 1));

  /**
   * Everything on screen that describes one attempt rather than the state of the form.
   *
   * All four are cleared together, or the time zone question outlives the save it was asked
   * about and its confirm button re-runs a different step against an endpoint that ignores the
   * confirmation.
   *
   * `readiness` is deliberately not among them — it is the server's answer about what is
   * stored, replaced by asking again on the way into the publish step.
   */
  const clearLastAttempt = () => {
    setProblem(null);
    setNotice(null);
    setQuestion(null);
    setLeaveOffered(false);
  };

  /**
   * The checklist, asked again on the way into the publish step: the only screen that shows
   * it, and the point by which everything the wizard holds has just been written, so the
   * answer is about the state the publish would act on.
   *
   * A failed read leaves the previous answer standing, which is the right side to fail on but
   * not free: a standing `ready: false` greys the button out, so what a lost read can cost is
   * not a refused attempt but no attempt at all until the page is loaded again.
   */
  const refreshReadiness = async () => {
    try {
      const result = await loadReadiness();
      if (result.ok) setReadiness(result.data);
    } catch (cause) {
      console.error("Reading the publish checklist failed", cause);
    }
  };

  /**
   * Leaving has to write, or the button is lying about what it does — which is also why it
   * does not leave when the write did not happen. It says what stopped it and offers
   * `leaveAnyway` beside itself; pressing this one again retries the write.
   */
  const saveAndLeave = () => {
    if (busy) return;
    return persist({ to: "dashboard" });
  };

  /** The other half of that offer: go, and leave behind what could not be stored. */
  const leaveAnyway = () => {
    if (busy) return;
    leaveToDashboard();
  };

  /**
   * The answer to whichever question was put: the same move again, with the answer attached.
   *
   * The move is carried on the question rather than re-derived here, which is why the question
   * has to be cleared the moment any other save starts — replayed after the wizard has moved on,
   * it sends the confirmation to a step that does not take it. `persist` clears it.
   *
   * The answer reaches every step the replay writes, not only the one on screen: a question can
   * come from a step being caught up behind this one, and that is the step that has to hear it.
   * See `writeSteps`.
   */
  const answerQuestion = async (kind: Confirmation, then: PendingMove) => {
    await persist(then, kind === "unpublish"
      ? { confirmUnpublish: true }
      : { confirmTimeZoneChange: true });
  };

  /**
   * The other button: the question goes and nothing else does.
   *
   * Reverting the edit that raised it would undo something they may still want — the time zone
   * they just chose, or a service they meant to stop offering. The unpublish one needs a word
   * about what that leaves behind, because the row is gone from this list while the server
   * still holds it.
   */
  const dismissQuestion = () => {
    const asked = question;

    setQuestion(null);
    if (asked?.kind === "unpublish") setNotice(STILL_PUBLISHED);
  };

  /**
   * Publishing asks rather than writes. `not-ready` is a 422 carrying the server's own
   * checklist, re-evaluated inside the transaction that would have set the status — an answer
   * rather than a failure, which is why it is kept and rendered rather than reported as one.
   */
  const publish = async () => {
    if (busy) return;
    setPending("publishing");
    clearLastAttempt();

    try {
      const outcome = await publishProfile();

      if (outcome.outcome === "published") {
        leaveToDashboard();
        return;
      }

      if (outcome.outcome === "not-ready") {
        // The checklist on the step above is the whole answer, and it has just been replaced
        // with the one the server evaluated inside the transaction that would have gone live.
        // The strip is there to say that something happened at all: this is the last button in
        // the wizard, and one that goes quiet reads as a publish that worked.
        setReadiness(outcome.readiness);
        setProblem(PUBLISH_REFUSED);
        return;
      }

      setProblem(outcome.failure.detail);
    } catch (cause) {
      // Same gap as in `persist`, and worse: this is the last button in the wizard, so nothing
      // happening reads as "published".
      console.error("Publishing failed", cause);
      setProblem(UNREACHABLE_DETAIL);
    } finally {
      setPending(null);
    }
  };

  const renderStep = () => {
    switch (currentKey) {
      case "business":
        return (
          <MergedStep>
            {/* Two screens onto one resource: the contract submits steps 1 and 2 as a single
                body, so both edit the same `profile` slice rather than a half each. */}
            <BusinessStep
              data={formData.profile}
              update={set.profile}
              slugLocked={stored.slugLocked}
              checkSlug={askIfSlugIsFree}
            />
            <LocationStep
              data={formData.profile}
              update={set.profile}
              reference={reference}
            />
          </MergedStep>
        );
      case "services":
        return (
          <MergedStep>
            <TradeStep
              data={formData.trades}
              update={set.trades}
              reference={reference}
            />
            <ServicesStep
              data={formData.services}
              update={set.services}
              reference={reference}
              selectedTradeIds={selectedTradeIds}
            />
          </MergedStep>
        );
      case "pricing":
        return (
          <MergedStep>
            <PricingStep
              data={formData.pricing}
              update={set.pricing}
            />
            {/* Rates and cancellation terms are one resource on the wire, so both halves
                edit the same `pricing` slice. `ui` carries the named policy, which the hours
                alone cannot express. */}
            <CancellationStep
              data={formData.pricing}
              update={set.pricing}
              ui={formData.ui}
              updateUi={set.ui}
            />
          </MergedStep>
        );
      case "availability":
        return (
          <MergedStep>
            <HoursStep
              data={formData.workingHours}
              update={set.workingHours}
            />
            <BookingStep
              data={formData.bookingPolicy}
              update={set.bookingPolicy}
            />
          </MergedStep>
        );
      case "licenses":
        return (
          <LicensesStep
            data={formData.licenses}
            update={set.licenses}
            reference={reference}
            defaultState={formData.profile.address.state}
          />
        );
      case "publish":
        return (
          <PublishStep
            review={review}
            readiness={readiness}
            onJumpToStep={(key) => {
              const idx = STEPS.findIndex((s) => s.key === key);
              if (idx >= 0) void goTo(idx);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    // `h-dvh` plus a `min-h-0` flex child is what lets the card take the leftover height and
    // scroll inside itself, so the step navigation stays put on a long step.
    <div className="flex h-dvh flex-col items-center gap-6 p-4 sm:p-6">
      <div className="w-full max-w-4xl shrink-0">
        <StepIndicator
          current={step}
          lockedReason={heldOnBusiness ? "the Business step is complete" : undefined}
          onJump={(index) => void goTo(index)}
        />
      </div>

      <Card className="flex w-full max-w-4xl min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>{STEPS[step].title}</CardTitle>
        </CardHeader>
        <Separator />
        {/* Sealed while a save is in flight: `saveStep` is handed the form as it stood when
            the button was pressed and hands it back settled, so a keystroke made during the
            round trip would be overwritten and never sent. The buttons sit outside this. */}
        <CardContent
          inert={busy}
          aria-busy={busy || undefined}
          className="min-h-0 flex-1 overflow-y-auto py-5"
        >
          {renderStep()}
        </CardContent>
        <Separator />

        {problem !== null && <ProblemStrip>{problem}</ProblemStrip>}

        {shownNotice !== null && <NoticeStrip>{shownNotice}</NoticeStrip>}

        {question !== null && (
          <ConfirmationQuestion
            kind={question.kind}
            detail={question.detail}
            busy={busy}
            onConfirm={() => void answerQuestion(question.kind, question.then)}
            onCancel={dismissQuestion}
          />
        )}

        <CardFooter className="flex shrink-0 justify-between bg-transparent">
          {step === 0 ? (
            <div />
          ) : (
            <Button
              variant="ghost"
              size="lg"
              className={FOOTER_BUTTON}
              onClick={goBack}
              disabled={busy}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <div className="flex gap-2">
            {/* Only after a save-and-leave that could not save, and beside that button rather
                than replacing it: one stores the step and one gives up on it. */}
            {leaveOffered && (
              <Button
                variant="ghost"
                size="lg"
                className={FOOTER_BUTTON}
                onClick={leaveAnyway}
                disabled={busy}
              >
                Leave without saving
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className={FOOTER_BUTTON}
              onClick={() => void saveAndLeave()}
              disabled={busy}
            >
              {pending === "saving" ? "Saving…" : "Save & finish later"}
            </Button>
            {isPublishStep ? (
              <Button
                size="lg"
                className={FOOTER_BUTTON}
                disabled={!canPublish || busy}
                onClick={() => void publish()}
              >
                <Rocket className="h-4 w-4 mr-1" />
                {pending === "publishing" ? "Publishing…" : "Publish profile"}
              </Button>
            ) : (
              <Button
                size="lg"
                className={FOOTER_BUTTON}
                onClick={() => void goNext()}
                disabled={busy || heldOnBusiness}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * What pressing Back is answered with while something is unwritten. It offers the two things
 * that were already on the screen rather than a third: the button that stores this and leaves,
 * and the one that leaves without it.
 */
const UNSAVED_ON_THE_WAY_BACK =
  "There are answers here that have not been saved yet. Save & finish later stores them and " +
  "takes you to the dashboard — or leave without saving, and they are the only thing you lose.";

/**
 * What dismissing the unpublish question leaves behind, said plainly because the screen and the
 * server now disagree: the row is out of this list and the service is still in the catalogue.
 */
const STILL_PUBLISHED =
  "Your profile is still published and the service is still in your catalogue — the removal was " +
  "not applied. It is back on this list the next time the page is loaded; until then, leaving " +
  "it out here changes nothing.";

/**
 * What a refused publish says in the footer. Deliberately says nothing about the reason: the
 * reason is the checklist on the step itself, in the server's words, and repeating it here in
 * this side's words would be the second wording to keep in step.
 */
const PUBLISH_REFUSED =
  "Not published. The checklist at the top of this step is the server's own answer, and it now " +
  "says what is still open.";

/**
 * The Business step's sentence, said in two places: as the reason a step was not written, and as
 * the standing reason the publish button is grey on a profile that does not exist yet.
 */
const NOTHING_CAN_BE_STORED_YET =
  "Not saved yet. Every other part of the profile hangs off the Business step, so nothing " +
  "can be stored until that one is complete. What you have filled in is kept here and " +
  "written as soon as it is.";

/**
 * What the Pricing screen is being held back for.
 *
 * Two things stop it being written and they read differently: an amount a charging mode demands
 * and has not been given, and one typed in a shape that cannot be stored — which the box it sits
 * in has already said for itself.
 */
function pricingStillOwes(pricing: PricingForm): string {
  const missing = missingPricingFields(pricing);

  return missing.length > 0
    ? `Still to fill in: ${missing.join(", ")} — a travel or material charge cannot be stored ` +
        "without the amount it names."
    : "One of the amounts on the Pricing step is not in a shape that can be stored, and the " +
        "box it is in says which.";
}

/** The days whose ranges run into each other, named, because the step is a week of them. */
function overlappingDays(week: ProfileFormData["workingHours"]): string {
  const days = week
    .filter((day) => overlappingBlockKeys(day.blocks).size > 0)
    .map((day) => dayName(day.dayOfWeek));

  return days.length === 1 ? days[0] : `${days.slice(0, -1).join(", ")} and ${days.at(-1)}`;
}

/**
 * Why a step was not written, where not writing it was the right thing to do.
 *
 * Functions rather than sentences because two of the four have to read the form. The other two
 * deliberately name no field — a field says that itself, in the place it is — but which amount
 * the Pricing screen is still owed depends on which charging mode is selected, and "one of them"
 * would send somebody back to a screen of six boxes to work out which. The overlapping day is
 * named for the same reason: the step scrolls, and the marked ranges may be off screen.
 */
const NOT_SAVED: Record<Deferral, (form: ProfileFormData) => string> = {
  "profile-incomplete": () =>
    "Not saved yet. Both names, a phone number, an email address, the full address and a time " +
    "zone have to be there before a profile can exist at all. Everything you have filled in is " +
    "kept here in the meantime.",
  "no-profile-yet": () => NOTHING_CAN_BE_STORED_YET,
  "pricing-incomplete": (form) =>
    `Your rates were not saved. ${pricingStillOwes(form.pricing)} Everything else you have ` +
    "filled in is kept here in the meantime.",
  "hours-overlap": (form) =>
    `Your hours were not saved. Two ranges on ${overlappingDays(form.workingHours)} run into ` +
    "each other, and a week can only be stored whole. Everything else you have filled in is " +
    "kept here in the meantime.",
  "services-incomplete": () =>
    "Your services were saved, apart from one that is not finished — the row carries a badge " +
    "saying what it still needs. It is kept here in the meantime.",
  "licenses-incomplete": () =>
    "Your licences were saved, apart from one that is not finished — the row carries a badge " +
    "saying what it still needs. It is kept here in the meantime.",
};

/**
 * The same four moments, said to somebody who is leaving rather than moving on. "Kept here in
 * the meantime" is false of this move: the form lives in this component, and the component is
 * about to go.
 */
const NOTHING_TO_LEAVE_BEHIND: Record<Deferral, (form: ProfileFormData) => string> = {
  // Not "nothing was saved": this one is reached on a profile that already exists — an answer
  // cleared out of a resumed form — and the steps behind it have been written by the time this
  // is said. Only the Business step was held back, and that is what it says.
  "profile-incomplete": () =>
    "Your business details were not saved. A profile cannot be stored without both names, a " +
    "phone number, an email address, the full address and a time zone — the notice above says " +
    "which of them are still open. Fill them in and press Save & finish later again, or leave " +
    "now and pick this up whenever you like.",
  "no-profile-yet": () =>
    "Nothing was saved. Every part of the profile hangs off the Business step, and that one " +
    "is not complete yet, so there is nowhere for these answers to be stored. Go back to it " +
    "and press Save & finish later again, or leave now and start again whenever you like.",
  "pricing-incomplete": (form) =>
    `Your rates were not saved. ${pricingStillOwes(form.pricing)} Put it right and press ` +
    "Save & finish later again, or leave now and pick this up whenever you like.",
  "hours-overlap": (form) =>
    `Your hours were not saved. Two ranges on ${overlappingDays(form.workingHours)} run into ` +
    "each other, and a week can only be stored whole. Put it right and press Save & finish " +
    "later again, or leave now and pick this up whenever you like.",
  "services-incomplete": () =>
    "A service on that list is not finished, so it was not saved — the badge on the row says " +
    "what it still needs. Everything else on the step was stored. Complete it or remove it and " +
    "press Save & finish later again, or leave now and lose that one row.",
  "licenses-incomplete": () =>
    "A licence on that list is not finished, so it was not saved — the badge on the row says " +
    "what it still needs. Everything else on the step was stored. Complete it or remove it and " +
    "press Save & finish later again, or leave now and lose that one row.",
};

/**
 * The calm counterpart of `ProblemStrip`. Deliberately not red and deliberately no
 * `role="alert"`: nothing has gone wrong.
 */
function NoticeStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b bg-muted/40 px-6 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * What the server said, in its own words. Shown rather than translated: `detail` is written
 * for the tradesperson, and a rewording here would be a second wording to keep in step.
 */
function ProblemStrip({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-3 border-b bg-destructive/5 px-6 py-3"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="text-sm">{children}</p>
    </div>
  );
}

/**
 * What each answer is called. The sentence above the buttons is the server's, and this is the
 * whole of what the two questions do not share.
 *
 * Both are refusals a person answers rather than errors. The time zone one is asked because
 * nothing on that screen shows that the zone reaches into the working week three steps later:
 * hours are stored as local wall clock and do not move — Monday 08:00 stays 08:00 — but the
 * instants behind them do, and with them every slot on offer. The unpublish one is asked because
 * removing the last bookable service takes the profile off the marketplace, which is a decision
 * rather than a side effect.
 */
const CONFIRM_LABEL: Record<Confirmation, string> = {
  "time-zone-change": "Move my calendar",
  unpublish: "Remove it and unpublish",
};

const DISMISS_LABEL: Record<Confirmation, string> = {
  "time-zone-change": "Go back and change it",
  unpublish: "Keep my profile published",
};

function ConfirmationQuestion({
  kind,
  detail,
  busy,
  onConfirm,
  onCancel,
}: {
  kind: Confirmation;
  detail: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b bg-muted/40 px-6 py-4">
      <p className="text-sm">{detail}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onConfirm} disabled={busy}>
          {CONFIRM_LABEL[kind]}
        </Button>
        {/* Dismisses the question and nothing else — see `dismissQuestion`. */}
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          {DISMISS_LABEL[kind]}
        </Button>
      </div>
    </div>
  );
}
