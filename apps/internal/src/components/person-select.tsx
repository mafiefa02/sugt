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
 * This exists because more than one form picks a Person: the PIC on Rencanakan Perjadin and
 * the PIC on Detail Perjadin's Group editor. It was earned when there were more — each Stream's
 * professor, each Stream on Tandai terlaksana and Jadwalkan Sesi daring's per-row teachers —
 * before teaching went name-based (ADR-0020, ADR-0022) and Sessions lost their Stream
 * (ADR-0034, ADR-0038).
 *
 * **`unassignedLabel` is for a picker where choosing nobody is an act rather than an
 * absence** — a row that must be able to say "leave this one empty on purpose". That is an
 * item in the list, not a state of the trigger. Omit the prop and there is no such item, which
 * is what both PIC pickers want: a trip always has a PIC.
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
  "aria-required": ariaRequired,
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
  "aria-required"?: boolean;
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
        aria-required={ariaRequired}
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
