import React, { useState, useMemo, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================
export interface TableColumn<T = any> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  searchable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
}

export interface TableAction<T = any> {
  label?: string;
  icon?: React.ReactNode;
  onClick: (row: T, index: number) => void;
  title?: string;
  variant?: 'info' | 'warning' | 'error' | 'success' | 'primary' | 'ghost' | 'default';
  size?: 'xs' | 'sm' | 'md';
  showOnHover?: boolean;
  disabled?: (row: T) => boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey?: string;
  zebra?: boolean;
  hover?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showRowNumbers?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
  isLoading?: boolean;
  actions?: TableAction<T>[];
  actionRenderer?: (row: T, index: number) => React.ReactNode;
  itemsPerPage?: number;
  showPagination?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
  showCheckbox?: boolean;
  selectedRows?: T[];
  onRowSelect?: (row: T, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  checkboxDisabled?: (row: T) => boolean;
  selectable?: boolean;
  themeAware?: boolean;
  checkboxColor?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'ghost';
  headerClassName?: string;
  headerTextClassName?: string;
  rowClassName?: string;
  cellClassName?: string;
}

// ============================================================================
// Cyber Table Component
// ============================================================================
export const Table = <T extends Record<string, any>>({
  columns,
  data = [],
  rowKey = 'id',
  zebra = true,
  hover = true,
  size = 'sm',
  showRowNumbers = false,
  emptyMessage = 'No data available',
  onRowClick,
  className = '',
  isLoading = false,
  actions,
  actionRenderer,
  itemsPerPage = 10,
  showPagination = true,
  showSearch = true,
  searchPlaceholder = 'Search records...',
  defaultSortKey,
  defaultSortDirection = 'asc',
  showCheckbox = false,
  selectedRows = [],
  onRowSelect,
  onSelectAll,
  checkboxDisabled,
  selectable = true,
  themeAware = true,
  checkboxColor = 'primary',
  headerClassName = '',
  headerTextClassName = '',
  rowClassName = '',
  cellClassName = '',
}: TableProps<T>): JSX.Element => {
  // ─── State ──────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

  // ─── Search ─────────────────────────────────────────────────
  const searchableColumns = useMemo(
    () => columns.filter((col) => col.searchable !== false),
    [columns]
  );

  const filteredData = useMemo(() => {
    if (!searchTerm.trim() || searchableColumns.length === 0) {
      return data;
    }

    const term = searchTerm.toLowerCase().trim();
    return data.filter((row) => {
      return searchableColumns.some((col) => {
        const value = row[col.key];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }, [data, searchTerm, searchableColumns]);

  // ─── Sorting ─────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDirection === 'asc'
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return sorted;
  }, [filteredData, sortKey, sortDirection]);

  // ─── Pagination ─────────────────────────────────────────────
  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, itemsPerPage, showPagination]);

  // ─── Checkbox Helpers ──────────────────────────────────────
  const isRowSelected = (row: T) => {
    const id = row[rowKey];
    return selectedRows.some((r) => r[rowKey] === id);
  };

  const isAllSelected = useMemo(() => {
    if (paginatedData.length === 0) return false;
    return paginatedData.every((row) => {
      const id = row[rowKey];
      return selectedRows.some((r) => r[rowKey] === id);
    });
  }, [paginatedData, selectedRows, rowKey]);

  const isIndeterminate = useMemo(() => {
    const selectedCount = paginatedData.filter((row) => {
      const id = row[rowKey];
      return selectedRows.some((r) => r[rowKey] === id);
    }).length;
    return selectedCount > 0 && selectedCount < paginatedData.length;
  }, [paginatedData, selectedRows, rowKey]);

  // ─── Reset to first page when search changes ────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortKey, sortDirection]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleRowSelect = (row: T, checked: boolean) => {
    if (checkboxDisabled?.(row)) return;
    onRowSelect?.(row, checked);
  };

  const handleSelectAll = (checked: boolean) => {
    onSelectAll?.(checked);
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // ─── Theme Aware Checkbox ──────────────────────────────────
  const colorMap: Record<string, string> = {
    primary: '#38BDF8',
    secondary: '#A855F7',
    accent: '#06B6D4',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    ghost: '#94A3B8',
  };
  const activeCheckboxColor = themeAware ? (colorMap[checkboxColor] || '#38BDF8') : '#38BDF8';

  const CyberCheckbox = ({
    checked,
    onChange,
    disabled = false,
    indeterminate = false,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    indeterminate?: boolean;
  }) => {
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (ref.current) {
        ref.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    return (
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 16,
          height: 16,
          cursor: disabled ? 'not-allowed' : 'pointer',
          accentColor: activeCheckboxColor,
          borderRadius: 4,
        }}
      />
    );
  };

  // ─── Size Padding Mapping ──────────────────────────────────
  const paddingMap = {
    xs: '6px 10px',
    sm: '10px 14px',
    md: '14px 18px',
    lg: '18px 22px',
  };
  const cellPadding = paddingMap[size] || paddingMap.sm;
  const fontSize = size === 'xs' ? '0.78rem' : size === 'sm' ? '0.86rem' : '0.95rem';

