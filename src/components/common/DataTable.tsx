import { useMemo, useRef, useState } from 'react';
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type VisibilityState, type Row, type FilterFn,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Rows3, Rows4, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { EmptyState } from './states';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'right' | 'center';
    numeric?: boolean;
    width?: number;
    sticky?: boolean;
    label?: string;
  }
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  getRowId?: (row: T) => string;
  initialSort?: SortingState;
  initialHidden?: VisibilityState;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  searchable?: boolean;
  globalFilterFn?: FilterFn<T>;
  toolbar?: React.ReactNode;
  maxHeight?: number | string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  rowClassName?: (row: Row<T>) => string | undefined;
  footer?: React.ReactNode;
}

export function DataTable<T>({
  data, columns, getRowId, initialSort = [], initialHidden = {}, onRowClick, searchPlaceholder = 'Filter…', searchable = true,
  globalFilterFn, toolbar, maxHeight = 640, emptyTitle = 'No matching rows', emptyDescription = 'Try clearing filters or widening your search.', className, rowClassName, footer,
}: DataTableProps<T>) {
  const density = useUi((s) => s.density);
  const setDensity = useUi((s) => s.setDensity);
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [visibility, setVisibility] = useState<VisibilityState>(initialHidden);
  const [filter, setFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility: visibility, globalFilter: filter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onGlobalFilterChange: setFilter,
    getRowId: getRowId ? (r) => getRowId(r) : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: globalFilterFn ?? 'includesString',
  });

  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowHeight = density === 'compact' ? 40 : 52;
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => rowHeight, overscan: 12 });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0].start : 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;
  const hideable = useMemo(() => table.getAllLeafColumns().filter((c) => c.getCanHide()), [table]);
  const colCount = table.getVisibleLeafColumns().length;

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
          {searchable && <Input icon={<Search />} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={searchPlaceholder} className="w-full sm:w-56" aria-label="Filter rows" />}
          {toolbar}
          <div className="ml-auto flex items-center gap-1">
            <span className="num mr-1 hidden text-2xs text-fg-subtle sm:inline">{rows.length.toLocaleString()} rows</span>
            <Tooltip content={density === 'compact' ? 'Comfortable rows' : 'Compact rows'}>
              <Button variant="ghost" size="icon-sm" onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')} aria-label="Toggle density">
                {density === 'compact' ? <Rows3 /> : <Rows4 />}
              </Button>
            </Tooltip>
            {hideable.length > 0 && (
              <DropdownMenu>
                <Tooltip content="Columns">
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Toggle columns">
                      <Columns3 />
                    </Button>
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Columns</DropdownMenuLabel>
                  {hideable.map((c) => (
                    <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>
                      {c.columnDef.meta?.label ?? (typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}
      <div ref={scrollRef} className="scrollbar-thin relative overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta;
                  const sorted = h.column.getIsSorted();
                  const canSort = h.column.getCanSort();
                  return (
                    <th
                      key={h.id}
                      style={{ width: meta?.width, minWidth: meta?.width }}
                      className={cn(
                        'h-9 whitespace-nowrap border-b border-border bg-surface-2/95 px-3 text-2xs font-semibold uppercase tracking-[0.06em] text-fg-subtle backdrop-blur',
                        meta?.align === 'right' || meta?.numeric ? 'text-right' : meta?.align === 'center' ? 'text-center' : 'text-left',
                        meta?.sticky && 'sticky left-0 z-10',
                      )}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    >
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn('group inline-flex items-center gap-1 transition-colors hover:text-fg', sorted && 'text-fg', (meta?.align === 'right' || meta?.numeric) && 'flex-row-reverse')}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="size-3 text-accent" /> : sorted === 'desc' ? <ArrowDown className="size-3 text-accent" /> : <ChevronsUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 && <tr aria-hidden style={{ height: padTop }}><td colSpan={colCount} /></tr>}
            {items.map((vi) => {
              const row = rows[vi.index];
              return (
                <tr
                  key={row.id}
                  style={{ height: rowHeight }}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row.original) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn('group transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2 focus-visible:outline-none', onRowClick && 'cursor-pointer', rowClassName?.(row))}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'whitespace-nowrap border-b border-border/70 px-3',
                          meta?.numeric && 'num text-right',
                          meta?.align === 'right' && 'text-right',
                          meta?.align === 'center' && 'text-center',
                          meta?.sticky && 'sticky left-0 z-[1] bg-surface-1 group-hover:bg-surface-2',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {padBottom > 0 && <tr aria-hidden style={{ height: padBottom }}><td colSpan={colCount} /></tr>}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState icon={<Search />} title={emptyTitle} description={emptyDescription} />}
      </div>
      {footer}
    </div>
  );
}
