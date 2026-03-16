import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"

export function PortalPage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children ? <CardContent className="flex flex-col gap-3">{children}</CardContent> : null}
      </Card>
    </div>
  )
}
