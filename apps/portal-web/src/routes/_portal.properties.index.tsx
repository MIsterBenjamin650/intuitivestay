import * as React from "react"
import { Badge } from "@intuitive-stay/ui/components/badge"
import { Button } from "@intuitive-stay/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@intuitive-stay/ui/components/card"
import { Input } from "@intuitive-stay/ui/components/input"
import { Label } from "@intuitive-stay/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@intuitive-stay/ui/components/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@intuitive-stay/ui/components/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@intuitive-stay/ui/components/table"
import {
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useTRPC } from "@/utils/trpc"
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
} from "lucide-react"

type PropertyType =
  | "Bar"
  | "Cafe"
  | "Guesthouse/B&B"
  | "Hostel"
  | "Hotel"
  | "Pub"
  | "Resort"
  | "Restaurant"
  | "Other"

type PropertyRow = {
  id: string
  name: string
  status: "pending" | "approved" | "rejected"
  type: string | null
  ownerName: string
  ownerEmail: string
  city: string
  country: string
}

type AddPropertyFormValues = {
  propertyName: string
  propertyType: PropertyType
  ownerName: string
  ownerEmail: string
  businessPhone: string
  businessWebsite: string
  addressLine1: string
  addressCity: string
  addressPostalCode: string
  addressCountry: string
}


const DEFAULT_ADD_FORM_VALUES: AddPropertyFormValues = {
  propertyName: "",
  propertyType: "Hotel",
  ownerName: "",
  ownerEmail: "",
  businessPhone: "",
  businessWebsite: "",
  addressLine1: "",
  addressCity: "",
  addressPostalCode: "",
  addressCountry: "United Kingdom",
}
const PROPERTY_TYPE_OPTIONS = [
  "Bar",
  "Cafe",
  "Guesthouse/B&B",
  "Hostel",
  "Hotel",
  "Pub",
  "Resort",
  "Restaurant",
  "Other",
] as const
const STATUS_FILTER_VALUES = ["all", "approved", "awaiting-approval"] as const
const TYPE_FILTER_VALUES = ["all", ...PROPERTY_TYPE_OPTIONS] as const
const SORT_KEY_VALUES = ["id", "name", "status", "type", "ownerName"] as const
const SORT_DIR_VALUES = ["asc", "desc"] as const
const PAGE_SIZE_OPTIONS = [5, 10, 20] as const

type StatusFilter = (typeof STATUS_FILTER_VALUES)[number]
type TypeFilter = (typeof TYPE_FILTER_VALUES)[number]
type SortKey = (typeof SORT_KEY_VALUES)[number]
type SortDir = (typeof SORT_DIR_VALUES)[number]
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

type PropertiesSearch = {
  q?: string
  status?: StatusFilter
  type?: TypeFilter
  sort?: SortKey
  dir?: SortDir
  page?: number
  pageSize?: PageSize
}

type ResolvedPropertiesSearch = {
  q: string
  status: StatusFilter
  type: TypeFilter
  sort: SortKey
  dir: SortDir
  page: number
  pageSize: PageSize
}

const DEFAULT_SEARCH: ResolvedPropertiesSearch = {
  q: "",
  status: "all",
  type: "all",
  sort: "id",
  dir: "asc",
  page: 1,
  pageSize: 10,
}

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  approved: "Approved",
  "awaiting-approval": "Awaiting approval",
}

type ColumnMeta = {
  headClassName?: string
  cellClassName?: string
}

function isStatusFilter(value: unknown): value is StatusFilter {
  return (
    typeof value === "string" &&
    STATUS_FILTER_VALUES.includes(value as StatusFilter)
  )
}

function isTypeFilter(value: unknown): value is TypeFilter {
  return typeof value === "string" && TYPE_FILTER_VALUES.includes(value as TypeFilter)
}

function isPropertyType(value: unknown): value is PropertyType {
  return (
    typeof value === "string" &&
    PROPERTY_TYPE_OPTIONS.includes(value as PropertyType)
  )
}

function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && SORT_KEY_VALUES.includes(value as SortKey)
}

function isSortDir(value: unknown): value is SortDir {
  return typeof value === "string" && SORT_DIR_VALUES.includes(value as SortDir)
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return fallback
}

function parsePageSize(value: unknown): PageSize {
  const parsed = parsePositiveInteger(value, DEFAULT_SEARCH.pageSize)
  if (PAGE_SIZE_OPTIONS.includes(parsed as PageSize)) {
    return parsed as PageSize
  }

  return DEFAULT_SEARCH.pageSize
}

