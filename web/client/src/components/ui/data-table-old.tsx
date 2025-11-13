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

function DataTableInner<TData, TValue>({
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
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  
  // Local search state - completely independent from parent
  const [localSearch, setLocalSearch] = React.useState('')

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

  const handleSearchChange = React.useCallback((value: string) => {
    // Update local state immediately for responsive UI - NO parent update!
    setLocalSearch(value)
    
    // Directly call parent callback if provided (parent will handle debouncing)
    if (manualFiltering && onSearchChange) {
      onSearchChange(value)
    } else if (searchKey) {
      table.getColumn(searchKey)?.setFilterValue(value)
    }
  }, [manualFiltering, onSearchChange, searchKey, table])

  const clearAllFilters = () => {
    setLocalSearch('')
    
    if (!manualFiltering) {
      table.resetColumnFilters()
    }
    if (onSearchChange) {
      onSearchChange('')
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {searchKey && (
          <div className="relative w-full md:max-w-sm">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {localSearch && (
              <button
                onClick={clearAllFilters}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 hover:bg-slate-100"
              >
                <X className="size-4 text-slate-500" />
              </button>
            )}
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

            {localSearch && (
              <Badge tone="default" className="gap-1">
                <Filter className="size-3" />
                Search: &ldquo;{localSearch}&rdquo;
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
                  {hasActiveFilters || localSearch
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

// Export without memo - let React handle updates normally
// The input focus is maintained through internal state management
export const DataTable = DataTableInner
