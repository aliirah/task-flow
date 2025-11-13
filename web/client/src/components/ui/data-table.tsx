'use client'

import * as React from 'react'
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { X, Filter, ArrowUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  searchKey?: string
  searchPlaceholder?: string
  // For server-side operations
  manualSorting?: boolean
  manualFiltering?: boolean
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
  // Filter props - parent manages search state
  filter?: {
    search: string
    setSearch: (value: string) => void
  }
  hidePagination?: boolean
  emptyMessage?: string
}

function DataTableComponent<TData, TValue>({
  columns,
  data,
  loading = false,
  searchKey,
  searchPlaceholder = 'Search...',
  manualSorting = false,
  manualFiltering = false,
  sorting: controlledSorting,
  onSortingChange,
  filter,
  hidePagination = false,
  emptyMessage,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const isTypingRef = React.useRef(false)
  const [localSearchValue, setLocalSearchValue] = React.useState(filter?.search || '')

  const sorting = controlledSorting ?? internalSorting

  // Sync local value with parent only when parent clears the search
  React.useEffect(() => {
    if (filter && filter.search === '' && localSearchValue !== '') {
      setLocalSearchValue('')
    }
  }, [filter, localSearchValue])

  // Maintain focus when data updates while typing
  React.useEffect(() => {
    if (isTypingRef.current && searchInputRef.current) {
      // Restore focus after data updates
      if (document.activeElement !== searchInputRef.current) {
        searchInputRef.current.focus()
      }
    }
  }, [data])
  
  // Clear the typing flag after a delay (longer than debounce)
  React.useEffect(() => {
    if (isTypingRef.current) {
      const timeoutId = setTimeout(() => {
        isTypingRef.current = false
      }, 1000) // 1 second, longer than 500ms debounce
      return () => clearTimeout(timeoutId)
    }
  }, [localSearchValue])

  const handleSearchChange = (value: string) => {
    isTypingRef.current = true
    setLocalSearchValue(value)
    if (filter) {
      filter.setSearch(value)
    }
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    manualSorting,
    manualFiltering,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater
      if (onSortingChange) {
        onSortingChange(newSorting)
      } else {
        setInternalSorting(newSorting)
      }
    },
  })

  const hasActiveSorting = sorting.length > 0
  const hasActiveSearch = localSearchValue.length > 0

  const clearAllSorting = () => {
    if (onSortingChange) {
      onSortingChange([])
    } else {
      setInternalSorting([])
    }
  }

  const clearAllFilters = () => {
    setLocalSearchValue('')
    if (filter) {
      filter.setSearch('')
    }
  }

  const clearAll = () => {
    clearAllFilters()
    clearAllSorting()
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {searchKey && filter && (
          <div className="relative w-full md:max-w-sm">
            <Input
              ref={searchInputRef}
              id={`search-${searchKey}`}
              placeholder={searchPlaceholder}
              value={localSearchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              onBlur={(e) => {
                // If we're still typing (within 100ms), refocus immediately
                if (isTypingRef.current) {
                  e.target.focus()
                }
              }}
              className="w-full pr-8"
            />
            {localSearchValue && (
              <button
                onClick={() => {
                  setLocalSearchValue('')
                  if (filter) {
                    filter.setSearch('')
                  }
                  // Refocus the input after clearing
                  if (searchInputRef.current) {
                    searchInputRef.current.focus()
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {(hasActiveSearch || hasActiveSorting) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">Active:</span>
            
            {hasActiveSorting && (
              <Badge tone="info" className="gap-1">
                <ArrowUpDown className="size-3" />
                Sorted by {sorting[0].id} ({sorting[0].desc ? 'desc' : 'asc'})
                <button
                  onClick={clearAllSorting}
                  className="ml-1 hover:text-slate-900"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {hasActiveSearch && (
              <Badge tone="default" className="gap-1">
                <Filter className="size-3" />
                Search: &ldquo;{localSearchValue}&rdquo;
                <button
                  onClick={clearAllFilters}
                  className="ml-1 hover:text-slate-900"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-8 px-2 lg:px-3"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-slate-500"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-slate-500"
                >
                  {emptyMessage ||
                    (hasActiveSearch
                      ? 'No results match your filters.'
                      : 'No results.')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!hidePagination && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export const DataTable = DataTableComponent
