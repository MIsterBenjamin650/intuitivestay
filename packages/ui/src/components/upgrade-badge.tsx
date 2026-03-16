import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva } from "class-variance-authority"

import { cn } from "@intuitive-stay/ui/lib/utils"

const upgradeBadgeVariants = cva(
  "group/upgrade-badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-full border border-transparent bg-gradient-to-r from-orange-500 via-fuchsia-500 to-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
)

function UpgradeBadge({
  className,
  render,
  children,
  ...props
}: useRender.ComponentProps<"span">) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(upgradeBadgeVariants(), className),
        children: children ?? "Upgrade",
      },
      props
    ),
    render,
    state: {
      slot: "upgrade-badge",
    },
  })
}

export { UpgradeBadge, upgradeBadgeVariants }