  const hasActions = !!(actions?.length || actionRenderer);
  const hasCheckbox = showCheckbox && selectable;

  // ─── Action Button Styles (Industrial Minimalist Tech) ──
  const variantStyles: Record<string, { color: string; border: string; bg: string; hoverBorder: string; hoverBg: string }> = {
    info: { color: '#38BDF8', border: '#1E293B', bg: '#0F172A', hoverBorder: '#38BDF8', hoverBg: 'rgba(56, 189, 248, 0.15)' },
    warning: { color: '#FACC15', border: '#1E293B', bg: '#0F172A', hoverBorder: '#FACC15', hoverBg: 'rgba(250, 204, 21, 0.15)' },
    error: { color: '#F87171', border: '#1E293B', bg: '#0F172A', hoverBorder: '#F87171', hoverBg: 'rgba(248, 113, 113, 0.15)' },
    success: { color: '#34D399', border: '#1E293B', bg: '#0F172A', hoverBorder: '#34D399', hoverBg: 'rgba(52, 211, 153, 0.15)' },
    primary: { color: '#60A5FA', border: '#1E293B', bg: '#0F172A', hoverBorder: '#60A5FA', hoverBg: 'rgba(96, 165, 250, 0.15)' },
    ghost: { color: '#94A3B8', border: 'transparent', bg: 'transparent', hoverBorder: '#334155', hoverBg: 'rgba(255, 255, 255, 0.08)' },
    default: { color: '#94A3B8', border: '#1E293B', bg: '#0F172A', hoverBorder: '#FACC15', hoverBg: 'rgba(250, 204, 21, 0.1)' },
  };