function validateSearch(search: Record<string, unknown>): PropertiesSearch {
  return {
    q: typeof search.q === "string" ? search.q : DEFAULT_SEARCH.q,
    status: isStatusFilter(search.status) ? search.status : DEFAULT_SEARCH.status,
    type: isTypeFilter(search.type) ? search.type : DEFAULT_SEARCH.type,
    sort: isSortKey(search.sort) ? search.sort : DEFAULT_SEARCH.sort,
    dir: isSortDir(search.dir) ? search.dir : DEFAULT_SEARCH.dir,
    page: parsePositiveInteger(search.page, DEFAULT_SEARCH.page),
    pageSize: parsePageSize(search.pageSize),
  }
}

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden>
      *
    </span>
  )
}

export const Route = createFileRoute("/_portal/properties/")({
  beforeLoad: async ({ context }) => {
    const session = context.session as {
      plan?: string | null
      user?: { properties?: Array<{ id: string }> }
    } | null
    const plan = session?.plan ?? null
    if (plan !== "founder") {
      const properties = session?.user?.properties ?? []
      const firstId = properties[0]?.id
      if (firstId) {
        throw redirect({
          to: "/properties/$propertyId/dashboard",
          params: { propertyId: firstId },
        })
      }
      throw redirect({ to: "/" })
    }
  },
  validateSearch,
  component: RouteComponent,
})

