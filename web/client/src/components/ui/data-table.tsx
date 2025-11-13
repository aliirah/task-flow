'use client'

import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  // Server-side mode props
  manualSorting?: boolean
  manualFiltering?: boolean
  manualPagination?: boolean
  onSortingChange?: (sorting: SortingState) => void
  onSearchChange?: (search: string) => void
  sorting?: SortingState
  search?: string
  // Hide built-in pagination when doing server-side pagination
  hidePagination?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
  manualSorting = false,
  manualFiltering = false,
  manualPagination = false,
  onSortingChange,
  onSearchChange,
  sorting: controlledSorting,
  search: controlledSearch,
  hidePagination = false,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const [internalSearch, setInternalSearch] = React.useState('')
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  
  // Local state for input to prevent losing focus
  const [localSearchValue, setLocalSearchValue] = React.useState(controlledSearch ?? '')
  
  // Sync local state with controlled prop when it changes externally (but not from typing)
  React.useEffect(() => {
    if (controlledSearch !== undefined && controlledSearch !== localSearchValue) {
      setLocalSearchValue(controlledSearch)
    }
  }, [controlledSearch])

  // Use controlled or internal state
  const sorting = controlledSorting ?? internalSorting

  const table = useReactTable({
    data,
    columns,
    manualSorting,
    manualFiltering,
    manualPagination,
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater
      if (onSortingChange) {
        onSortingChange(newSorting)
      } else {
        setInternalSorting(newSorting)
      }
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  const hasActiveFilters = columnFilters.length > 0
  const hasActiveSorting = sorting.length > 0
  
  // Use local search value for display to prevent focus loss
  const searchFilter = manualFiltering ? localSearchValue : (searchKey ? table.getColumn(searchKey)?.getFilterValue() as string : '')

  const handleSearchChange = (value: string) => {
    // Update local state immediately for responsive UI
    setLocalSearchValue(value)
    
    // Notify parent if in controlled mode
    if (onSearchChange) {
      onSearchChange(value)
    } else {
      setInternalSearch(value)
      if (searchKey && !manualFiltering) {
        table.getColumn(searchKey)?.setFilterValue(value)
      }
    }
  }

  const clearAllFilters = () => {
    setLocalSearchValue('')
    if (!manualFiltering) {
      table.resetColumnFilters()
    }
    if (onSearchChange) {
      onSearchChange('')
    } else {
      setInternalSearch('')
    }
  }

  const clearAllSorting = () => {
    if (onSortingChange) {
      onSortingChange([])
    } else if (!manualSorting) {
      table.resetSorting()
    }
  }

  const clearAll = () => {
    clearAllFilters()
    clearAllSorting()
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4">
        {searchKey && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <input
                id={`search-${searchKey}`}
                key={`search-${searchKey}`}
                placeholder={searchPlaceholder}
                value={searchFilter ?? ''}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {searchFilter && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {(hasActiveFilters || hasActiveSorting) && (
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

            {searchFilter && (
              <Badge tone="default" className="gap-1">
                <Filter className="size-3" />
                Search: &ldquo;{searchFilter}&rdquo;
                <button
                  onClick={() => handleSearchChange('')}
                  className="ml-1 hover:text-slate-900"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {(hasActiveFilters || hasActiveSorting) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 text-xs"
              >
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-200">
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
            {table.getRowModel().rows?.length ? (
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
                  {hasActiveFilters || searchFilter
                    ? 'No results match your filters.'
                    : 'No results.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!hidePagination && (
        <div className="flex items-center justify-between py-4">
          <div className="text-sm text-slate-500">
            {table.getFilteredRowModel().rows.length > 0 && (
              <span>
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}{' '}
                of {table.getFilteredRowModel().rows.length} result(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
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
