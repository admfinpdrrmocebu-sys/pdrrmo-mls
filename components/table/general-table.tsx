'use client';

import React from 'react';
import { twMerge } from 'tailwind-merge';
import { TableSkeleton } from '@/components/skeleton';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface GeneralTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (row: T, index: number) => string | number;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  loadingRowCount?: number;
}

export function GeneralTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found.',
  className,
  onRowClick,
  isLoading = false,
  loadingRowCount = 5,
}: GeneralTableProps<T>) {
  return (
    <div className={twMerge('w-full overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm', className)}>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={twMerge(
                    'px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#505F76]',
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          {isLoading ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <TableSkeleton rows={loadingRowCount} columns={columns.length} />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-[#E2E8F0]">
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-5 py-8 text-center text-sm text-[#757680]"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row, rowIdx) => {
                  const rowKey = keyExtractor ? keyExtractor(row, rowIdx) : rowIdx;
                  return (
                    <tr
                      key={rowKey}
                      onClick={() => onRowClick && onRowClick(row)}
                      className={twMerge(
                        'transition-colors hover:bg-[#F8FAFC]/80',
                        onRowClick && 'cursor-pointer'
                      )}
                    >
                      {columns.map((col, colIdx) => (
                        <td
                          key={colIdx}
                          className={twMerge('px-5 py-3.5 text-[#1E293B]', col.className)}
                        >
                          {col.cell
                            ? col.cell(row, rowIdx)
                            : col.accessorKey
                            ? String(row[col.accessorKey] ?? '')
                            : null}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

export default GeneralTable;