function RouteComponent() {
  const rawSearch = Route.useSearch()
  const navigate = useNavigate()
  const trpc = useTRPC()
  const { data: rawProperties = [], isLoading } = useQuery(
    trpc.properties.getMyProperties.queryOptions(),
  )
  const properties: PropertyRow[] = rawProperties.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status as "pending" | "approved" | "rejected",
    type: p.type,
    ownerName: p.ownerName,
    ownerEmail: p.ownerEmail,
    city: p.city,
    country: p.country,
  }))
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [addFormValues, setAddFormValues] =
    React.useState<AddPropertyFormValues>(DEFAULT_ADD_FORM_VALUES)
  const [addFormError, setAddFormError] = React.useState<string | null>(null)

  const search = React.useMemo<ResolvedPropertiesSearch>(
    () => ({
      q: rawSearch.q ?? DEFAULT_SEARCH.q,
      status: rawSearch.status ?? DEFAULT_SEARCH.status,
      type: rawSearch.type ?? DEFAULT_SEARCH.type,
      sort: rawSearch.sort ?? DEFAULT_SEARCH.sort,
      dir: rawSearch.dir ?? DEFAULT_SEARCH.dir,
      page: rawSearch.page ?? DEFAULT_SEARCH.page,
      pageSize: rawSearch.pageSize ?? DEFAULT_SEARCH.pageSize,
    }),
    [rawSearch]
  )

  const updateSearch = React.useCallback(
    (nextPartial: Partial<ResolvedPropertiesSearch>) => {
      void navigate({
        to: "/properties/",
        search: {
          ...search,
          ...nextPartial,
        },
      })
    },
    [navigate, search]
  )

  const handleAddDialogOpenChange = React.useCallback((open: boolean) => {
    setIsAddDialogOpen(open)
    if (!open) {
      setAddFormValues(DEFAULT_ADD_FORM_VALUES)
      setAddFormError(null)
    }
  }, [])

  const updateAddFormValue = React.useCallback(
    <K extends keyof AddPropertyFormValues>(key: K, value: AddPropertyFormValues[K]) => {
      setAddFormValues((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const handleAddPropertySubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      // Properties are registered automatically via the Wix bridge
      setIsAddDialogOpen(false)
    },
    []
  )

  const filteredData = React.useMemo(() => {
    const query = search.q.trim().toLowerCase()

    return properties.filter((property) => {
      if (search.status !== "all" && property.status !== search.status) {
        return false
      }

      if (search.type !== "all" && property.type !== search.type) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        property.id,
        property.name,
        property.status,
        property.type ?? "",
        property.ownerName,
        property.ownerEmail,
        property.city,
        property.country,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [properties, search.q, search.status, search.type])

  const sorting = React.useMemo<SortingState>(
    () => [{ id: search.sort, desc: search.dir === "desc" }],
    [search.dir, search.sort]
  )

  const pagination = React.useMemo<PaginationState>(
    () => ({ pageIndex: Math.max(search.page - 1, 0), pageSize: search.pageSize }),
    [search.page, search.pageSize]
  )

  const handleSortingChange = React.useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const next = functionalUpdate(updater, sorting)
      const primarySort = next[0]

      if (!primarySort) {
        updateSearch({
          sort: DEFAULT_SEARCH.sort,
          dir: DEFAULT_SEARCH.dir,
          page: DEFAULT_SEARCH.page,
        })
        return
      }

      updateSearch({
        sort: (primarySort.id as SortKey) ?? DEFAULT_SEARCH.sort,
        dir: primarySort.desc ? "desc" : "asc",
        page: DEFAULT_SEARCH.page,
      })
    },
    [sorting, updateSearch]
  )

  const handlePaginationChange = React.useCallback<OnChangeFn<PaginationState>>(
    (updater) => {
      const next = functionalUpdate(updater, pagination)
      updateSearch({
        page: next.pageIndex + 1,
        pageSize: next.pageSize as PageSize,
      })
    },
    [pagination, updateSearch]
  )

  const columns = React.useMemo<ColumnDef<PropertyRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
            Property Name <ArrowUpDownIcon className="ml-1 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <a
            href={`/properties/${row.original.id}/dashboard`}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </a>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status
          return (
            <Badge
              variant={
                s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary"
              }
            >
              {s === "pending"
                ? "Awaiting Approval"
                : s.charAt(0).toUpperCase() + s.slice(1)}
            </Badge>
          )
        },
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => row.original.type ?? "—",
      },
      {
        accessorKey: "city",
        header: "City",
      },
      {
        accessorKey: "ownerName",
        header: "Owner",
      },
      {
        accessorKey: "ownerEmail",
        header: "Email",
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const pageCount = table.getPageCount()

  React.useEffect(() => {
    if (pageCount > 0 && search.page > pageCount) {
      updateSearch({ page: pageCount })
    }
  }, [pageCount, search.page, updateSearch])

  const hasActiveFilters =
    search.q.length > 0 || search.status !== "all" || search.type !== "all"

  const currentPage = pageCount > 0 ? Math.min(search.page, pageCount) : 1
  const totalPages = Math.max(pageCount, 1)

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>Properties</CardTitle>
            <CardDescription>Overview of all organisation properties</CardDescription>
            <CardAction>
              <Button size="sm" onClick={() => handleAddDialogOpenChange(true)}>
                <PlusIcon data-icon="inline-start" />
                Add Property
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Input
                type="search"
                value={search.q}
                onChange={(event) =>
                  updateSearch({ q: event.target.value, page: DEFAULT_SEARCH.page })
                }
                placeholder="Search properties"
                className="h-8 w-64"
                aria-label="Search properties"
              />

              <Select
                value={search.status}
                onValueChange={(value) =>
                  updateSearch({
                    status: value && isStatusFilter(value) ? value : DEFAULT_SEARCH.status,
                    page: DEFAULT_SEARCH.page,
                  })
                }
              >
                <SelectTrigger className="w-52">
                  <SelectValue>{STATUS_FILTER_LABELS[search.status]}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="awaiting-approval">Awaiting approval</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={search.type}
                onValueChange={(value) =>
                  updateSearch({
                    type: value && isTypeFilter(value) ? value : DEFAULT_SEARCH.type,
                    page: DEFAULT_SEARCH.page,
                  })
                }
              >
                <SelectTrigger className="w-52">
                  <SelectValue>
                    {search.type === "all" ? "All types" : search.type}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All types</SelectItem>
                  {PROPERTY_TYPE_OPTIONS.map((propertyType) => (
                    <SelectItem key={propertyType} value={propertyType}>
                      {propertyType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="default"
                variant="outline"
                className="whitespace-nowrap"
                disabled={!hasActiveFilters}
                onClick={() =>
                  updateSearch({
                    q: DEFAULT_SEARCH.q,
                    status: DEFAULT_SEARCH.status,
                    type: DEFAULT_SEARCH.type,
                    page: DEFAULT_SEARCH.page,
                  })
                }
              >
                Reset filters
              </Button>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading properties…</p>
            ) : (
            <div className="min-w-0 w-full overflow-x-auto">
              <Table className="min-w-[1320px] text-xs [&_th]:h-8 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1.5 [&_td]:whitespace-nowrap">
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const meta = header.column.columnDef.meta as ColumnMeta | undefined
                        const sorted = header.column.getIsSorted()

                        if (header.isPlaceholder) {
                          return <TableHead key={header.id} />
                        }

                        return (
                          <TableHead
                            key={header.id}
                            className={meta?.headClassName}
                          >
                            {header.column.getCanSort() ? (
                              <button
                                type="button"
                                className="flex w-full items-center gap-1 text-left font-medium"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                <span>
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                                </span>
                                {sorted === "asc" ? (
                                  <ChevronUpIcon
                                    data-icon="inline-end"
                                    className="size-3.5 shrink-0 text-muted-foreground"
                                  />
                                ) : sorted === "desc" ? (
                                  <ChevronDownIcon
                                    data-icon="inline-end"
                                    className="size-3.5 shrink-0 text-muted-foreground"
                                  />
                                ) : (
                                  <ArrowUpDownIcon
                                    data-icon="inline-end"
                                    className="size-3.5 shrink-0 text-muted-foreground"
                                  />
                                )}
                              </button>
                            ) : (
                              flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )
                            )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>

                <TableBody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => {
                          const meta = cell.column.columnDef.meta as ColumnMeta | undefined
                          return (
                            <TableCell
                              key={cell.id}
                              className={meta?.cellClassName}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={table.getVisibleLeafColumns().length}
                        className="h-16 text-center text-muted-foreground"
                      >
                        No properties found for current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows per page</span>
                <Select
                  value={String(search.pageSize)}
                  onValueChange={(value) => {
                    if (!value) {
                      return
                    }
                    const parsed = Number.parseInt(value, 10)
                    if (PAGE_SIZE_OPTIONS.includes(parsed as PageSize)) {
                      updateSearch({
                        pageSize: parsed as PageSize,
                        page: DEFAULT_SEARCH.page,
                      })
                    }
                  }}
                >
                  <SelectTrigger className="w-20" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  Prev
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpenChange}>
        <DialogContent className="w-full sm:max-w-3xl">
          <form className="flex min-h-0 flex-col" onSubmit={handleAddPropertySubmit}>
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Add Property</DialogTitle>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-8">
              <div className="grid gap-6 pb-8">
                <div className="grid gap-2">
                  <Label htmlFor="property-name">
                    Name
                    <RequiredMark />
                  </Label>
                  <Input
                    id="property-name"
                    value={addFormValues.propertyName}
                    onChange={(event) =>
                      updateAddFormValue("propertyName", event.target.value)
                    }
                    placeholder="e.g. Riverside Hotel"
                    className="h-10"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="property-type">
                    Type
                    <RequiredMark />
                  </Label>
                  <Select
                    value={addFormValues.propertyType}
                    onValueChange={(value) => {
                      if (value && isPropertyType(value)) {
                        updateAddFormValue("propertyType", value)
                      }
                    }}
                  >
                    <SelectTrigger id="property-type" className="h-10">
                      <SelectValue>{addFormValues.propertyType}</SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      {PROPERTY_TYPE_OPTIONS.map((propertyType) => (
                        <SelectItem key={propertyType} value={propertyType}>
                          {propertyType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="owner-name">
                      Owner Name
                      <RequiredMark />
                    </Label>
                    <Input
                      id="owner-name"
                      value={addFormValues.ownerName}
                      onChange={(event) =>
                        updateAddFormValue("ownerName", event.target.value)
                      }
                      placeholder="e.g. Alex Johnson"
                      className="h-10"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="owner-email">
                      Owner Email
                      <RequiredMark />
                    </Label>
                    <Input
                      id="owner-email"
                      type="email"
                      value={addFormValues.ownerEmail}
                      onChange={(event) =>
                        updateAddFormValue("ownerEmail", event.target.value)
                      }
                      placeholder="owner@example.com"
                      className="h-10"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="business-phone">
                      Business Phone
                      <RequiredMark />
                    </Label>
                    <Input
                      id="business-phone"
                      value={addFormValues.businessPhone}
                      onChange={(event) =>
                        updateAddFormValue("businessPhone", event.target.value)
                      }
                      placeholder="+44 20 0000 0000"
                      className="h-10"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="business-website">Business Website</Label>
                    <Input
                      id="business-website"
                      value={addFormValues.businessWebsite}
                      onChange={(event) =>
                        updateAddFormValue("businessWebsite", event.target.value)
                      }
                      placeholder="https://example.com"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address-line">
                    Address Line
                    <RequiredMark />
                  </Label>
                  <Input
                    id="address-line"
                    value={addFormValues.addressLine1}
                    onChange={(event) =>
                      updateAddFormValue("addressLine1", event.target.value)
                    }
                    placeholder="e.g. 10 River Road"
                    className="h-10"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div className="grid gap-2 sm:col-span-1">
                    <Label htmlFor="address-city">
                      City
                      <RequiredMark />
                    </Label>
                    <Input
                      id="address-city"
                      value={addFormValues.addressCity}
                      onChange={(event) =>
                        updateAddFormValue("addressCity", event.target.value)
                      }
                      placeholder="City"
                      className="h-10"
                      required
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-1">
                    <Label htmlFor="address-postcode">
                      Postal Code
                      <RequiredMark />
                    </Label>
                    <Input
                      id="address-postcode"
                      value={addFormValues.addressPostalCode}
                      onChange={(event) =>
                        updateAddFormValue("addressPostalCode", event.target.value)
                      }
                      placeholder="Postal code"
                      className="h-10"
                      required
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-1">
                    <Label htmlFor="address-country">
                      Country
                      <RequiredMark />
                    </Label>
                    <Input
                      id="address-country"
                      value={addFormValues.addressCountry}
                      onChange={(event) =>
                        updateAddFormValue("addressCountry", event.target.value)
                      }
                      placeholder="Country"
                      className="h-10"
                      required
                    />
                  </div>
                </div>

                {addFormError ? (
                  <p className="text-xs text-destructive">{addFormError}</p>
                ) : null}
              </div>
            </div>

            <DialogFooter className="border-t border-border flex-row justify-end px-8 py-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
