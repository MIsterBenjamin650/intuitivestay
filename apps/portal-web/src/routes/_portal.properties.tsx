import * as React from "react"
import { Badge } from "@intuitive-stay/ui/components/badge"
import { Button, buttonVariants } from "@intuitive-stay/ui/components/button"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@intuitive-stay/ui/components/popover"
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
  DialogDescription,
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
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
} from "lucide-react"

type PropertyStatus = "approved" | "awaiting-approval"
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
  propertyId: number
  propertyName: string
  status: PropertyStatus
  propertyType: PropertyType
  ownerName: string
  ownerEmail: string
  businessPhone: string
  businessWebsite: string
  address: {
    line1: string
    city: string
    postalCode: string
    country: string
  }
  routePropertyId?: string
}

type AddPropertyFormValues = {
  propertyName: string
  status: PropertyStatus
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

const MOCK_PROPERTIES: PropertyRow[] = [
  {
    propertyId: 1001,
    propertyName: "Ben Hostels London",
    status: "approved",
    propertyType: "Hostel",
    ownerName: "Ben Clarke",
    ownerEmail: "ben.london@intuitivestay.test",
    businessPhone: "+44 20 7946 1201",
    businessWebsite: "https://benhostels-london.test",
    address: {
      line1: "12 Camden High Street",
      city: "London",
      postalCode: "NW1 0JH",
      country: "United Kingdom",
    },
    routePropertyId: "ben-hostels-london",
  },
  {
    propertyId: 1002,
    propertyName: "Ben Hostels York",
    status: "awaiting-approval",
    propertyType: "Hostel",
    ownerName: "Ben Clarke",
    ownerEmail: "ben.york@intuitivestay.test",
    businessPhone: "+44 1904 555 102",
    businessWebsite: "https://benhostels-york.test",
    address: {
      line1: "8 Stonegate",
      city: "York",
      postalCode: "YO1 8AS",
      country: "United Kingdom",
    },
    routePropertyId: "ben-hostels-york",
  },
  {
    propertyId: 1003,
    propertyName: "Ben Hostels Edinburgh",
    status: "approved",
    propertyType: "Hostel",
    ownerName: "Ben Clarke",
    ownerEmail: "ben.edinburgh@intuitivestay.test",
    businessPhone: "+44 131 555 0103",
    businessWebsite: "https://benhostels-edinburgh.test",
    address: {
      line1: "34 Cowgate",
      city: "Edinburgh",
      postalCode: "EH1 1JR",
      country: "United Kingdom",
    },
    routePropertyId: "ben-hostels-edinburgh",
  },
  {
    propertyId: 1048,
    propertyName: "Oak & Ember",
    status: "awaiting-approval",
    propertyType: "Restaurant",
    ownerName: "Maya Patel",
    ownerEmail: "maya@oakember.test",
    businessPhone: "+44 161 555 2848",
    businessWebsite: "https://oakember.test",
    address: {
      line1: "19 Deansgate",
      city: "Manchester",
      postalCode: "M3 2BA",
      country: "United Kingdom",
    },
  },
  {
    propertyId: 1057,
    propertyName: "Harborlight Retreat",
    status: "approved",
    propertyType: "Resort",
    ownerName: "Noah Ellis",
    ownerEmail: "noah@harborlight.test",
    businessPhone: "+44 117 555 3057",
    businessWebsite: "https://harborlightretreat.test",
    address: {
      line1: "2 Lighthouse Way",
      city: "Bristol",
      postalCode: "BS1 5TY",
      country: "United Kingdom",
    },
  },
]

const DEFAULT_ADD_FORM_VALUES: AddPropertyFormValues = {
  propertyName: "",
  status: "awaiting-approval",
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
const PROPERTY_STATUS_VALUES = ["approved", "awaiting-approval"] as const

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

function isPropertyStatus(value: unknown): value is PropertyStatus {
  return (
    typeof value === "string" &&
    PROPERTY_STATUS_VALUES.includes(value as PropertyStatus)
  )
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

function formatAddressInline(address: PropertyRow["address"]) {
  return `${address.line1}, ${address.city} ${address.postalCode}, ${address.country}`
}

function toRoutePropertyId(propertyName: string) {
  return propertyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  if (status === "approved") {
    return (
      <Badge className="h-5 bg-emerald-100 px-2 text-[11px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
        Approved
      </Badge>
    )
  }

  return (
    <Badge className="h-5 bg-blue-100 px-2 text-[11px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
      Awaiting Approval
    </Badge>
  )
}

function ViewPropertyButton({ routePropertyId }: { routePropertyId?: string }) {
  if (!routePropertyId) {
    return (
      <Button size="xs" variant="outline" disabled>
        View
      </Button>
    )
  }

  return (
    <Link
      to="/properties/$propertyId/dashboard"
      params={{ propertyId: routePropertyId }}
      preload="intent"
      className={buttonVariants({ variant: "outline", size: "xs" })}
    >
      View
    </Link>
  )
}

function DeletePropertyButton({ propertyName }: { propertyName: string }) {
  return (
    <Button
      size="xs"
      variant="destructive"
      onClick={(event) => {
        event.preventDefault()
        if (typeof window !== "undefined") {
          window.confirm(
            `Delete \"${propertyName}\"? This is a placeholder and does not remove data yet.`
          )
        }
      }}
    >
      Delete
    </Button>
  )
}

function PropertyAddressPopover({ address }: { address: PropertyRow["address"] }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="xs"
            variant="ghost"
            className="h-6 px-1.5 text-xs text-muted-foreground"
            aria-label={`View full address for ${address.line1}`}
          />
        }
      >
        <span className="max-w-[220px] truncate">{formatAddressInline(address)}</span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-72">
        <div className="text-sm leading-relaxed">
          <p>{address.line1}</p>
          <p>
            {address.city} {address.postalCode}
          </p>
          <p>{address.country}</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export const Route = createFileRoute("/_portal/properties")({
  validateSearch,
  component: RouteComponent,
})

function RouteComponent() {
  const rawSearch = Route.useSearch()
  const navigate = useNavigate()
  const [properties, setProperties] = React.useState<PropertyRow[]>(MOCK_PROPERTIES)
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
        to: "/properties",
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

      const nextValues = {
        propertyName: addFormValues.propertyName.trim(),
        status: addFormValues.status,
        propertyType: addFormValues.propertyType,
        ownerName: addFormValues.ownerName.trim(),
        ownerEmail: addFormValues.ownerEmail.trim(),
        businessPhone: addFormValues.businessPhone.trim(),
        businessWebsite: addFormValues.businessWebsite.trim(),
        addressLine1: addFormValues.addressLine1.trim(),
        addressCity: addFormValues.addressCity.trim(),
        addressPostalCode: addFormValues.addressPostalCode.trim(),
        addressCountry: addFormValues.addressCountry.trim(),
      }

      const requiredValues = [
        nextValues.propertyName,
        nextValues.ownerName,
        nextValues.ownerEmail,
        nextValues.businessPhone,
        nextValues.addressLine1,
        nextValues.addressCity,
        nextValues.addressPostalCode,
        nextValues.addressCountry,
      ]

      if (requiredValues.some((value) => value.length === 0)) {
        setAddFormError("Complete all required fields before adding the property.")
        return
      }

      if (!nextValues.ownerEmail.includes("@")) {
        setAddFormError("Enter a valid owner email address.")
        return
      }

      const nextPropertyId =
        properties.reduce((maxId, property) => Math.max(maxId, property.propertyId), 0) + 1

      setProperties((prev) => [
        ...prev,
        {
          propertyId: nextPropertyId,
          propertyName: nextValues.propertyName,
          status: nextValues.status,
          propertyType: nextValues.propertyType,
          ownerName: nextValues.ownerName,
          ownerEmail: nextValues.ownerEmail,
          businessPhone: nextValues.businessPhone,
          businessWebsite: nextValues.businessWebsite,
          address: {
            line1: nextValues.addressLine1,
            city: nextValues.addressCity,
            postalCode: nextValues.addressPostalCode,
            country: nextValues.addressCountry,
          },
          routePropertyId: toRoutePropertyId(nextValues.propertyName) || undefined,
        },
      ])

      setAddFormValues(DEFAULT_ADD_FORM_VALUES)
      setAddFormError(null)
      setIsAddDialogOpen(false)
    },
    [addFormValues, properties]
  )

  const filteredData = React.useMemo(() => {
    const query = search.q.trim().toLowerCase()

    return properties.filter((property) => {
      if (search.status !== "all" && property.status !== search.status) {
        return false
      }

      if (search.type !== "all" && property.propertyType !== search.type) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        String(property.propertyId),
        property.propertyName,
        property.status,
        property.propertyType,
        property.ownerName,
        property.ownerEmail,
        property.businessPhone,
        property.businessWebsite,
        formatAddressInline(property.address),
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
        id: "id",
        accessorKey: "propertyId",
        header: "Id",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.propertyId}</span>
        ),
      },
      {
        id: "name",
        accessorKey: "propertyName",
        header: "Name",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate" title={row.original.propertyName}>
            {row.original.propertyName}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => <PropertyStatusBadge status={row.original.status} />,
      },
      {
        id: "type",
        accessorKey: "propertyType",
        header: "Type",
        enableSorting: true,
      },
      {
        id: "ownerName",
        accessorKey: "ownerName",
        header: "Owner Name",
        enableSorting: true,
      },
      {
        id: "ownerEmail",
        accessorKey: "ownerEmail",
        header: "Owner Email",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[220px] truncate" title={row.original.ownerEmail}>
            {row.original.ownerEmail}
          </span>
        ),
      },
      {
        id: "businessPhone",
        accessorKey: "businessPhone",
        header: "Business Phone",
        enableSorting: false,
      },
      {
        id: "businessWebsite",
        accessorKey: "businessWebsite",
        header: "Business Website",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[220px] truncate" title={row.original.businessWebsite}>
            {row.original.businessWebsite}
          </span>
        ),
      },
      {
        id: "address",
        header: "Address",
        enableSorting: false,
        cell: ({ row }) => <PropertyAddressPopover address={row.original.address} />,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        meta: {
          headClassName:
            "sticky right-0 z-30 bg-card border-l border-border/70 text-right shadow-[-8px_0_10px_-10px_rgba(0,0,0,0.55)]",
          cellClassName:
            "sticky right-0 z-20 bg-card border-l border-border/70 shadow-[-8px_0_10px_-10px_rgba(0,0,0,0.55)]",
        } satisfies ColumnMeta,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <ViewPropertyButton routePropertyId={row.original.routePropertyId} />
            <DeletePropertyButton propertyName={row.original.propertyName} />
          </div>
        ),
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
                className="h-8 w-full sm:w-64"
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
                <SelectTrigger className="w-44" size="sm">
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
                <SelectTrigger className="w-44" size="sm">
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
                size="xs"
                variant="outline"
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
        <DialogContent className="w-full sm:max-w-lg">
          <form className="flex min-h-0 flex-col" onSubmit={handleAddPropertySubmit}>
            <DialogHeader>
              <DialogTitle>Add Property</DialogTitle>
              <DialogDescription>
                Add a mock property row to this dashboard.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              <div className="grid gap-3 pb-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="property-name">Name *</Label>
                  <Input
                    id="property-name"
                    value={addFormValues.propertyName}
                    onChange={(event) =>
                      updateAddFormValue("propertyName", event.target.value)
                    }
                    placeholder="e.g. Riverside Hotel"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="property-status">Status *</Label>
                    <Select
                      value={addFormValues.status}
                      onValueChange={(value) => {
                        if (value && isPropertyStatus(value)) {
                          updateAddFormValue("status", value)
                        }
                      }}
                    >
                      <SelectTrigger id="property-status">
                        <SelectValue>
                          {addFormValues.status === "approved"
                            ? "Approved"
                            : "Awaiting approval"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="awaiting-approval">
                          Awaiting approval
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="property-type">Type *</Label>
                    <Select
                      value={addFormValues.propertyType}
                      onValueChange={(value) => {
                        if (value && isPropertyType(value)) {
                          updateAddFormValue("propertyType", value)
                        }
                      }}
                    >
                      <SelectTrigger id="property-type">
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
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="owner-name">Owner Name *</Label>
                    <Input
                      id="owner-name"
                      value={addFormValues.ownerName}
                      onChange={(event) =>
                        updateAddFormValue("ownerName", event.target.value)
                      }
                      placeholder="e.g. Alex Johnson"
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="owner-email">Owner Email *</Label>
                    <Input
                      id="owner-email"
                      type="email"
                      value={addFormValues.ownerEmail}
                      onChange={(event) =>
                        updateAddFormValue("ownerEmail", event.target.value)
                      }
                      placeholder="owner@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="business-phone">Business Phone *</Label>
                    <Input
                      id="business-phone"
                      value={addFormValues.businessPhone}
                      onChange={(event) =>
                        updateAddFormValue("businessPhone", event.target.value)
                      }
                      placeholder="+44 20 0000 0000"
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="business-website">Business Website</Label>
                    <Input
                      id="business-website"
                      value={addFormValues.businessWebsite}
                      onChange={(event) =>
                        updateAddFormValue("businessWebsite", event.target.value)
                      }
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="address-line">Address Line *</Label>
                  <Input
                    id="address-line"
                    value={addFormValues.addressLine1}
                    onChange={(event) =>
                      updateAddFormValue("addressLine1", event.target.value)
                    }
                    placeholder="e.g. 10 River Road"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5 sm:col-span-1">
                    <Label htmlFor="address-city">City *</Label>
                    <Input
                      id="address-city"
                      value={addFormValues.addressCity}
                      onChange={(event) =>
                        updateAddFormValue("addressCity", event.target.value)
                      }
                      placeholder="City"
                      required
                    />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-1">
                    <Label htmlFor="address-postcode">Postal Code *</Label>
                    <Input
                      id="address-postcode"
                      value={addFormValues.addressPostalCode}
                      onChange={(event) =>
                        updateAddFormValue("addressPostalCode", event.target.value)
                      }
                      placeholder="Postal code"
                      required
                    />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-1">
                    <Label htmlFor="address-country">Country *</Label>
                    <Input
                      id="address-country"
                      value={addFormValues.addressCountry}
                      onChange={(event) =>
                        updateAddFormValue("addressCountry", event.target.value)
                      }
                      placeholder="Country"
                      required
                    />
                  </div>
                </div>

                {addFormError ? (
                  <p className="text-xs text-destructive">{addFormError}</p>
                ) : null}
              </div>
            </div>

            <DialogFooter className="border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Mock Property</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
