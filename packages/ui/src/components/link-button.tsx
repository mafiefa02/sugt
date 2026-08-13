import { useRender } from "@base-ui/react/use-render";
import { cn } from "@sugt/ui/lib/utils";
import { type VariantProps } from "class-variance-authority";

import { buttonVariants } from "./button";

/**
 * A link that looks like a Button — for any control that **navigates**. It renders a real anchor
 * (`role: link`, Enter follows it, Space does not), styled from `buttonVariants` so it matches
 * `Button`. The app injects its router's link through `render`, keeping this package free of
 * `next/link`. Why this exists rather than `<Button render={<Link />}>`, and why
 * `nativeButton={false}` is the wrong fix, is in the README's "Button vs LinkButton".
 */
function LinkButton({
  render,
  variant = "default",
  size = "default",
  className,
  ...props
}: useRender.ComponentProps<"a"> & VariantProps<typeof buttonVariants>) {
  return useRender({
    render,
    defaultTagName: "a",
    props: {
      "data-slot": "button",
      className: cn(buttonVariants({ variant, size, className })),
      ...props,
    },
  });
}

export { LinkButton };
