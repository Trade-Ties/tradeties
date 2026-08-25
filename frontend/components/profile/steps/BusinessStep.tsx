import { FieldGrid, TextField, TextareaField } from "@/components/ui/field";
import { ProfileUrlField, type SlugAnswer } from "../ProfileUrlField";
import { DIGIT, useCaret } from "../caret";
import { FIELD_MAX } from "../constants";
import { slugify } from "../slug";
import { format as formatPhone } from "../phone";
import { useTouched } from "../touched";
import type { ProfileForm, StepProps } from "../types";
import { emailProblem, phoneProblem } from "../validate";

interface BusinessStepProps extends StepProps<ProfileForm> {
  /**
   * Whether the URL has stopped being theirs to change. Threaded through rather than worked out
   * here — see `StoredState.slugLocked` for why the status cannot answer it.
   */
  slugLocked: boolean;
  /** Handed straight to the URL field — see `ProfileUrlField`'s own `check` for why. */
  checkSlug: (slug: string) => Promise<SlugAnswer>;
}

export function BusinessStep({ data, update, slugLocked, checkSlug }: BusinessStepProps) {
  /**
   * Whether the URL still follows the display name. It does until it is taken over by hand,
   * after which it is left alone.
   *
   * Derived rather than remembered: this component is unmounted every time the wizard leaves the
   * Business step, so a `useState` would have to be re-seeded on the way back and could only
   * guess. What a hand edit leaves behind is a slug the display name would not have proposed,
   * and that survives a remount.
   *
   * A locked URL follows nothing: this is the second lock, on the write rather than the control.
   */
  const slugFollowsName =
    !slugLocked && (data.slug === "" || data.slug === slugify(data.displayName));
  /**
   * The format complaints, held back until the box has been left.
   *
   * Only the shape is checked here, never whether anything is there: a blank field is a
   * perfectly good answer until the moment somebody publishes. See `validate.ts`.
   */
  const { touch, settled } = useTouched();
  /** The phone box regroups what is typed, so the caret has to be put back — see `caret.ts`. */
  const keepCaret = useCaret();

  /** The display name, and the URL that follows it until the URL is taken over by hand. */
  const editDisplayName = (displayName: string) =>
    update({
      ...data,
      displayName,
      slug: slugFollowsName ? slugify(displayName) : data.slug,
    });

  /** Already lower case and hyphenated by the field itself, so it is stored as it arrives. */
  const editSlug = (slug: string) => update({ ...data, slug });

  return (
    <>
      <FieldGrid columns={2}>
        <TextField
          label="Legal name"
          required
          hint="The registered name, including the legal form."
          placeholder="Joe's Plumbing LLC"
          value={data.legalName}
          maxLength={FIELD_MAX.legalName}
          onChange={(e) => update({ ...data, legalName: e.target.value })}
        />

        <TextField
          label="Display name"
          required
          hint="What clients see."
          placeholder="Joe's Plumbing"
          value={data.displayName}
          maxLength={FIELD_MAX.displayName}
          onChange={(e) => editDisplayName(e.target.value)}
        />
      </FieldGrid>

      {/* The city and state come from `LocationStep`, further down this same screen: both
          halves edit one slice of the form, so the URL field can offer "…-denver" when the
          name it proposed turns out to be taken. */}
      <ProfileUrlField
        slug={data.slug}
        city={data.address.city}
        state={data.address.state}
        locked={slugLocked}
        onChange={editSlug}
        check={checkSlug}
      />

      <TextareaField
        label="Description"
        value={data.description}
        maxLength={FIELD_MAX.description}
        showCount
        rows={5}
        onChange={(e) => update({ ...data, description: e.target.value })}
      />

      <FieldGrid columns={2}>
        <TextField
          label="Email"
          required
          type="email"
          autoComplete="email"
          hint="May differ from the address you sign in with."
          value={data.email}
          error={settled("email", emailProblem(data.email))}
          onBlur={touch("email")}
          onChange={(e) => update({ ...data, email: e.target.value })}
        />

        <TextField
          label="Phone"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(303) 555-0101"
          value={data.phone}
          error={settled("phone", phoneProblem(data.phone))}
          onBlur={touch("phone")}
          onChange={(e) => {
            const phone = formatPhone(e.target.value);

            keepCaret(e, phone, DIGIT);
            update({ ...data, phone });
          }}
        />
      </FieldGrid>

      <TextField
        label="Website"
        type="url"
        inputMode="url"
        placeholder="joesplumbing.com"
        value={data.websiteUrl}
        onChange={(e) => update({ ...data, websiteUrl: e.target.value })}
      />
    </>
  );
}
