import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCourseFiltersQuery, useCoursesQuery } from '../api';
import { CourseCard } from '../components/CourseCard';
import { Badge, Button, EmptyState, Input, Pagination, Select, Skeleton } from '../components/ui';
import { cn } from '../lib/format';

const SORTS = [
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const LEVELS = [
  { value: '', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [mobileFilters, setMobileFilters] = useState(false);

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const level = params.get('level') ?? '';
  const price = params.get('price') ?? '';
  const sort = params.get('sort') ?? 'popular';
  const page = Number(params.get('page') ?? '1') || 1;

  const query = useMemo(
    () => ({ q, category, level, price, sort, page: String(page), pageSize: '9' }),
    [q, category, level, price, sort, page],
  );

  const { data, isLoading, isFetching } = useCoursesQuery(query);
  const { data: filters } = useCourseFiltersQuery();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search === q) return;
      const next = new URLSearchParams(params);
      if (search.trim()) next.set('q', search.trim());
      else next.delete('q');
      next.delete('page');
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, q, params, setParams]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const clearAll = () => {
    setSearch('');
    setParams(new URLSearchParams());
  };

  const activeFilters = [q, category, level, price].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="label-caps mb-2">Catalog</p>
          <h1 className="text-[clamp(2rem,4vw,2.9rem)] leading-none text-ink">Find your next craft.</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
            {data?.total ?? '—'} courses across development, design, data, business, marketing and documentary work.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<SlidersHorizontal size={13} />}
            className="lg:hidden"
            onClick={() => setMobileFilters((open) => !open)}
          >
            Filters {activeFilters > 0 && <span className="text-ember">({activeFilters})</span>}
          </Button>
          <Select value={sort} onChange={(event) => setParam('sort', event.target.value)} className="w-[190px]">
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[210px_1fr]">
        {/* filters */}
        <aside className={cn('space-y-6 lg:block', mobileFilters ? 'block' : 'hidden')}>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or tag"
              className="pl-8"
              aria-label="Search courses"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div>
            <p className="label-caps mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setParam('category', '')}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                  !category ? 'border-ember/45 bg-ember/12 text-ember' : 'border-line text-muted hover:border-line-strong hover:text-ink',
                )}
              >
                All
              </button>
              {(filters?.categories ?? []).map((item) => (
                <button
                  key={item.name}
                  onClick={() => setParam('category', category === item.name ? '' : item.name)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                    category === item.name
                      ? 'border-ember/45 bg-ember/12 text-ember'
                      : 'border-line text-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  {item.name}
                  <span className="ml-1 font-mono text-[9px] text-faint">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label-caps mb-2">Level</p>
            <div className="space-y-1">
              {LEVELS.map((option) => (
                <button
                  key={option.value || 'all'}
                  onClick={() => setParam('level', option.value)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors',
                    level === option.value ? 'bg-raised text-ink' : 'text-muted hover:text-ink',
                  )}
                >
                  {option.label}
                  {level === option.value && <span className="h-1.5 w-1.5 rounded-full bg-ember" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label-caps mb-2">Price</p>
            <div className="flex gap-1.5">
              {[
                { value: '', label: 'Any' },
                { value: 'free', label: 'Free' },
                { value: 'paid', label: 'Paid' },
              ].map((option) => (
                <button
                  key={option.value || 'any'}
                  onClick={() => setParam('price', option.value)}
                  className={cn(
                    'flex-1 rounded-lg border px-2 py-1.5 text-[11.5px] transition-colors',
                    price === option.value ? 'border-line-strong bg-raised text-ink' : 'border-line text-muted hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} icon={<X size={12} />} block>
              Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
            </Button>
          )}
        </aside>

        {/* results */}
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {q && <Badge tone="ink">“{q}”</Badge>}
              {category && <Badge tone="ember">{category}</Badge>}
              {level && <Badge tone="neutral">{level}</Badge>}
              {isFetching && !isLoading && <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">refreshing…</span>}
            </div>
            <span className="font-mono text-[10px] text-faint">
              {data ? `${data.items.length} of ${data.total}` : ' '}
            </span>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-[330px] rounded-xl" />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', isFetching && 'opacity-60 transition-opacity')}>
                {data.items.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
              <div className="mt-7">
                <Pagination page={data.page} totalPages={data.totalPages} onChange={(next) => setParam('page', String(next))} />
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Filter size={18} />}
              title="No courses match those filters"
              description="Try a broader search, or clear the level and price filters to see the full catalog."
              action={
                <Button variant="secondary" size="sm" onClick={clearAll}>
                  Reset filters
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
