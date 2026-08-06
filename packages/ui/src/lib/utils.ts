import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Builds a Tailwind class string from conditional inputs, resolving conflicts
 * so the last declared utility wins.
 *
 * `clsx` flattens the inputs (strings, arrays, and objects whose truthy keys are
 * kept) into a single space-separated string; `twMerge` then drops earlier
 * Tailwind utilities that target the same CSS property as a later one. This is
 * what lets a component expose a `className` prop that overrides its own
 * defaults instead of fighting them on specificity.
 *
 * @param inputs - Any number of `clsx` class values: strings, numbers, arrays,
 * or `{ "class-name": boolean }` maps. Falsy entries (`false`, `null`,
 * `undefined`, `0`, `""`) are ignored.
 * @returns The merged class string, with conflicting Tailwind utilities removed.
 *
 * @example
 * ```ts
 * cn("px-2 py-1", "px-4");            // "py-1 px-4" — later padding wins
 * cn("text-sm", isActive && "font-bold"); // "text-sm" when isActive is false
 * cn("rounded-md", className);        // caller can override the default radius
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
