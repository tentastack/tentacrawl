'use client';

import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../primitives/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/select';
import { Button } from '../primitives/button';
import { cn } from '../lib/utils';
import { Spinner } from '../primitives/spinner';

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface DataTableSort {
  key: string;
  direction: 'asc' | 'desc';
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
  sortableColumns?: Record<string, string>;
  pagination?: PaginationState;
  onPaginationChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeControl?: boolean;
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

function DataTable<TData>({
  columns,
  data,
  sort,
  onSortChange,
  sortableColumns,
  pagination,
  onPaginationChange,
  onRowClick,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeControl = false,
  isLoading,
  emptyMessage = 'No results found.',
  className,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className={cn('space-y-4', className)}>
      <div className="overflow-hidden border border-ink bg-surface shadow-brutal-sm">
        <Table className="min-w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b-2 border-ink bg-base hover:bg-base">
                {headerGroup.headers.map((header) => {
                  const sortKey = sortableColumns?.[header.column.id];
                  const sortable = Boolean(onSortChange)
                    && !header.isPlaceholder
                    && header.column.columnDef.enableSorting !== false
                    && Boolean(sortKey);
                  const sorted = sortKey && sort?.key === sortKey ? sort.direction : undefined;
                  const handleSort = onSortChange
                    && sortKey
                    ? () => onSortChange({
                        key: sortKey,
                        direction: sorted === 'asc' ? 'desc' : 'asc',
                      })
                    : undefined;
                  return (
                    <TableHead key={header.id} className="h-11 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink">
                      {header.isPlaceholder ? null : sortable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-1 h-auto px-1 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink shadow-none hover:bg-transparent hover:text-brand"
                          onClick={handleSort}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sorted === 'asc' ? (
                            <ArrowUp className="ml-2 size-3.5" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="ml-2 size-3.5" />
                          ) : (
                            <ArrowUpDown className="ml-2 size-3.5" />
                          )}
                        </Button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-28 text-center"
                >
                  <Spinner className="mx-auto size-6" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-28 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'border-b border-ink/15',
                    index % 2 === 0 ? 'bg-surface' : 'bg-base/40',
                    onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-brand/5',
                  )}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick?.(row.original)}
                  onKeyDown={(event) => {
                    if (!onRowClick) {
                      return;
                    }

                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick(row.original);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-4 align-top">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* pagination */}
      {pagination && (
        <div className="flex items-center justify-between border border-ink bg-surface px-4 py-3 shadow-brutal-sm">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              {pagination.total} total result{pagination.total !== 1 ? 's' : ''}
            </p>
            {showPageSizeControl && onPageSizeChange ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-[0.14em] text-muted-foreground">
                  Rows
                </span>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(value) => onPageSizeChange(Number(value))}
                >
                  <SelectTrigger className="h-8 w-[88px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPaginationChange?.(pagination.page - 1)}
              disabled={pagination.page <= 0}
            >
              Previous
            </Button>
            <span className="min-w-32 text-center text-sm font-mono text-muted-foreground">
              Page {pagination.page + 1} of{' '}
              {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPaginationChange?.(pagination.page + 1)}
              disabled={
                (pagination.page + 1) * pagination.pageSize >= pagination.total
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable };
