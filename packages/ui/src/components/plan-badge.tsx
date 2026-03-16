import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@intuitive-stay/ui/lib/utils"

const planBadgeVariants = cva(
  "group/plan-badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 text-[10px] font-semibold transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        essentialist:
          "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
        "growth-pro": "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
        "elite-mastery":
          "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
      },
    },
    defaultVariants: {
      variant: "essentialist",
    },
  }
)

type PlanBadgeVariant = NonNullable<VariantProps<typeof planBadgeVariants>["variant"]>

const PLAN_BADGE_LABELS: Record<PlanBadgeVariant, string> = {
  essentialist: "Essentialist",
  "growth-pro": "Growth Pro",
  "elite-mastery": "Elite Mastery",
}

type PlanBadgeProps = Omit<useRender.ComponentProps<"span">, "children"> &
  VariantProps<typeof planBadgeVariants>

function PlanBadge({
  className,
  variant = "essentialist",
  render,
  ...props
}: PlanBadgeProps) {
  const resolvedVariant = variant ?? "essentialist"

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(planBadgeVariants({ variant: resolvedVariant }), className),
        children: PLAN_BADGE_LABELS[resolvedVariant],
      },
      props
    ),
    render,
    state: {
      slot: "plan-badge",
      variant: resolvedVariant,
    },
  })
}

export { PlanBadge, planBadgeVariants }
export type { PlanBadgeVariant }
