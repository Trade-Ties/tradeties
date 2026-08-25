/**
 * Everything the profile URL has agreed with the world, in one place.
 *
 * The same reasoning as `phone` and `postalCode`: the format as it is typed, the check for
 * whether it is finished, and the form that goes on the wire have to agree. Here a drift is the
 * least recoverable of the three, because the first publish freezes whatever this produced and
 * `SlugLockedException` refuses every later spelling of it.
 */
export const SLUG_MAX = 80;


/**
 * The part of the public address that is not the tradesperson's to choose. Here rather than
 * typed out at the two places that show it, because the day it becomes a real host name those
 * two must not disagree.
 *
 * From the environment, and the same variable the backend reads (`tradeties.profile-url-prefix`
 * in `application.yml`), with the same default. It is composed into the slug-locked 409 the URL
 * field shows on the very screen that prints this, so a deploy that overrides one and not the
 * other names two different hosts a line apart.
 */
export const PROFILE_URL_PREFIX =
  process.env.NEXT_PUBLIC_PROFILE_URL_PREFIX || "tradeties.com/pro/";

/**
 * A display name as a URL segment: lower case, words joined by single hyphens.
 *
 * Accents are folded rather than dropped, so "Peña Electric" proposes `pena-electric` rather
 * than `pe-a-electric`. The trailing hyphen is stripped after the length cut, which is what can
 * create one.
 */
export function slugify(value: string): string {
  return slugAsTyped(value).replace(/-+$/, "");
}

/**
 * The same, minus the one rule that cannot be applied to a value still being typed.
 *
 * Stripping the trailing hyphen is right for a finished slug and makes a hyphen impossible to
 * type: "joes-" would collapse to "joes", so the next keystroke lands on "joesp". This keeps a
 * single trailing hyphen while the box is being filled in, and `toWire` runs the strict version
 * on the way out, exactly as it tidies a half-typed amount.
 *
 * Any separator counts, not only a typed hyphen: the space bar is the natural way to type the
 * hyphen in "joes-plumbing", and testing the raw value for a literal `-` would miss it.
 */
export function slugAsTyped(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX);
}

/**
 * Whether this is a URL the contract would take, rather than one still being typed.
 *
 * The contract's own `Slug` pattern, which the availability endpoint puts on its query
 * parameter too — so asking about "joes-" is a 400 rather than an answer. `slugify` is what
 * goes out on the wire; this says whether there is anything to ask about yet.
 */
export function isCompleteSlug(value: string): boolean {
  return value.length <= SLUG_MAX && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

/**
 * Alternatives for a URL somebody else already holds, built from where the business works.
 *
 * The town rather than a number: `joes-plumbing-2` tells every customer who reads it that this
 * is the second Joe's Plumbing, and this is the string that ends up on the van.
 *
 * Proposals only — each still goes through the availability check, because two businesses of
 * the same name in the same town is the case this exists for.
 */
export function slugSuggestions(base: string, city: string, state: string): string[] {
  if (base === "") return [];

  const town = slugify(city);
  const region = slugify(state);

  const suffixes = [[town], [town, region], [region]]
    .map((parts) => parts.filter((part) => part !== "").join("-"))
    .filter((suffix) => suffix !== "");

  // A suffix that changed nothing is not an alternative: `slugify` clamps to SLUG_MAX, so a
  // name already at the limit comes back as the slug that was refused a moment ago.
  return [...new Set(suffixes.map((suffix) => slugify(`${base}-${suffix}`)))].filter(
    (slug) => slug !== base
  );
}
