import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"

export function PropertyPage({
  propertyId,
  title,
  description,
  children,
}: {
  propertyId: string
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
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Active property: <span className="font-medium text-foreground">{propertyId}</span>
          </p>
          {children}
        </CardContent>
      </Card>
    </div>
  )
}
