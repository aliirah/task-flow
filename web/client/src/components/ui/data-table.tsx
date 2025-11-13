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

export function DataTable<TData, TValue>({
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
  const wasSearchFocused = React.useRef(false)

  const sorting = controlledSorting ?? internalSorting

  // Track focus state before render
  React.useEffect(() => {
    wasSearchFocused.current = document.activeElement === searchInputRef.current
  })

  // Restore focus after render if it was focused before
  React.useEffect(() => {
    if (wasSearchFocused.current && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  })

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
  const hasActiveSearch = filter?.search && filter.search.length > 0

  const clearAllSorting = () => {
    if (onSortingChange) {
      onSortingChange([])
    } else {
      setInternalSorting([])
    }
  }

  const clearAllFilters = () => {
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
          <Input
            ref={searchInputRef}
            id={`search-${searchKey}`}
            placeholder={searchPlaceholder}
            value={filter.search}
            onChange={(e) => filter.setSearch(e.target.value)}
            className="w-full md:max-w-sm"
          />
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

            {hasActiveSearch && filter && (
              <Badge tone="default" className="gap-1">
                <Filter className="size-3" />
                Search: &ldquo;{filter.search}&rdquo;
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
