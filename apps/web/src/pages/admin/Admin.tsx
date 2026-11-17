import { useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  CheckCircle2,
  DollarSign,
  GraduationCap,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import {
  errorMessage,
  useAdminCoursesQuery,
  useAdminMetricsQuery,
  useAdminOrdersQuery,
  useAdminUpdateCourseStatusMutation,
  useAdminUpdateUserMutation,
  useAdminUsersQuery,
  useAppConfigQuery,
} from '../../api';
import { COURSE_STATUSES, ROLES } from '@lumen/shared';
import { Avatar, Badge, Button, EmptyState, Input, ProgressBar, Select, Skeleton, Stat, Tabs } from '../../components/ui';
import { dateTime, money, relativeDate, statusTone } from '../../lib/format';
import { useToast } from '../../components/Toast';

type Tab = 'overview' | 'users' | 'courses' | 'orders';

export default function Admin({ tab: initialTab }: { tab?: string } = {}) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>((initialTab as Tab) ?? 'overview');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [courseStatus, setCourseStatus] = useState('');
  const [courseQuery, setCourseQuery] = useState('');

  const { data: metrics, isLoading: metricsLoading } = useAdminMetricsQuery();
  const { data: config } = useAppConfigQuery();
  const { data: users, isLoading: usersLoading } = useAdminUsersQuery({ q: query, role: roleFilter, page: String(page), pageSize: '12' });
  const { data: courses, isLoading: coursesLoading } = useAdminCoursesQuery({ status: courseStatus, q: courseQuery });
  const { data: orders = [], isLoading: ordersLoading } = useAdminOrdersQuery();
  const [updateUser] = useAdminUpdateUserMutation();
  const [updateCourseStatus] = useAdminUpdateCourseStatusMutation();

  const changeRole = async (userId: string, role: string) => {
    try {
      await updateUser({ userId, body: { role } }).unwrap();
      toast.success('Role updated');
    } catch (error) {
      toast.error('Could not update role', errorMessage(error));
    }
  };

  const toggleStatus = async (userId: string, current: string) => {
    try {
      await updateUser({ userId, body: { status: current === 'active' ? 'suspended' : 'active' } }).unwrap();
      toast.success('Account status updated');
    } catch (error) {
      toast.error('Could not update account', errorMessage(error));
    }
  };

  const changeCourseStatus = async (courseId: string, status: string) => {
    try {
      await updateCourseStatus({ courseId, status }).unwrap();
      toast.success(`Course set to ${status.replace('_', ' ')}`);
    } catch (error) {
      toast.error('Could not update course', errorMessage(error));
    }
  };

  const paidOrders = orders.filter((order) => order.status === 'paid');

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps mb-2">Platform control</p>
          <h1 className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-none text-ink">Admin console.</h1>
          <p className="mt-3 text-[13px] text-muted">Health, people and content across the whole platform.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {config && [
            ['Media', config.media],
            ['Queue', config.queue],
            ['Payments', config.payments],
            ['Live', config.live],
          ].map(([label, value]) => (
            <span key={label} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[9.5px] text-faint">
              {label}: <span className="text-verdigris">{value}</span>
            </span>
          ))}
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'overview' as Tab, label: 'Overview' },
          { id: 'users' as Tab, label: 'Users', count: metrics?.students && metrics.students + metrics.instructors },
          { id: 'courses' as Tab, label: 'Courses', count: metrics?.courses },
          { id: 'orders' as Tab, label: 'Orders' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* ── overview ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {metricsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : metrics ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Students" value={metrics.students} tone="ember" icon={<Users size={14} />} />
              <Stat label="Instructors" value={metrics.instructors} tone="ochre" icon={<GraduationCap size={14} />} />
              <Stat label="Courses" value={metrics.courses} hint={`${metrics.published} published`} icon={<BookOpen size={14} />} />
              <Stat label="Enrollments" value={metrics.enrollments} tone="verdigris" icon={<CheckCircle2 size={14} />} />
              <Stat label="Gross revenue" value={money(metrics.gross)} tone="verdigris" icon={<DollarSign size={14} />} />
              <Stat label="Certificates" value={metrics.certificates} tone="ochre" icon={<Award size={14} />} />
              <Stat label="Pending review" value={metrics.pending} tone="ember" icon={<ShieldAlert size={14} />} />
              <Stat label="Platform health" value="OK" tone="verdigris" icon={<Activity size={14} />} />
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-[17px] text-ink">Recent orders</h2>
                <button onClick={() => setTab('orders')} className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted hover:text-ember">View all</button>
              </div>
              {orders.length === 0 ? (
                <p className="px-5 py-10 text-center text-[12px] text-faint">No orders yet.</p>
              ) : (
                <div className="divide-y divide-line">
                  {orders.slice(0, 6).map((order) => (
                    <div key={order.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] text-ink">{order.courseTitle}</p>
                        <p className="mt-0.5 font-mono text-[9.5px] text-faint">{order.studentName} · {relativeDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[11.5px] text-ink">{money(order.amount)}</p>
                        <p className={`font-mono text-[9px] uppercase ${order.status === 'paid' ? 'text-verdigris' : 'text-ochre'}`}>{order.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-[17px] text-ink">Newest members</h2>
                <button onClick={() => setTab('users')} className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted hover:text-ember">View all</button>
              </div>
              {!users?.items?.length ? (
                <p className="px-5 py-10 text-center text-[12px] text-faint">No users yet.</p>
              ) : (
                <div className="divide-y divide-line">
                  {users.items.slice(0, 6).map((user) => (
                    <div key={user.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={user.name} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] text-ink">{user.name}</p>
                        <p className="truncate text-[10.5px] text-faint">{user.email}</p>
                      </div>
                      <Badge tone={user.role === 'admin' ? 'ember' : user.role === 'instructor' ? 'ochre' : 'neutral'}>{user.role}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ── users ────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name or email" className="pl-9" />
            </div>
            <Select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="w-40">
              <option value="">All roles</option>
              {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </Select>
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-faint"><SlidersHorizontal size={12} /> {users?.total ?? 0} results</span>
          </div>

          {usersLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : users?.items?.length === 0 ? (
            <EmptyState icon={<Users size={20} />} title="No users found" description="Try a different search or role filter." />
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="hidden grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_0.9fr] gap-4 border-b border-line bg-raised/40 px-4 py-2.5 md:grid">
                  {['Member', 'Role', 'Courses', 'Status', 'Actions'].map((h) => <span key={h} className="label-caps">{h}</span>)}
                </div>
                <div className="divide-y divide-line">
                  {users?.items?.map((user) => (
                    <div key={user.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_0.9fr] md:items-center md:gap-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={user.name} size={30} />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] text-ink">{user.name}</p>
                          <p className="truncate text-[10.5px] text-faint">{user.email}</p>
                        </div>
                      </div>
                      <div>
                        <Select
                          value={user.role}
                          disabled={user.role === 'admin'}
                          onChange={(event) => void changeRole(user.id, event.target.value)}
                          className="h-8 text-[11px]"
                        >
                          {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                        </Select>
                      </div>
                      <span className="font-mono text-[11px] text-muted">{user.courseCount}</span>
                      <div><Badge tone={user.status === 'active' ? 'verdigris' : 'danger'} dot>{user.status}</Badge></div>
                      <div>
                        <Button
                          size="sm"
                          variant={user.status === 'active' ? 'ghost' : 'secondary'}
                          disabled={user.role === 'admin'}
                          onClick={() => void toggleStatus(user.id, user.status ?? 'active')}
                        >
                          {user.status === 'active' ? 'Suspend' : 'Activate'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {users && users.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span className="font-mono text-[11px] text-muted">Page {page} / {users.totalPages}</span>
                  <Button size="sm" variant="outline" disabled={page >= users.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── courses ──────────────────────────────────────────────────── */}
      {tab === 'courses' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <Input value={courseQuery} onChange={(event) => setCourseQuery(event.target.value)} placeholder="Search course titles" className="pl-9" />
            </div>
            <Select value={courseStatus} onChange={(event) => setCourseStatus(event.target.value)} className="w-44">
              <option value="">All statuses</option>
              {COURSE_STATUSES.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
            </Select>
          </div>

          {coursesLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : courses?.length === 0 ? (
            <EmptyState icon={<BookOpen size={20} />} title="No courses found" description="Try a different search or status filter." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="hidden grid-cols-[1.6fr_1fr_0.6fr_0.6fr_1fr] gap-4 border-b border-line bg-raised/40 px-4 py-2.5 md:grid">
                {['Course', 'Instructor', 'Students', 'Price', 'Status'].map((h) => <span key={h} className="label-caps">{h}</span>)}
              </div>
              <div className="divide-y divide-line">
                {courses?.map((course) => (
                  <div key={course.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1.6fr_1fr_0.6fr_0.6fr_1fr] md:items-center md:gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] text-ink">{course.title}</p>
                      <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">{course.category} · {course.lessons} lessons</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] text-muted">{course.instructorName}</p>
                      <p className="truncate text-[10px] text-faint">{course.instructorEmail}</p>
                    </div>
                    <span className="font-mono text-[11px] text-muted">{course.enrollments}</span>
                    <span className="font-mono text-[11px] text-ink">{money(course.price)}</span>
                    <Select
                      value={course.status}
                      onChange={(event) => void changeCourseStatus(course.id, event.target.value)}
                      className="h-8 text-[11px]"
                    >
                      {COURSE_STATUSES.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── orders ───────────────────────────────────────────────────── */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
            <div>
              <p className="label-caps">Paid orders</p>
              <p className="mt-1 font-display text-[24px] text-ink">{money(orders.reduce((sum, order) => sum + (order.status === 'paid' ? order.amount : 0), 0))}</p>
              <p className="mt-0.5 font-mono text-[10px] text-faint">{paidOrders.length} fulfilled · {orders.length - paidOrders.length} other</p>
            </div>
            <DollarSign size={28} className="text-verdigris/50" />
          </div>

          {ordersLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : orders.length === 0 ? (
            <EmptyState icon={<DollarSign size={20} />} title="No orders yet" description="Paid and pending orders will show up here." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="hidden grid-cols-[1.5fr_1.2fr_0.8fr_0.7fr_0.9fr] gap-4 border-b border-line bg-raised/40 px-4 py-2.5 md:grid">
                {['Course', 'Student', 'Amount', 'Status', 'Date'].map((h) => <span key={h} className="label-caps">{h}</span>)}
              </div>
              <div className="divide-y divide-line">
                {orders.map((order) => (
                  <div key={order.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1.5fr_1.2fr_0.8fr_0.7fr_0.9fr] md:items-center md:gap-4">
                    <p className="truncate text-[12.5px] text-ink">{order.courseTitle}</p>
                    <p className="truncate text-[11.5px] text-muted">{order.studentName}</p>
                    <p className="font-mono text-[11px] text-ink">{money(order.amount)}</p>
                    <Badge tone={statusTone[order.status] ?? 'neutral'}>{order.status}</Badge>
                    <p className="font-mono text-[10px] text-faint">{dateTime(order.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
