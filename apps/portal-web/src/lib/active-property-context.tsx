import * as React from "react"
import { useLocation, useNavigate } from "@tanstack/react-router"

import {
  buildPropertyPath,
  getPropertyIdFromPath,
  isPropertyPath,
} from "@/lib/property-routes"

export type PropertySummary = {
  id: string
  name: string
}

const DEFAULT_PROPERTIES: PropertySummary[] = []

type ActivePropertyContextValue = {
  properties: PropertySummary[]
  activePropertyId: string
  activeProperty: PropertySummary | null
  setActivePropertyId: (nextPropertyId: string) => void
  switchProperty: (nextPropertyId: string) => void
}

const ActivePropertyContext = React.createContext<ActivePropertyContextValue | null>(null)

export function ActivePropertyProvider({
  initialProperties,
  children,
}: {
  initialProperties?: PropertySummary[]
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const [properties] = React.useState(initialProperties ?? DEFAULT_PROPERTIES)
  const [activePropertyId, setActivePropertyIdState] = React.useState(
    (initialProperties ?? DEFAULT_PROPERTIES)[0]?.id ?? ""
  )

  const hasProperty = React.useCallback(
    (propertyId: string) => properties.some((property) => property.id === propertyId),
    [properties]
  )

  React.useEffect(() => {
    const propertyIdInRoute = getPropertyIdFromPath(location.pathname)
    if (!propertyIdInRoute) {
      return
    }

    if (hasProperty(propertyIdInRoute)) {
      setActivePropertyIdState(propertyIdInRoute)
    }
  }, [hasProperty, location.pathname])

  const setActivePropertyId = React.useCallback(
    (nextPropertyId: string) => {
      if (!hasProperty(nextPropertyId)) {
        return
      }

      setActivePropertyIdState(nextPropertyId)
    },
    [hasProperty]
  )

  const switchProperty = React.useCallback(
    (nextPropertyId: string) => {
      if (!hasProperty(nextPropertyId)) {
        return
      }

      setActivePropertyIdState(nextPropertyId)

      if (isPropertyPath(location.pathname)) {
        navigate({
          to: buildPropertyPath(nextPropertyId, "dashboard"),
        })
      }
    },
    [hasProperty, location.pathname, navigate]
  )

  const activeProperty =
    properties.find((property) => property.id === activePropertyId) ?? null

  const value = React.useMemo(
    () => ({
      properties,
      activePropertyId,
      activeProperty,
      setActivePropertyId,
      switchProperty,
    }),
    [activeProperty, activePropertyId, properties, setActivePropertyId, switchProperty]
  )

  return (
    <ActivePropertyContext.Provider value={value}>
      {children}
    </ActivePropertyContext.Provider>
  )
}

export function useActiveProperty() {
  const value = React.useContext(ActivePropertyContext)
  if (!value) {
    throw new Error("useActiveProperty must be used inside ActivePropertyProvider")
  }

  return value
}