  const renderActionButtons = (row: T, index: number) => {
    if (actionRenderer) {
      return actionRenderer(row, index);
    }
    if (!actions || actions.length === 0) return null;

    return (
      <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
        {actions.map((action, idx) => {
          if (action.render) {
            return <React.Fragment key={idx}>{action.render(row, index)}</React.Fragment>;
          }

          const isDisabled = action.disabled?.(row) || false;
          const style = variantStyles[action.variant || 'default'] || variantStyles.default;
          const isIconOnly = !action.label && !!action.icon;

          return (
            <button
              key={idx}
              disabled={isDisabled}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick(row, index);
              }}
              title={action.title || action.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                width: isIconOnly ? 30 : 'auto',
                height: 30,
                padding: isIconOnly ? 0 : '0 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: 7,
                border: `1px solid ${style.border}`,
                backgroundColor: style.bg,
                color: isDisabled ? '#475569' : style.color,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.35 : 1,
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.backgroundColor = style.hoverBg;
                  e.currentTarget.style.borderColor = style.hoverBorder;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = `0 2px 8px ${style.hoverBorder}25`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.backgroundColor = style.bg;
                  e.currentTarget.style.borderColor = style.border;
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {action.icon}
              {action.label && <span>{action.label}</span>}
            </button>
          );
        })}
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
      }}
      className={className}
    >
      {/* ─── Top Search / Filter Bar ─────────────────────────── */}
      {showSearch && searchableColumns.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            width: '100%',
            minWidth: 0,
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0, width: '100%', maxWidth: 420 }}>
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748B',
                fontSize: 14,
                pointerEvents: 'none',
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 34px 8px 36px',
                backgroundColor: '#07111D',
                border: '1px solid #1E293B',
                borderRadius: 8,
                color: '#F8FAFC',
                fontSize: '0.85rem',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#38BDF8';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.2)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#1E293B';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: 2,
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 500 }}>
            <span style={{ color: '#38BDF8', fontWeight: 700 }}>{totalItems}</span> {totalItems === 1 ? 'record' : 'records'}
          </div>
        </div>
      )}

      {/* ─── Main Table Container ─────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: 12,
          border: '1px solid #1E293B',
          backgroundColor: '#0B132B',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize }}>
          {/* Table Header */}
          <thead
            style={{
              backgroundColor: '#07111D',
              borderBottom: '1px solid #1E293B',
            }}
            className={headerClassName}
          >
            <tr>
              {hasCheckbox && (
                <th style={{ width: 42, textAlign: 'center', padding: cellPadding }}>
                  <CyberCheckbox
                    checked={isAllSelected}
                    indeterminate={isIndeterminate}
                    onChange={handleSelectAll}
                  />
                </th>
              )}

              {showRowNumbers && (
                <th
                  style={{
                    width: 44,
                    textAlign: 'center',
                    padding: cellPadding,
                    color: '#64748B',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    letterSpacing: '0.05em',
                  }}
                  className={headerTextClassName}
                >
                  #
                </th>
              )}

              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    style={{
                      padding: cellPadding,
                      color: isSorted ? '#38BDF8' : '#94A3B8',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      cursor: col.sortable !== false ? 'pointer' : 'default',
                      userSelect: 'none',
                      textAlign: col.align || 'left',
                      width: col.width,
                    }}
                    className={headerTextClassName}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                        width: '100%',
                      }}
                    >
                      <span>{col.label}</span>
                      {col.sortable !== false && (
                        <span style={{ fontSize: '0.8rem', color: isSorted ? '#38BDF8' : '#475569' }}>
                          {getSortIcon(col.key)}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}

              {hasActions && (
                <th
                  style={{
                    width: 'auto', minWidth: 120, whiteSpace: 'nowrap',
                    textAlign: 'right',
                    padding: cellPadding,
                    color: '#94A3B8',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                  className={headerTextClassName}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={
                    columns.length +
                    (showRowNumbers ? 1 : 0) +
                    (hasActions ? 1 : 0) +
                    (hasCheckbox ? 1 : 0)
                  }
                  style={{ textAlign: 'center', padding: '48px 16px' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        border: '3px solid rgba(56, 189, 248, 0.2)',
                        borderTopColor: '#38BDF8',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Loading data...</span>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    columns.length +
                    (showRowNumbers ? 1 : 0) +
                    (hasActions ? 1 : 0) +
                    (hasCheckbox ? 1 : 0)
                  }
                  style={{ textAlign: 'center', padding: '40px 16px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      color: '#64748B',
                    }}
                  >
                    <div style={{ fontSize: 32 }}>📭</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{emptyMessage}</div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const rowId = row[rowKey] ?? index;
                const globalIndex = (currentPage - 1) * itemsPerPage + index;
                const isSelected = isRowSelected(row);
                const isDisabled = checkboxDisabled?.(row) || false;
                const isEven = index % 2 === 0;

                const bg = isSelected
                  ? 'rgba(56, 189, 248, 0.12)'
                  : zebra && !isEven
                  ? 'rgba(7, 17, 29, 0.45)'
                  : 'transparent';

                return (
                  <tr
                    key={rowId}
                    onClick={() => onRowClick?.(row, globalIndex)}
                    style={{
                      backgroundColor: bg,
                      borderBottom: '1px solid rgba(30, 41, 59, 0.7)',
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (hover) {
                        e.currentTarget.style.backgroundColor = isSelected
                          ? 'rgba(56, 189, 248, 0.18)'
                          : '#0D1B3E';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = bg;
                    }}
                    className={rowClassName}
                  >
                    {hasCheckbox && (
                      <td style={{ textAlign: 'center', padding: cellPadding }} onClick={(e) => e.stopPropagation()}>
                        <CyberCheckbox
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(checked) => handleRowSelect(row, checked)}
                        />
                      </td>
                    )}

                    {showRowNumbers && (
                      <td
                        style={{
                          textAlign: 'center',
                          padding: cellPadding,
                          color: '#64748B',
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                        }}
                        className={cellClassName}
                      >
                        {globalIndex + 1}
                      </td>
                    )}

                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: cellPadding,
                          color: '#F8FAFC',
                          textAlign: col.align || 'left',
                        }}
                        className={cellClassName}
                      >
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                      </td>
                    ))}

                    {hasActions && (
                      <td style={{ textAlign: 'right', padding: cellPadding, whiteSpace: 'nowrap', width: '1%' }} className={cellClassName}>
                        {renderActionButtons(row, globalIndex)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Pagination ───────────────────────────────────────── */}
      {showPagination && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
          <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
            Showing{' '}
            <span style={{ color: '#F8FAFC', fontWeight: 600 }}>
              {(currentPage - 1) * itemsPerPage + 1}
            </span>{' '}
            -{' '}
            <span style={{ color: '#F8FAFC', fontWeight: 600 }}>
              {Math.min(currentPage * itemsPerPage, totalItems)}
            </span>{' '}
            of <span style={{ color: '#38BDF8', fontWeight: 700 }}>{totalItems}</span>
          </div>

          <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #1E293B', backgroundColor: '#07111D' }}>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: currentPage === 1 ? '#475569' : '#94A3B8',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRight: '1px solid #1E293B',
              }}
            >
              « Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((page, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && page - prev > 1;
                const isActive = page === currentPage;

                return (
                  <React.Fragment key={page}>
                    {showEllipsis && (
                      <span
                        style={{
                          padding: '6px 10px',
                          color: '#475569',
                          fontSize: '0.82rem',
                          borderRight: '1px solid #1E293B',
                          userSelect: 'none',
                        }}
                      >
                        ...
                      </span>
                    )}
                    <button
                      onClick={() => handlePageChange(page)}
                      style={{
                        padding: '6px 12px',
                        background: isActive ? 'linear-gradient(135deg, #0EA5E9, #2563EB)' : 'transparent',
                        border: 'none',
                        color: isActive ? '#FFFFFF' : '#94A3B8',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: isActive ? 700 : 500,
                        borderRight: '1px solid #1E293B',
                      }}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: currentPage === totalPages ? '#475569' : '#94A3B8',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              Next »
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
