import { useMemo, useState, type ReactNode } from 'react'

export interface DataColumn<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  sortValue?: (row: T) => string | number | null | undefined
  className?: string
}

export interface TableFilter<T> {
  key: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  matches: (row: T, value: string) => boolean
}

export interface SortOption<T> {
  value: string
  label: string
  compare: (left: T, right: T) => number
}

export function AdminDataTable<T>({
  rows,
  rowKey,
  columns,
  searchableText,
  searchPlaceholder = 'Nhập nội dung cần tìm',
  filters = [],
  sortOptions = [],
  emptyText = 'Không tìm thấy dữ liệu phù hợp.',
  pageSize = 8,
}: {
  rows: T[]
  rowKey: (row: T) => string | number
  columns: DataColumn<T>[]
  searchableText: (row: T) => string
  searchPlaceholder?: string
  filters?: TableFilter<T>[]
  sortOptions?: SortOption<T>[]
  emptyText?: string
  pageSize?: number
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(sortOptions[0]?.value ?? '')
  const [page, setPage] = useState(1)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const filtered = useMemo(() => {
    const result = rows.filter(row => {
      if (normalizedQuery && !searchableText(row).toLocaleLowerCase('vi').includes(normalizedQuery)) return false
      return filters.every(filter => !filter.value || filter.matches(row, filter.value))
    })
    const sorter = sortOptions.find(option => option.value === sort)
    return sorter ? [...result].sort(sorter.compare) : result
  }, [filters, normalizedQuery, rows, searchableText, sort, sortOptions])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const hasFilters = Boolean(query || filters.some(filter => filter.value))

  function clearFilters() {
    setQuery('')
    setPage(1)
    filters.forEach(filter => filter.onChange(''))
  }

  const isInitialEmpty = rows.length === 0

  return <section className="data-panel" aria-label="Danh sách dữ liệu">
    <div className="table-toolbar">
      <label className="search-control">
        <span className="visually-hidden">Tìm kiếm</span>
        <span aria-hidden="true">⌕</span>
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder={searchPlaceholder} />
      </label>
      {filters.map(filter => <label className="filter-control" key={filter.key}><span>{filter.label}</span><select value={filter.value} onChange={event => { filter.onChange(event.target.value); setPage(1) }}><option value="">Tất cả</option>{filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
      {sortOptions.length > 0 && <label className="filter-control"><span>Sắp xếp</span><select value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}>{sortOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>}
      {hasFilters && <button className="button button--quiet table-clear" onClick={clearFilters}>Xóa bộ lọc</button>}
    </div>
    <div className="table-meta" aria-live="polite"><span>{filtered.length} kết quả</span><span>Trang {currentPage}/{pageCount}</span></div>
    {visible.length === 0 ? (
      <div className="table-empty">
        <span aria-hidden="true">○</span>
        <strong>{isInitialEmpty ? 'Chưa có dữ liệu nào.' : emptyText}</strong>
        {!isInitialEmpty && hasFilters && <button className="text-action" onClick={clearFilters}>Xóa bộ lọc</button>}
      </div>
    ) : (
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>{columns.map(column => <th key={column.key} className={column.className} scope="col">{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.key} className={column.className}>{column.render(row)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    )}
    {pageCount > 1 && <nav className="pagination" aria-label="Phân trang"><button className="button button--quiet" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Trước</button><div>{Array.from({ length: pageCount }, (_, index) => index + 1).map(value => <button key={value} aria-current={value === currentPage ? 'page' : undefined} onClick={() => setPage(value)}>{value}</button>)}</div><button className="button button--quiet" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Sau</button></nav>}
  </section>
}