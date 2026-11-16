import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TableAction, TableColumn } from './Table';

export interface DataGridColumn<T = any> extends TableColumn<T> {
  groupable?: boolean;
  filterable?: boolean;
  getValue?: (row: T) => any;
}

export interface DataGridTableProps<T = any> {
  columns: DataGridColumn<T>[];
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
  checkboxColor?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'ghost';
  renderExpandedRow?: (row: T) => React.ReactNode;
  autoDiscoverColumns?: boolean;
  defaultGroupBy?: string[];
  showFilterRowByDefault?: boolean;
}

interface FlatGroupRow {
  type: 'group';
  groupKey: string;
  field: string;
  label: string;
  value: string;
  count: number;
  depth: number;
}

interface FlatDataRow<T> {
  type: 'data';
  row: T;
  index: number;
}

type FlatRow<T> = FlatGroupRow | FlatDataRow<T>;

const formatAutoCaption = (field: string): string =>
  field
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const DataGridTable = <T extends Record<string, any>>({
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
  itemsPerPage: initialItemsPerPage = 10,
  showPagination = true,
  showSearch = true,
  searchPlaceholder = 'Search all columns...',
  defaultSortKey,
  defaultSortDirection = 'asc',
  showCheckbox = false,
  selectedRows = [],
  onRowSelect,
  onSelectAll,
  checkboxDisabled,
  selectable = true,
  checkboxColor = 'primary',
  renderExpandedRow,
  autoDiscoverColumns = true,
  defaultGroupBy = [],
  showFilterRowByDefault = false,
}: DataGridTableProps<T>): JSX.Element => {
  // ─── State ──────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialItemsPerPage);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Record<string, boolean>>({});
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 849px)').matches : false
  );

  // DevExtreme-style DataGrid state
  const [groupByKeys, setGroupByKeys] = useState<string[]>(defaultGroupBy);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showFilterRow, setShowFilterRow] = useState<boolean>(showFilterRowByDefault);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showColumnChooser, setShowColumnChooser] = useState(false);
  const [hiddenUserCols, setHiddenUserCols] = useState<Record<string, boolean>>({});
  const [enabledAutoCols, setEnabledAutoCols] = useState<Record<string, boolean>>({});
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [isGroupDropActive, setIsGroupDropActive] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      if (typeof window === 'undefined') return;
      const mq = window.matchMedia('(max-width: 849px)');
      const update = () => setIsMobile(mq.matches);
      update();
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsMobile(entry.contentRect.width < 850);
      }
    });
    observer.observe(el);
    setIsMobile(el.getBoundingClientRect().width < 850);
    return () => observer.disconnect();
  }, []);

  // Auto-discover extra dynamic fields from live data
  const autoDiscoveredColumns = useMemo<DataGridColumn<T>[]>(() => {
    if (!autoDiscoverColumns || !Array.isArray(data) || data.length === 0) return [];
    const configured = new Set(columns.map((c) => c.key));
    const discovered = new Set<string>();
    const sampleSize = Math.min(data.length, 20);
    for (let i = 0; i < sampleSize; i++) {
      const row = data[i];
      if (!row || typeof row !== 'object') continue;
      Object.keys(row).forEach((k) => {
        if (!configured.has(k) && typeof row[k] !== 'function') {
          discovered.add(k);
        }
      });
    }
    return Array.from(discovered).map((field) => ({
      key: field,
      label: formatAutoCaption(field),
      groupable: true,
      filterable: true,
      hideOnMobile: true,
      getValue: (r: T) => {
        const val = r?.[field];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      },
      render: (val: any) => {
        if (val === null || val === undefined || val === '') return <span style={{ color: '#475569' }}>—</span>;
        if (typeof val === 'object') {
          return (
            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#94A3B8' }}>
              {JSON.stringify(val)}
            </span>
          );
        }
        return <span style={{ color: '#CBD5E1', fontSize: '0.82rem' }}>{String(val)}</span>;
      },
    }));
  }, [data, columns, autoDiscoverColumns]) as any;

  // All columns (configured + user-enabled auto-discovered)
  const allColumns = useMemo<DataGridColumn<T>[]>(() => {
    const activeAuto = (autoDiscoveredColumns as DataGridColumn<T>[]).filter(
      (c) => enabledAutoCols[c.key] || groupByKeys.includes(c.key)
    );
    return [...columns, ...activeAuto];
  }, [columns, autoDiscoveredColumns, enabledAutoCols, groupByKeys]);

  const userVisibleColumns = useMemo(
    () => allColumns.filter((col) => !hiddenUserCols[col.key]),
    [allColumns, hiddenUserCols]
  );

  const hiddenMobileColumns = useMemo(
    () => (isMobile ? userVisibleColumns.filter((col) => col.hideOnMobile) : []),
    [userVisibleColumns, isMobile]
  );

  const visibleColumns = useMemo(
    () => (isMobile ? userVisibleColumns.filter((col) => !col.hideOnMobile) : userVisibleColumns),
    [userVisibleColumns, isMobile]
  );

  const hasExpandable = Boolean(renderExpandedRow || hiddenMobileColumns.length > 0);

  const getCellTextValue = (row: T, col: DataGridColumn<T>): string => {
    const raw = col.getValue ? col.getValue(row) : row[col.key];
    if (raw === null || raw === undefined) return '';
    if (typeof raw === 'object') return JSON.stringify(raw);
    return String(raw);
  };

  // ─── Global Search + Per-Column Filtering ──────────────────
  const searchableColumns = useMemo(
    () => allColumns.filter((col) => col.searchable !== false),
    [allColumns]
  );

  const filteredData = useMemo(() => {
    let result = data;

    if (searchTerm.trim() && searchableColumns.length > 0) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((row) =>
        searchableColumns.some((col) => getCellTextValue(row, col).toLowerCase().includes(term))
      );
    }

    const activeColFilters = Object.entries(columnFilters).filter(([, v]) => v.trim() !== '');
    if (activeColFilters.length > 0) {
      result = result.filter((row) =>
        activeColFilters.every(([colKey, filterVal]) => {
          const col = allColumns.find((c) => c.key === colKey);
          if (!col) return true;
          return getCellTextValue(row, col).toLowerCase().includes(filterVal.toLowerCase().trim());
        })
      );
    }

    return result;
  }, [data, searchTerm, searchableColumns, columnFilters, allColumns]);

  // ─── Sorting ───────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const col = allColumns.find((c) => c.key === sortKey);
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const aVal = col?.getValue ? col.getValue(a) : a[sortKey];
      const bVal = col?.getValue ? col.getValue(b) : b[sortKey];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sorted;
  }, [filteredData, sortKey, sortDirection, allColumns]);

  // ─── Dynamic Multi-Level Grouping ──────────────────────────
  const flattenedRows = useMemo<FlatRow<T>[]>(() => {
    if (groupByKeys.length === 0) {
      return sortedData.map((row, index) => ({ type: 'data', row, index }));
    }

    const buildGroups = (
      rows: T[],
      depth: number,
      parentKey: string
    ): FlatRow<T>[] => {
      if (depth >= groupByKeys.length) {
        return rows.map((row, index) => ({ type: 'data', row, index }));
      }

      const field = groupByKeys[depth];
      const col =
        allColumns.find((c) => c.key === field) ||
        (autoDiscoveredColumns as DataGridColumn<T>[]).find((c) => c.key === field);
      const label = col?.label || formatAutoCaption(field);

      const map = new Map<string, T[]>();
      rows.forEach((r) => {
        const raw = col?.getValue ? col.getValue(r) : r[field];
        const val =
          raw === null || raw === undefined || raw === ''
            ? '(Empty)'
            : typeof raw === 'object'
              ? JSON.stringify(raw)
              : String(raw);
        const list = map.get(val) || [];
        list.push(r);
        map.set(val, list);
      });

      const out: FlatRow<T>[] = [];
      map.forEach((groupRows, val) => {
        const gKey = `${parentKey}|${field}=${val}`;
        out.push({
          type: 'group',
          groupKey: gKey,
          field,
          label,
          value: val,
          count: groupRows.length,
          depth,
        });
        if (!collapsedGroups[gKey]) {
          out.push(...buildGroups(groupRows, depth + 1, gKey));
        }
      });
      return out;
    };

    return buildGroups(sortedData, 0, 'root');
  }, [sortedData, groupByKeys, allColumns, autoDiscoveredColumns, collapsedGroups]);

  // ─── Pagination (with safePage auto-reset) ─────────────────
  const totalItems = sortedData.length;
  const totalFlatItems = flattenedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFlatItems / pageSize));
  const safePage = currentPage > totalPages ? 1 : currentPage;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortKey, sortDirection, columnFilters, groupByKeys, pageSize]);

  const paginatedRows = useMemo(() => {
    if (!showPagination) return flattenedRows;
    const start = (safePage - 1) * pageSize;
    return flattenedRows.slice(start, start + pageSize);
  }, [flattenedRows, safePage, pageSize, showPagination]);

  const pageDataRows = useMemo(
    () => paginatedRows.filter((item): item is FlatDataRow<T> => item.type === 'data').map((i) => i.row),
    [paginatedRows]
  );

  // ─── Checkbox & Group Helpers ──────────────────────────────
  const isRowSelected = (row: T) => {
    const id = row[rowKey];
    return selectedRows.some((r) => r[rowKey] === id);
  };

  const isAllSelected = useMemo(() => {
    if (pageDataRows.length === 0) return false;
    return pageDataRows.every((row) => selectedRows.some((r) => r[rowKey] === row[rowKey]));
  }, [pageDataRows, selectedRows, rowKey]);

  const isIndeterminate = useMemo(() => {
    const selectedCount = pageDataRows.filter((row) => selectedRows.some((r) => r[rowKey] === row[rowKey])).length;
    return selectedCount > 0 && selectedCount < pageDataRows.length;
  }, [pageDataRows, selectedRows, rowKey]);

  const toggleGroupExpand = (gKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [gKey]: !prev[gKey] }));
  };

  const toggleRowExpand = (rowId: string | number) => {
    const key = String(rowId);
    setExpandedRowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addGroupField = (field: string) => {
    if (!field || groupByKeys.includes(field)) return;
    setGroupByKeys((prev) => [...prev, field]);
  };

  const removeGroupField = (field: string) => {
    setGroupByKeys((prev) => prev.filter((k) => k !== field));
  };

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

  const colorMap: Record<string, string> = {
    primary: '#38BDF8',
    secondary: '#A855F7',
    accent: '#06B6D4',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    ghost: '#94A3B8',
  };
  const activeCheckboxColor = colorMap[checkboxColor] || '#38BDF8';

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
      if (ref.current) ref.current.indeterminate = indeterminate;
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
  const totalColSpan =
    visibleColumns.length +
    (hasExpandable ? 1 : 0) +
    (hasCheckbox ? 1 : 0) +
    (showRowNumbers ? 1 : 0) +
    (hasActions ? 1 : 0);

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
    if (actionRenderer) return actionRenderer(row, index);
    if (!actions || actions.length === 0) return null;

    return (
      <div
        style={{
          display: 'inline-flex',
          gap: 6,
          justifyContent: 'flex-end',
          alignItems: 'center',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          whiteSpace: isMobile ? 'normal' : 'nowrap',
        }}
      >
        {actions.map((action, idx) => {
          if (action.render) return <React.Fragment key={idx}>{action.render(row, index)}</React.Fragment>;
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
            >
              {action.icon}
              {action.label && <span>{action.label}</span>}
            </button>
          );
        })}
      </div>
    );
  };

  const groupableOptions = useMemo(
    () => [
      ...columns.filter((c) => c.groupable !== false),
      ...(autoDiscoveredColumns as DataGridColumn<T>[]),
    ],
    [columns, autoDiscoveredColumns]
  );

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', minWidth: 0 }} className={className}>
      {/* ─── DevExtreme-style Group Drop Panel & Toolbar ──────── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsGroupDropActive(true);
        }}
        onDragLeave={() => setIsGroupDropActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsGroupDropActive(false);
          const colKey = e.dataTransfer.getData('text/plain') || draggedColKey;
          if (colKey) addGroupField(colKey);
          setDraggedColKey(null);
        }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 14px',
          backgroundColor: isGroupDropActive ? 'rgba(56, 189, 248, 0.12)' : '#07111D',
          border: isGroupDropActive ? '1px dashed #38BDF8' : '1px solid #1E293B',
          borderRadius: 10,
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: '1 1 260px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Group Panel:
          </span>
          {groupByKeys.length === 0 ? (
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontStyle: 'italic' }}>
              Drag any column header here or pick a field →
            </span>
          ) : (
            groupByKeys.map((gKey, idx) => {
              const col = groupableOptions.find((c) => c.key === gKey);
              return (
                <span
                  key={gKey}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 9px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#38BDF8',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                  }}
                >
                  <span>
                    {idx > 0 ? '↳ ' : ''}
                    {col?.label || formatAutoCaption(gKey)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeGroupField(gKey)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '0.8rem',
                      lineHeight: 1,
                    }}
                    title="Remove group"
                  >
                    ✕
                  </button>
                </span>
              );
            })
          )}
        </div>

        {/* Quick Group-By Selector + Filter Row Toggle + Column Chooser */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, position: 'relative' }}>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addGroupField(e.target.value);
            }}
            style={{
              backgroundColor: '#0B132B',
              border: '1px solid #1E293B',
              borderRadius: 7,
              color: '#CBD5E1',
              fontSize: '0.76rem',
              padding: '5px 10px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">+ Add Group Field...</option>
            {groupableOptions
              .filter((c) => !groupByKeys.includes(c.key))
              .map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
          </select>

          {groupByKeys.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setGroupByKeys([]);
                setCollapsedGroups({});
              }}
              style={{
                padding: '5px 10px',
                borderRadius: 7,
                border: '1px solid rgba(248, 113, 113, 0.35)',
                backgroundColor: 'rgba(248, 113, 113, 0.1)',
                color: '#F87171',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clear Groups
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowFilterRow((prev) => !prev)}
            style={{
              padding: '5px 10px',
              borderRadius: 7,
              border: showFilterRow ? '1px solid #38BDF8' : '1px solid #1E293B',
              backgroundColor: showFilterRow ? 'rgba(56, 189, 248, 0.15)' : '#0B132B',
              color: showFilterRow ? '#38BDF8' : '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Filter Row
          </button>

          <button
            type="button"
            onClick={() => setShowColumnChooser((prev) => !prev)}
            style={{
              padding: '5px 10px',
              borderRadius: 7,
              border: showColumnChooser ? '1px solid #38BDF8' : '1px solid #1E293B',
              backgroundColor: showColumnChooser ? 'rgba(56, 189, 248, 0.15)' : '#0B132B',
              color: showColumnChooser ? '#38BDF8' : '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Columns
          </button>

          {showColumnChooser && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                zIndex: 50,
                minWidth: 230,
                maxHeight: 300,
                overflowY: 'auto',
                backgroundColor: '#0B132B',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: 10,
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', mb: 4 } as any}>
                Column Chooser
              </div>
              {columns.map((c) => (
                <label
                  key={c.key}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#E2E8F0', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={!hiddenUserCols[c.key]}
                    onChange={(e) => setHiddenUserCols((prev) => ({ ...prev, [c.key]: !e.target.checked }))}
                    style={{ accentColor: '#38BDF8' }}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
              {autoDiscoveredColumns.length > 0 && (
                <>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#FACC15', textTransform: 'uppercase', marginTop: 6 }}>
                    Dynamic Fields (Auto)
                  </div>
                  {(autoDiscoveredColumns as DataGridColumn<T>[]).map((c) => (
                    <label
                      key={c.key}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#CBD5E1', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(enabledAutoCols[c.key])}
                        onChange={(e) => setEnabledAutoCols((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                        style={{ accentColor: '#FACC15' }}
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Global Search Bar ───────────────────────────────── */}
      {showSearch && searchableColumns.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0, maxWidth: 420 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: 14, pointerEvents: 'none' }}>
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
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
            <span style={{ color: '#38BDF8', fontWeight: 700 }}>{totalItems}</span> records
            {groupByKeys.length > 0 && (
              <span style={{ color: '#64748B' }}> · grouped by {groupByKeys.length} level{groupByKeys.length > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}

      {/* ─── Table Container ────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          borderRadius: 12,
          border: '1px solid #1E293B',
          backgroundColor: '#0B132B',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize }}>
          <thead style={{ backgroundColor: '#07111D', borderBottom: '1px solid #1E293B' }}>
            <tr>
              {hasExpandable && <th style={{ width: 34, textAlign: 'center', padding: cellPadding }} />}
              {hasCheckbox && (
                <th style={{ width: 42, textAlign: 'center', padding: cellPadding }}>
                  <CyberCheckbox checked={isAllSelected} indeterminate={isIndeterminate} onChange={(c) => onSelectAll?.(c)} />
                </th>
              )}
              {showRowNumbers && (
                <th style={{ width: 44, textAlign: 'center', padding: cellPadding, color: '#64748B', fontSize: '0.75rem' }}>
                  #
                </th>
              )}
              {visibleColumns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    draggable={col.groupable !== false}
                    onDragStart={(e) => {
                      setDraggedColKey(col.key);
                      e.dataTransfer.setData('text/plain', col.key);
                    }}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    title={col.groupable !== false ? 'Click to sort · Drag to Group Panel to group' : undefined}
                    style={{
                      padding: cellPadding,
                      color: isSorted ? '#38BDF8' : '#94A3B8',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      cursor: col.sortable !== false ? 'pointer' : 'grab',
                      userSelect: 'none',
                      textAlign: col.align || 'left',
                      width: col.width,
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span>{col.label}</span>
                      {col.sortable !== false && (
                        <span style={{ fontSize: '0.8rem', color: isSorted ? '#38BDF8' : '#475569' }}>
                          {isSorted ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              {hasActions && (
                <th
                  style={{
                    width: 'auto',
                    minWidth: 120,
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                    padding: cellPadding,
                    color: '#94A3B8',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Actions
                </th>
              )}
            </tr>

            {/* Per-Column Filter Row */}
            {showFilterRow && (
              <tr style={{ backgroundColor: '#091526', borderBottom: '1px solid #1E293B' }}>
                {hasExpandable && <th />}
                {hasCheckbox && <th />}
                {showRowNumbers && <th />}
                {visibleColumns.map((col) => (
                  <th key={`filter-${col.key}`} style={{ padding: '6px 8px' }}>
                    {col.filterable !== false && col.searchable !== false ? (
                      <input
                        type="text"
                        placeholder={`Filter ${col.label}...`}
                        value={columnFilters[col.key] || ''}
                        onChange={(e) =>
                          setColumnFilters((prev) => ({ ...prev, [col.key]: e.target.value }))
                        }
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '4px 8px',
                          backgroundColor: '#0B132B',
                          border: '1px solid #1E293B',
                          borderRadius: 6,
                          color: '#F8FAFC',
                          fontSize: '0.75rem',
                          fontWeight: 400,
                          outline: 'none',
                        }}
                      />
                    ) : null}
                  </th>
                ))}
                {hasActions && <th />}
              </tr>
            )}
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={totalColSpan} style={{ textAlign: 'center', padding: '44px 16px', color: '#94A3B8' }}>
                  Loading live data...
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={totalColSpan} style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
                  <div>{emptyMessage}</div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((item, idx) => {
                if (item.type === 'group') {
                  const isCollapsed = Boolean(collapsedGroups[item.groupKey]);
                  return (
                    <tr
                      key={`grp-${item.groupKey}`}
                      onClick={() => toggleGroupExpand(item.groupKey)}
                      style={{
                        backgroundColor: 'rgba(56, 189, 248, 0.08)',
                        borderBottom: '1px solid rgba(30, 41, 59, 0.8)',
                        cursor: 'pointer',
                      }}
                    >
                      <td colSpan={totalColSpan} style={{ padding: '9px 14px', paddingLeft: 14 + item.depth * 22 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ color: '#38BDF8', fontSize: '0.75rem', fontWeight: 700 }}>
                            {isCollapsed ? '▶' : '▼'}
                          </span>
                          <span style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                            {item.label}:
                          </span>
                          <span style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '0.84rem' }}>{item.value}</span>
                          <span
                            style={{
                              padding: '1px 8px',
                              borderRadius: 999,
                              backgroundColor: 'rgba(56, 189, 248, 0.16)',
                              color: '#38BDF8',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}
                          >
                            {item.count} {item.count === 1 ? 'record' : 'records'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const { row, index } = item;
                const rowId = row[rowKey] ?? idx;
                const isExpanded = Boolean(expandedRowKeys[String(rowId)]);
                const isSelected = isRowSelected(row);
                const isDisabled = checkboxDisabled?.(row) || false;
                const isEven = idx % 2 === 0;
                const bg = isSelected
                  ? 'rgba(56, 189, 248, 0.12)'
                  : zebra && !isEven
                    ? 'rgba(7, 17, 29, 0.45)'
                    : 'transparent';

                return (
                  <React.Fragment key={rowId}>
                    <tr
                      onClick={() => onRowClick?.(row, index)}
                      style={{
                        backgroundColor: bg,
                        borderBottom: '1px solid rgba(30, 41, 59, 0.7)',
                        cursor: onRowClick ? 'pointer' : 'default',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (hover) e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.18)' : '#0D1B3E';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = bg;
                      }}
                    >
                      {hasExpandable && (
                        <td
                          style={{ textAlign: 'center', padding: cellPadding, width: 34 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowExpand(rowId);
                          }}
                        >
                          <button
                            type="button"
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              border: '1px solid #1E293B',
                              backgroundColor: isExpanded ? 'rgba(56, 189, 248, 0.16)' : '#07111D',
                              color: isExpanded ? '#38BDF8' : '#94A3B8',
                              cursor: 'pointer',
                              fontSize: '0.68rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        </td>
                      )}
                      {hasCheckbox && (
                        <td style={{ textAlign: 'center', padding: cellPadding }} onClick={(e) => e.stopPropagation()}>
                          <CyberCheckbox
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={(checked) => onRowSelect?.(row, checked)}
                          />
                        </td>
                      )}
                      {showRowNumbers && (
                        <td style={{ textAlign: 'center', padding: cellPadding, color: '#64748B', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {index + 1}
                        </td>
                      )}
                      {visibleColumns.map((col) => (
                        <td key={col.key} style={{ padding: cellPadding, color: '#F8FAFC', textAlign: col.align || 'left' }}>
                          {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                        </td>
                      ))}
                      {hasActions && (
                        <td style={{ textAlign: 'right', padding: cellPadding, whiteSpace: isMobile ? 'normal' : 'nowrap', width: isMobile ? 'auto' : '1%' }}>
                          {renderActionButtons(row, index)}
                        </td>
                      )}
                    </tr>
                    {hasExpandable && isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(7, 17, 29, 0.85)', borderBottom: '1px solid rgba(30, 41, 59, 0.7)' }}>
                        <td colSpan={totalColSpan} style={{ padding: '12px 16px' }}>
                          {renderExpandedRow ? (
                            renderExpandedRow(row)
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {hiddenMobileColumns.map((col) => (
                                <div
                                  key={col.key}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                    paddingBottom: 6,
                                    borderBottom: '1px solid rgba(30, 41, 59, 0.5)',
                                  }}
                                >
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                                    {col.label}
                                  </span>
                                  <div style={{ fontSize: '0.82rem', color: '#E2E8F0' }}>
                                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Pagination + Page Size Selector ─────────────────── */}
      {showPagination && (totalPages > 1 || totalItems > 5) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.82rem', color: '#94A3B8' }}>
            <span>
              Page <strong style={{ color: '#F8FAFC' }}>{safePage}</strong> of <strong style={{ color: '#38BDF8' }}>{totalPages}</strong> ({totalItems} records)
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{
                backgroundColor: '#07111D',
                border: '1px solid #1E293B',
                borderRadius: 6,
                color: '#CBD5E1',
                fontSize: '0.76rem',
                padding: '3px 8px',
                outline: 'none',
              }}
            >
              {[5, 10, 20, 50].map((sz) => (
                <option key={sz} value={sz}>
                  {sz} / page
                </option>
              ))}
            </select>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #1E293B', backgroundColor: '#07111D' }}>
              <button
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage === 1}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: safePage === 1 ? '#475569' : '#94A3B8',
                  cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRight: '1px solid #1E293B',
                }}
              >
                « Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .map((page, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && page - prev > 1;
                  const isActive = page === safePage;
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && (
                        <span style={{ padding: '6px 10px', color: '#475569', fontSize: '0.82rem', borderRight: '1px solid #1E293B' }}>
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
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage === totalPages}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: safePage === totalPages ? '#475569' : '#94A3B8',
                  cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                Next »
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataGridTable;
