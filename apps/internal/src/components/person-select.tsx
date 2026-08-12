"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";

/** Anybody a picker on any of these screens can name. */
type SelectablePerson = {
  id: string;
  fullName: string;
};

/**
 * One Person, chosen from a roster.
 *
 * **`""` is the unset value**, throughout and deliberately: every caller needs to
 * distinguish "nobody chosen yet" from a chosen Person, and every one of them already
 * treats the empty string that way when it decides whether a form is complete.
 *
 * This exists because there are three of these — the PIC and each Stream's professor on
 * Rencanakan Perjadin, each Stream on Tandai terlaksana, and the shared PIC and per-row
 * teachers on Jadwalkan Sesi daring. The convention beside `@sugt/db` is that the second
 * module wanting an expression earns the helper; this is the third.
 *
 * **`unassignedLabel` is what Jadwalkan Sesi daring needs and the others do not.** There,
 * choosing nobody is an act rather than an absence: the shared PIC is a *default*, and a row
 * has to be able to say "leave this one empty on purpose" before the default is applied
 * again. That is an item in the list, not a state of the trigger. Omit the prop and there is
 * no such item, which is what the two Session forms want — a Stream with nobody on it is not
 * something anybody chooses there.
 *
 * It lives in the app rather than in `@sugt/ui` because it takes a roster of People, and
 * `@sugt/ui` stays presentational — AGENTS.md rule 4. A component that knows what a Person
 * is, is not a primitive.
 */
function PersonSelect({
  people,
  value,
  onSelect,
  placeholder,
  unassignedLabel,
  id,
  invalid,
  className,
  "aria-label": ariaLabel,
}: {
  people: SelectablePerson[];
  value: string;
  onSelect: (personId: string) => void;
  placeholder?: string;
  /** When given, "nobody" becomes a selectable item under this label rather than an absence. */
  unassignedLabel?: string;
  id?: string;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Select
      items={Object.fromEntries([
        ...(unassignedLabel === undefined ? [] : [["", unassignedLabel]]),
        ...people.map((entry) => [entry.id, entry.fullName]),
      ])}
      // Null clears the trigger. With an unassigned item present, `""` is a real choice and has
      // to travel as itself instead.
      value={value === "" && unassignedLabel === undefined ? null : value}
      onValueChange={(selected) => {
        onSelect((selected as string | null) ?? "");
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        className={className}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {unassignedLabel !== undefined && <SelectItem value="">{unassignedLabel}</SelectItem>}
        {people.map((entry) => (
          <SelectItem
            key={entry.id}
            value={entry.id}
          >
            {entry.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { PersonSelect };
