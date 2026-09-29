"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cn } from "@sugt/ui/lib/utils";
import { ChevronDown } from "lucide-react";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("rounded-2xl border border-border", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-border last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionHeader({ className, ...props }: AccordionPrimitive.Header.Props) {
  return (
    <AccordionPrimitive.Header
      data-slot="accordion-header"
      className={cn("flex", className)}
      {...props}
    />
  );
}

/**
 * The bare trigger: no header of its own and no chevron, for a header row that holds more than the
 * trigger — place it inside an `AccordionHeader` and draw any chevron beside it. `AccordionTrigger`
 * below is this plus both.
 */
function AccordionPlainTrigger({ className, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      className={cn(
        "text-left outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionHeader>
      <AccordionPlainTrigger
        className={cn(
          "flex flex-1 items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-foreground transition-all hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&[data-panel-open]>svg]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </AccordionPlainTrigger>
    </AccordionHeader>
  );
}

function AccordionPanel({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className={cn("overflow-hidden text-sm text-muted-foreground", className)}
      {...props}
    >
      <div className="px-4 pt-0 pb-3">{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPlainTrigger,
  AccordionTrigger,
  AccordionPanel,
};
