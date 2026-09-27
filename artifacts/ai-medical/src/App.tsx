import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowRight, Bell, BookOpen, CalendarDays, Check, ChevronRight, CircleHelp,
  ClipboardList, Clock3, FileHeart, FilePlus2, HeartPulse, Home, Info, LayoutDashboard,
  ListChecks, Loader2, Menu, Pencil, Plus, RotateCcw, ShieldCheck, Sparkles, Stethoscope,
  Trash2, UserRound, UsersRound, X, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getGetDashboardQueryKey,
  getListAppointmentsQueryKey,
  getListPredictionsQueryKey,
  getListRecordsQueryKey,
  useCreateAppointment,
  useCreatePrediction,
  useCreateRecord,
  useDeleteRecord,
  useGetAdminOverview,
  useGetDashboard,
  useListAppointments,
  useListDoctors,
  useListPredictions,
  useListRecords,
  useUpdateAppointment,
  useUpdateRecord,
} from '@workspace/api-client-react';
import type {
  Appointment, Doctor, MedicalRecord, Prediction, RecordInputRecordType,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();

type Icon = LucideIcon;
type Tone = 'teal' | 'peach' | 'blue' | 'ink' | 'yellow';

const navItems: { href: string; label: string; icon: Icon }[] = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/predict', label: 'Symptom guide', icon: Sparkles },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/records', label: 'My records', icon: FileHeart },
  { href: '/history', label: 'Prediction history', icon: ListChecks },
  { href: '/recommendations', label: 'Health guidance', icon: ShieldCheck },
];

const symptoms = [
  { label: 'Headache', note: 'head or face pain' },
  { label: 'Fatigue', note: 'low energy' },
  { label: 'Cough', note: 'dry or productive' },
  { label: 'Sore throat', note: 'scratchy or painful' },
  { label: 'Fever', note: 'feeling hot or chilled' },
  { label: 'Nausea', note: 'upset stomach' },
  { label: 'Shortness of breath', note: 'breathing feels difficult' },
  { label: 'Body aches', note: 'muscle or joint pain' },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatDate(date?: string | null) {
  if (!date) return 'Not scheduled';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(date?: string | null) {
  if (!date) return '—';
  const parsed = new Date(date.includes('T') ? date : `${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusTone(status: string) {
  if (status === 'urgent' || status === 'cancelled') return 'bg-[hsl(var(--destructive)/.11)] text-[hsl(var(--destructive))]';
  if (status === 'attention' || status === 'pending') return 'bg-[hsl(var(--accent)/.25)] text-[hsl(var(--accent-foreground))]';
  if (status === 'completed' || status === 'active') return 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]';
  return 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]';
}

function Button({ children, variant = 'primary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'outline' | 'danger' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
        variant === 'primary' && 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm hover:-translate-y-0.5 hover:shadow-md',
        variant === 'soft' && 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary)/.72)]',
        variant === 'outline' && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary)/.5)] hover:bg-[hsl(var(--secondary)/.35)]',
        variant === 'danger' && 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.17)]',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Card({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx('surface rounded-[1.35rem]', className)}>{children}</div>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-[hsl(var(--muted))]', className)} />;
}

function LoadingPage() {
  return <div className="space-y-6"><Skeleton className="h-10 w-2/5" /><Skeleton className="h-5 w-1/3" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><Skeleton className="h-64" /></div>;
}

function QueryError({ onRetry, message = 'We could not load this view right now.' }: { onRetry: () => void; message?: string }) {
  return <Card className="flex flex-col items-start gap-4 border-[hsl(var(--destructive)/.3)] p-7"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]"><CircleHelp size={22} /></div><div><h3 className="font-semibold">A small pause</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{message}</p></div><Button variant="outline" onClick={onRetry} data-testid="button-retry"><RotateCcw size={15} /> Try again</Button></Card>;
}

function EmptyState({ icon: EmptyIcon, title, text, action }: { icon: Icon; title: string; text: string; action?: React.ReactNode }) {
  return <Card className="flex flex-col items-center justify-center px-6 py-14 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><EmptyIcon size={25} /></div><h3 className="font-[var(--app-font-serif)] text-xl font-semibold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{text}</p>{action && <div className="mt-5">{action}</div>}</Card>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="grain app-shell flex bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center justify-between px-2"><Link href="/" className="flex items-center gap-3" data-testid="link-brand"><span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><HeartPulse size={22} strokeWidth={2.5} /></span><span><span className="block font-[var(--app-font-serif)] text-lg font-bold tracking-tight">AI Medical</span><span className="mono-font text-[9px] uppercase tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.58)]">Your health, clearer</span></span></Link><button className="text-[hsl(var(--sidebar-foreground)/.7)] lg:hidden" onClick={() => setMobileOpen(false)} data-testid="button-close-menu"><X size={20} /></button></div>
        <div className="my-9 rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.55)] p-4"><div className="mb-3 flex items-center gap-2 text-[hsl(var(--sidebar-primary))]"><Activity size={16} /><span className="mono-font text-[10px] uppercase tracking-[.16em]">Care companion</span></div><p className="text-sm leading-5 text-[hsl(var(--sidebar-foreground)/.75)]">A calmer way to make sense of your health information.</p></div>
        <nav className="space-y-1.5" aria-label="Main navigation">{navItems.map(({ href, label, icon: NavIcon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={cx('group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition-colors', location === href ? 'bg-[hsl(var(--sidebar-primary))] font-semibold text-[hsl(var(--sidebar-primary-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]')}><NavIcon size={18} /><span>{label}</span>{location === href && <ChevronRight className="ml-auto" size={15} />}</Link>)}</nav>
         <div className="mt-auto space-y-1.5"><Link href="/about" onClick={() => setMobileOpen(false)} data-testid="link-nav-about" className={cx('flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]', location === '/about' && 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]')}><Info size={18} /> About AI Medical</Link><div className="mt-5 flex items-center gap-3 border-t border-[hsl(var(--sidebar-border))] px-2 pt-5"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--accent))] font-bold text-[hsl(var(--accent-foreground))]">VJ</div><div className="min-w-0"><p className="truncate text-sm font-semibold">Varad Jadhav</p><p className="text-xs text-[hsl(var(--sidebar-foreground)/.55)]">Patient account</p></div><button className="ml-auto text-[hsl(var(--sidebar-foreground)/.55)] hover:text-[hsl(var(--sidebar-foreground))]" data-testid="button-notifications"><Bell size={17} /></button></div></div>
      </aside>
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-[hsl(var(--foreground)/.3)] lg:hidden" onClick={() => setMobileOpen(false)} data-testid="button-overlay" />}
       <main className="min-w-0 flex-1 lg:ml-[258px]"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[hsl(var(--border)/.75)] bg-[hsl(var(--background)/.9)] px-5 backdrop-blur-md md:px-10"><button className="rounded-lg p-2 lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-menu"><Menu size={21} /></button><div className="hidden items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] md:flex"><span className="h-2 w-2 rounded-full bg-[hsl(var(--sidebar-primary))] pulse-soft" />Private and secure care space</div><div className="ml-auto flex items-center gap-3"><Link href="/predict" data-testid="link-header-predict" className="hidden items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] sm:flex"><Sparkles size={14} /> Check symptoms</Link><div className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-xs font-bold">VJ</div></div></header><div className="mx-auto max-w-[1320px] px-5 py-8 md:px-10 md:py-10">{children}</div></main>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow mb-3">{eyebrow}</p><h1 className="display-font text-4xl font-semibold tracking-tight text-[hsl(var(--foreground))] md:text-5xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>}</div>{action}</div>;
}

function Dashboard() {
  const dashboard = useGetDashboard();
  const data = dashboard.data;
  if (dashboard.isLoading) return <LoadingPage />;
  if (dashboard.isError || !data) return <QueryError onRetry={() => dashboard.refetch()} />;
  const upcoming = data.upcomingAppointment;
  const prediction = data.recentPrediction;
  return <div className="page-in stagger">
     <PageHeading eyebrow={new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())} title={`Good morning, ${data.patientName.split(' ')[0]}.`} description="Here is a clear view of what matters in your health today." action={<Link href="/predict" data-testid="link-start-prediction"><Button><Sparkles size={16} /> Understand a symptom <ArrowRight size={15} /></Button></Link>} />
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="relative overflow-hidden bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]"><div className="absolute -right-8 -top-10 h-36 w-36 rounded-full border-[18px] border-[hsl(var(--sidebar-primary)/.2)]" /><div className="relative"><div className="mb-8 flex items-center justify-between"><span className="eyebrow text-[hsl(var(--primary-foreground)/.68)]">Wellness snapshot</span><HeartPulse size={19} /></div><div className="flex items-end gap-3"><span className="display-font text-5xl font-semibold">{data.wellnessScore}</span><span className="mb-2 text-sm text-[hsl(var(--primary-foreground)/.72)]">/ 100</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--primary-foreground)/.2)]"><div className="h-full rounded-full bg-[hsl(var(--sidebar-primary))]" style={{ width: `${Math.min(data.wellnessScore, 100)}%` }} /></div><p className="mt-3 text-xs text-[hsl(var(--primary-foreground)/.7)]">A gentle check-in, not a diagnosis.</p></div></Card>
      <Card className="p-6"><div className="mb-8 flex items-center justify-between"><span className="eyebrow">Appointments</span><CalendarDays className="text-[hsl(var(--primary))]" size={19} /></div><div className="flex items-end gap-3"><span className="display-font text-5xl font-semibold">{data.totalAppointments}</span><span className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">total visits</span></div><Link href="/appointments" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--primary))]" data-testid="link-dashboard-appointments">View appointments <ArrowRight size={14} /></Link></Card>
      <Card className="p-6"><div className="mb-8 flex items-center justify-between"><span className="eyebrow">Your records</span><FileHeart className="text-[hsl(var(--accent-foreground))]" size={19} /></div><div className="flex items-end gap-3"><span className="display-font text-5xl font-semibold">{data.recordsCount}</span><span className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">organized items</span></div><Link href="/records" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--primary))]" data-testid="link-dashboard-records">Open records <ArrowRight size={14} /></Link></Card>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
      <Card className="p-6 md:p-7"><div className="mb-6 flex items-start justify-between"><div><p className="eyebrow mb-2">Next on your calendar</p><h2 className="display-font text-2xl font-semibold">Upcoming appointment</h2></div><Link href="/appointments" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="link-dashboard-calendar"><ArrowRight size={18} /></Link></div>{upcoming ? <div className="flex flex-col gap-5 rounded-2xl bg-[hsl(var(--secondary)/.48)] p-5 sm:flex-row sm:items-center"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--card))] font-[var(--app-font-serif)] text-xl font-bold text-[hsl(var(--primary))]">{upcoming.doctorName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{upcoming.doctorName}</h3><span className={cx('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider', statusTone(upcoming.status))}>{upcoming.status}</span></div><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{upcoming.specialty} · {upcoming.reason}</p></div><div className="sm:text-right"><p className="font-semibold">{formatDate(upcoming.date)}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{upcoming.time}</p></div></div> : <EmptyState icon={CalendarDays} title="Nothing booked yet" text="When you are ready, find a clinician and choose a time that works for you." action={<Link href="/appointments"><Button variant="soft" data-testid="button-book-first">Find an appointment <ArrowRight size={15} /></Button></Link>} />}</Card>
      <Card className="p-6 md:p-7"><div className="mb-6 flex items-start justify-between"><div><p className="eyebrow mb-2">Most recent guide</p><h2 className="display-font text-2xl font-semibold">Symptom check-in</h2></div><Sparkles size={19} className="text-[hsl(var(--accent-foreground))]" /></div>{prediction ? <div><p className="text-sm text-[hsl(var(--muted-foreground))]">{prediction.symptoms.slice(0, 3).join(' · ')}</p><div className="my-5 flex items-end justify-between"><div><p className="display-font text-2xl font-semibold">{prediction.condition}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Guidance confidence</p></div><span className="mono-font text-2xl font-bold text-[hsl(var(--primary))]">{prediction.confidence}%</span></div><Link href="/history" className="inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--primary))]" data-testid="link-dashboard-history">See full history <ArrowRight size={14} /></Link></div> : <EmptyState icon={Sparkles} title="Start with how you feel" text="A short, thoughtful check-in can help you decide what to do next." action={<Link href="/predict"><Button variant="soft" data-testid="button-check-in">Begin check-in <ArrowRight size={15} /></Button></Link>} />}</Card>
    </div>
    <Card className="mt-6 flex flex-col gap-5 bg-[hsl(var(--accent)/.18)] p-6 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-4"><div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))]"><Zap size={18} /></div><div><p className="eyebrow text-[hsl(var(--accent-foreground)/.7)]">One small step</p><h3 className="mt-1 font-semibold">Your profile is {data.profileCompletion}% complete</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Keeping details current helps your care team support you better.</p></div></div><Button variant="outline" data-testid="button-complete-profile">Review profile <ArrowRight size={14} /></Button></Card>
  </div>;
}

function Predict() {
  const create = useCreatePrediction();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [result, setResult] = useState<Prediction | null>(null);
  const toggle = (label: string) => setSelected((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label]);
  const submit = () => create.mutate({ data: { symptoms: selected, otherSymptoms: other || undefined } }, { onSuccess: (prediction) => { setResult(prediction); void queryClient.invalidateQueries({ queryKey: getListPredictionsQueryKey() }); } });
  return <div className="page-in"><PageHeading eyebrow="Symptom guide" title="Start with how you feel." description="Choose what is bothering you today. We will offer general information and a sensible next step — never a diagnosis." action={<div className="flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))]"><ShieldCheck size={15} /> Safety first</div>} />
    {!result ? <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><Card className="p-6 md:p-8"><div className="mb-7 flex items-center justify-between"><div><p className="eyebrow mb-2">Step 1 of 2</p><h2 className="display-font text-2xl font-semibold">What are you noticing?</h2></div><span className="mono-font text-xs text-[hsl(var(--muted-foreground))]">{selected.length} selected</span></div><div className="grid gap-3 sm:grid-cols-2">{symptoms.map((symptom) => { const active = selected.includes(symptom.label); return <button key={symptom.label} onClick={() => toggle(symptom.label)} data-testid={`button-symptom-${symptom.label.toLowerCase().replaceAll(' ', '-')}`} className={cx('group flex items-center justify-between rounded-2xl border p-4 text-left transition-all', active ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.5)]')}><span><span className="block font-semibold">{symptom.label}</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{symptom.note}</span></span><span className={cx('flex h-6 w-6 items-center justify-center rounded-full border transition-all', active ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] text-transparent')}><Check size={14} /></span></button>; })}</div><label className="mt-6 block"><span className="mb-2 block text-sm font-semibold">Anything else you want to add?</span><textarea value={other} onChange={(event) => setOther(event.target.value)} data-testid="input-other-symptoms" placeholder="For example: started yesterday, worse in the morning..." className="min-h-24 w-full resize-none rounded-2xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-4 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--ring)/.15)]" /></label><div className="mt-7 flex flex-col items-start justify-between gap-4 border-t border-[hsl(var(--border))] pt-6 sm:flex-row sm:items-center"><p className="max-w-md text-xs leading-5 text-[hsl(var(--muted-foreground))]">If symptoms feel severe, sudden, or life-threatening, call your local emergency service now.</p><Button onClick={submit} disabled={selected.length === 0 || create.isPending} data-testid="button-get-guidance">{create.isPending ? <><Loader2 className="animate-spin" size={16} /> Preparing guidance</> : <>Get guidance <ArrowRight size={15} /></>}</Button></div></Card><Card className="h-fit bg-[hsl(var(--sidebar))] p-7 text-[hsl(var(--sidebar-foreground))]"><div className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><ShieldCheck size={22} /></div><p className="eyebrow text-[hsl(var(--sidebar-primary))]">A thoughtful boundary</p><h3 className="mt-3 font-[var(--app-font-serif)] text-2xl font-semibold">Information, not a verdict.</h3><p className="mt-4 text-sm leading-6 text-[hsl(var(--sidebar-foreground)/.7)]">This guide looks for patterns in what you share. It cannot examine you, see your full history, or replace a licensed clinician.</p><div className="mt-8 space-y-4 border-t border-[hsl(var(--sidebar-border))] pt-6 text-sm"><div className="flex gap-3"><Check className="mt-0.5 shrink-0 text-[hsl(var(--sidebar-primary))]" size={16} /><span>Use it to prepare better questions.</span></div><div className="flex gap-3"><Check className="mt-0.5 shrink-0 text-[hsl(var(--sidebar-primary))]" size={16} /><span>Save your result to discuss at a visit.</span></div></div></Card></div> : <PredictionResult prediction={result} onReset={() => { setResult(null); setSelected([]); setOther(''); }} /> }
  </div>;
}

function PredictionResult({ prediction, onReset }: { prediction: Prediction; onReset: () => void }) {
  return <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><Card className="overflow-hidden"><div className="bg-[hsl(var(--primary))] p-7 text-[hsl(var(--primary-foreground))] md:p-9"><div className="flex items-center justify-between"><span className="eyebrow text-[hsl(var(--primary-foreground)/.7)]">Your guidance</span><span className={cx('rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider', prediction.urgency === 'urgent' ? 'bg-[hsl(var(--destructive))] text-white' : 'bg-[hsl(var(--primary-foreground)/.15)]')}>{prediction.urgency}</span></div><h2 className="display-font mt-8 text-4xl font-semibold">{prediction.condition}</h2><p className="mt-3 max-w-xl leading-6 text-[hsl(var(--primary-foreground)/.75)]">{prediction.recommendation}</p><div className="mt-8 flex items-center gap-5"><div className="flex h-20 w-20 items-center justify-center rounded-full border-[6px] border-[hsl(var(--sidebar-primary)/.55)]"><span className="mono-font text-lg font-bold">{prediction.confidence}%</span></div><div><p className="font-semibold">Guidance confidence</p><p className="mt-1 text-sm text-[hsl(var(--primary-foreground)/.66)]">Based only on what you shared</p></div></div></div><div className="p-7 md:p-9"><p className="eyebrow mb-4">Associated patterns</p><div className="flex flex-wrap gap-2">{prediction.associatedSymptoms.map((item) => <span key={item} className="rounded-full bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))]">{item}</span>)}</div><div className="mt-8 rounded-2xl border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.12)] p-5"><p className="flex items-center gap-2 text-sm font-semibold"><CircleHelp size={16} /> When to seek help</p><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">If your symptoms worsen, persist, or concern you, contact a healthcare professional. For an emergency, call your local emergency service.</p></div></div></Card><Card className="h-fit p-7"><p className="eyebrow mb-3">Next steps</p><h3 className="display-font text-2xl font-semibold">Carry this forward.</h3><div className="mt-6 space-y-3"><Link href="/appointments" data-testid="link-result-appointments" className="flex items-center justify-between rounded-2xl bg-[hsl(var(--secondary)/.6)] p-4 transition hover:bg-[hsl(var(--secondary))]"><span className="flex items-center gap-3"><CalendarDays size={18} className="text-[hsl(var(--primary))]" /><span className="text-sm font-semibold">Talk with a clinician</span></span><ArrowRight size={16} /></Link><Link href="/history" data-testid="link-result-history" className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] p-4 transition hover:border-[hsl(var(--primary)/.45)]"><span className="flex items-center gap-3"><BookOpen size={18} className="text-[hsl(var(--primary))]" /><span className="text-sm font-semibold">Review past guidance</span></span><ArrowRight size={16} /></Link></div><Button variant="outline" className="mt-8 w-full" onClick={onReset} data-testid="button-new-check-in"><Plus size={16} /> Start another check-in</Button></Card></div>;
}

function Appointments() {
  const appointments = useListAppointments();
  const doctors = useListDoctors();
  const create = useCreateAppointment();
  const update = useUpdateAppointment();
  const queryClient = useQueryClient();
  const [booking, setBooking] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState({ date: '', time: '', reason: '' });
  const list = appointments.data ?? [];
  const book = () => { if (!selectedDoctor) return; create.mutate({ data: { doctorId: selectedDoctor.id, date: form.date, time: form.time, reason: form.reason } }, { onSuccess: () => { setBooking(false); setSelectedDoctor(null); setForm({ date: '', time: '', reason: '' }); void queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } }); };
  const cancel = (id: number) => { if (!window.confirm('Cancel this appointment?')) return; update.mutate({ id, data: { status: 'cancelled' } }, { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() }) }); };
  if (appointments.isLoading || doctors.isLoading) return <LoadingPage />;
  if (appointments.isError || doctors.isError) return <QueryError onRetry={() => { void appointments.refetch(); void doctors.refetch(); }} />;
  return <div className="page-in"><PageHeading eyebrow="Care calendar" title="Appointments" description="Find the right support, then keep the details in one calm place." action={<Button onClick={() => setBooking(true)} data-testid="button-book-appointment"><Plus size={16} /> Book appointment</Button>} />
    {booking && <Card className="mb-7 border-[hsl(var(--primary)/.35)] p-6 md:p-8"><div className="mb-6 flex items-start justify-between"><div><p className="eyebrow mb-2">New appointment</p><h2 className="display-font text-2xl font-semibold">{selectedDoctor ? `Choose a time with ${selectedDoctor.name}` : 'Choose a clinician'}</h2></div><button onClick={() => setBooking(false)} data-testid="button-close-booking"><X size={20} /></button></div>{!selectedDoctor ? <div className="grid gap-3 md:grid-cols-2">{(doctors.data ?? []).map((doctor) => <button key={doctor.id} onClick={() => setSelectedDoctor(doctor)} data-testid={`button-doctor-${doctor.id}`} className="lift flex items-center gap-4 rounded-2xl border border-[hsl(var(--border))] p-4 text-left"><div className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold text-[hsl(var(--foreground))]" style={{ background: doctor.accent }}>{doctor.initials}</div><div className="flex-1"><p className="font-semibold">{doctor.name}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{doctor.specialty}</p><p className="mt-2 text-xs font-semibold text-[hsl(var(--primary))]">Next available {formatDate(doctor.nextAvailable)}</p></div><ChevronRight size={17} className="text-[hsl(var(--muted-foreground))]" /></button>)}</div> : <div><button className="mb-5 text-sm font-semibold text-[hsl(var(--primary))]" onClick={() => setSelectedDoctor(null)} data-testid="button-back-doctors">← Choose another clinician</button><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} data-testid="input-appointment-date" className="mt-2 block w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-3 font-normal outline-none focus:border-[hsl(var(--primary))]" /></label><label className="text-sm font-semibold">Time<select value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} data-testid="select-appointment-time" className="mt-2 block w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-3 font-normal outline-none focus:border-[hsl(var(--primary))]"><option value="">Select a time</option>{(selectedDoctor.availableSlots ?? ['09:00 AM', '10:30 AM', '02:00 PM']).map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label><label className="text-sm font-semibold md:col-span-2">What would you like to discuss?<textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} data-testid="input-appointment-reason" placeholder="A short note helps your clinician prepare" className="mt-2 block min-h-24 w-full resize-none rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-3 font-normal outline-none focus:border-[hsl(var(--primary))]" /></label></div><div className="mt-6 flex justify-end"><Button onClick={book} disabled={!form.date || !form.time || form.reason.length < 3 || create.isPending} data-testid="button-confirm-appointment">{create.isPending ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} {create.isPending ? 'Booking' : 'Confirm appointment'}</Button></div></div>}</Card>}
    {list.length === 0 ? <EmptyState icon={CalendarDays} title="Your calendar is open" text="Book a visit when you need a little more support." action={<Button onClick={() => setBooking(true)} data-testid="button-book-empty"><Plus size={16} /> Book a visit</Button>} /> : <div className="space-y-4">{list.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} onCancel={cancel} />)}</div>}
  </div>;
}

function AppointmentCard({ appointment, onCancel }: { appointment: Appointment; onCancel: (id: number) => void }) {
  return <Card className="lift flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6"><div className="flex items-center gap-4 md:w-[42%]"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] font-[var(--app-font-serif)] font-bold text-[hsl(var(--primary))]">{appointment.doctorName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{appointment.doctorName}</h3><span className={cx('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider', statusTone(appointment.status))}>{appointment.status}</span></div><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{appointment.specialty}</p></div></div><div className="flex flex-1 gap-5 border-t border-[hsl(var(--border))] pt-4 text-sm md:border-l md:border-t-0 md:pl-6 md:pt-0"><div><p className="eyebrow mb-1">Date</p><p className="font-semibold">{formatDate(appointment.date)}</p></div><div><p className="eyebrow mb-1">Time</p><p className="font-semibold">{appointment.time}</p></div><div className="hidden sm:block"><p className="eyebrow mb-1">Reason</p><p className="max-w-[220px] truncate text-[hsl(var(--muted-foreground))]">{appointment.reason}</p></div></div>{appointment.status === 'upcoming' && <Button variant="outline" onClick={() => onCancel(appointment.id)} data-testid={`button-cancel-appointment-${appointment.id}`}>Cancel</Button>}</Card>;
}

type RecordForm = { recordType: RecordInputRecordType; title: string; provider: string; date: string; summary: string };
const blankRecord: RecordForm = { recordType: 'visit', title: '', provider: '', date: '', summary: '' };

function Records() {
  const records = useListRecords();
  const create = useCreateRecord();
  const update = useUpdateRecord();
  const remove = useDeleteRecord();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<MedicalRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<RecordForm>(blankRecord);
  const openAdd = () => { setForm(blankRecord); setEditing(null); setAdding(true); };
  const openEdit = (record: MedicalRecord) => { setForm({ recordType: record.recordType, title: record.title, provider: record.provider, date: record.date, summary: record.summary }); setEditing(record); setAdding(true); };
  const close = () => setAdding(false);
  const save = () => { if (editing) update.mutate({ id: editing.id, data: { title: form.title, provider: form.provider, date: form.date, summary: form.summary } }, { onSuccess: () => { close(); void queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() }); } }); else create.mutate({ data: form }, { onSuccess: () => { close(); void queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } }); };
  const removeRecord = (id: number) => { if (!window.confirm('Delete this record? This cannot be undone.')) return; remove.mutate({ id }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } }); };
  if (records.isLoading) return <LoadingPage />;
  if (records.isError) return <QueryError onRetry={() => records.refetch()} />;
  return <div className="page-in"><PageHeading eyebrow="Your health archive" title="Medical records" description="Keep visits, labs, prescriptions, and personal notes easy to find." action={<Button onClick={openAdd} data-testid="button-add-record"><FilePlus2 size={16} /> Add record</Button>} />
    {adding && <Card className="mb-7 p-6 md:p-8"><div className="mb-6 flex justify-between"><div><p className="eyebrow mb-2">{editing ? 'Edit record' : 'New record'}</p><h2 className="display-font text-2xl font-semibold">{editing ? 'Keep the details current.' : 'Add something worth keeping.'}</h2></div><button onClick={close} data-testid="button-close-record-form"><X size={20} /></button></div><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Record type<select value={form.recordType} disabled={!!editing} onChange={(event) => setForm({ ...form, recordType: event.target.value as RecordInputRecordType })} data-testid="select-record-type" className="mt-2 block w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-3 font-normal outline-none focus:border-[hsl(var(--primary))]"><option value="visit">Visit</option><option value="lab">Lab result</option><option value="prescription">Prescription</option><option value="note">Personal note</option></select></label><label className="text-sm font-semibold">Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} data-testid="input-record-date" className="mt-2 block w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-3 font-normal outline-none focus:border-[hsl(var(--primary))]" /></label><label className="text-sm font-semibold">Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} data-testid="input-record-title" placeholder="e.g. Annual physical" className="mt-2 block w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-3 font-normal outline-none focus:border-[hsl(var(--primary))]" /></label><label className="text-sm font-semibold">Provider<input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} data-testid="input-record-provider" placeholder="e.g. Harborview Clinic" className="mt-2 block w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-3 font-normal outline-none focus:border-[hsl(var(--primary))]" /></label><label className="text-sm font-semibold md:col-span-2">Summary<textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} data-testid="input-record-summary" placeholder="A short, useful summary" className="mt-2 block min-h-24 w-full resize-none rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-3 font-normal outline-none focus:border-[hsl(var(--primary))]" /></label></div><div className="mt-6 flex justify-end"><Button onClick={save} disabled={!form.title || !form.provider || !form.date || !form.summary || create.isPending || update.isPending} data-testid="button-save-record">{(create.isPending || update.isPending) ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Save record</Button></div></Card>}
    {(records.data ?? []).length === 0 ? <EmptyState icon={FileHeart} title="Your archive starts here" text="Add a record after a visit, test, or prescription so the important details stay together." action={<Button onClick={openAdd} data-testid="button-add-first-record"><FilePlus2 size={16} /> Add your first record</Button>} /> : <div className="grid gap-4 md:grid-cols-2">{(records.data ?? []).map((record) => <RecordCard key={record.id} record={record} onEdit={openEdit} onDelete={removeRecord} />)}</div>}
  </div>;
}

function RecordCard({ record, onEdit, onDelete }: { record: MedicalRecord; onEdit: (record: MedicalRecord) => void; onDelete: (id: number) => void }) {
  const recordIcon: Record<string, Icon> = { visit: Stethoscope, lab: Activity, prescription: ClipboardList, note: BookOpen };
  const RecordIcon = recordIcon[record.recordType] ?? FileHeart;
  return <Card className="lift relative p-6"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><RecordIcon size={19} /></div><div><p className="eyebrow">{record.recordType}</p><h3 className="mt-1 font-semibold">{record.title}</h3></div></div><span className={cx('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider', statusTone(record.status))}>{record.status}</span></div><p className="mt-5 line-clamp-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{record.summary}</p><div className="mt-5 flex items-center justify-between border-t border-[hsl(var(--border))] pt-4"><div><p className="text-xs font-semibold">{record.provider}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatDate(record.date)}</p></div><div className="flex gap-1"><button onClick={() => onEdit(record)} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]" data-testid={`button-edit-record-${record.id}`}><Pencil size={15} /></button><button onClick={() => onDelete(record.id)} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.1)] hover:text-[hsl(var(--destructive))]" data-testid={`button-delete-record-${record.id}`}><Trash2 size={15} /></button></div></div></Card>;
}

function History() {
  const predictions = useListPredictions();
  if (predictions.isLoading) return <LoadingPage />;
  if (predictions.isError) return <QueryError onRetry={() => predictions.refetch()} />;
  const items = predictions.data ?? [];
  return <div className="page-in"><PageHeading eyebrow="Your care trail" title="Prediction history" description="A private record of your symptom check-ins, so you can notice patterns and prepare for conversations." action={<Link href="/predict"><Button data-testid="button-new-prediction"><Sparkles size={16} /> New check-in</Button></Link>} />{items.length === 0 ? <EmptyState icon={ListChecks} title="No check-ins yet" text="Your completed symptom guides will appear here." action={<Link href="/predict"><Button variant="soft" data-testid="button-first-prediction">Start a check-in <ArrowRight size={15} /></Button></Link>} /> : <div className="space-y-4">{items.map((prediction) => <Card key={prediction.id} className="lift p-6"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="display-font text-2xl font-semibold">{prediction.condition}</h2><span className={cx('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider', statusTone(prediction.urgency))}>{prediction.urgency}</span></div><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{prediction.symptoms.join(' · ')}</p></div><div className="md:text-right"><p className="mono-font text-lg font-bold text-[hsl(var(--primary))]">{prediction.confidence}%</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatDate(prediction.createdAt)}</p></div></div><div className="mt-5 grid gap-4 border-t border-[hsl(var(--border))] pt-5 md:grid-cols-[1fr_auto]"><p className="max-w-3xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{prediction.recommendation}</p><Link href="/recommendations" data-testid={`link-history-recommendations-${prediction.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--primary))]">Safety guidance <ArrowRight size={14} /></Link></div></Card>)}</div>}</div>;
}

function Recommendations() {
  const items = [
    { icon: ShieldCheck, title: 'Know your urgent signals', text: 'Sudden trouble breathing, severe chest pain, loss of consciousness, or signs of stroke need immediate emergency care.' },
    { icon: ClipboardList, title: 'Bring context to a visit', text: 'Write down when a symptom began, what changes it, what you have tried, and any questions you do not want to forget.' },
    { icon: Clock3, title: 'Notice the pattern', text: 'A simple note of timing, sleep, meals, stress, and medication can help a clinician see the fuller picture.' },
    { icon: FileHeart, title: 'Keep your list current', text: 'Review medications, allergies, providers, and records regularly. Small updates can make future care safer.' },
  ];
  return <div className="page-in"><PageHeading eyebrow="Gentle guidance" title="Care, with context." description="Practical reminders to help you decide what to do next. This is general education, not personalized medical advice." /><div className="grid gap-4 md:grid-cols-2">{items.map(({ icon: ItemIcon, title, text }, index) => <Card key={title} className={cx('p-7', index === 0 && 'border-[hsl(var(--accent)/.5)] bg-[hsl(var(--accent)/.12)]')}><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><ItemIcon size={20} /></div><div><h2 className="display-font text-2xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{text}</p></div></div></Card>)}</div><Card className="mt-6 flex flex-col gap-5 bg-[hsl(var(--sidebar))] p-7 text-[hsl(var(--sidebar-foreground))] md:flex-row md:items-center md:justify-between"><div><p className="eyebrow text-[hsl(var(--sidebar-primary))]">Need more support?</p><h2 className="display-font mt-2 text-2xl font-semibold">A clinician can add the missing context.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--sidebar-foreground)/.68)]">Use your records and symptom history to make that conversation more useful.</p></div><Link href="/appointments"><Button variant="soft" data-testid="button-find-clinician">Find a clinician <ArrowRight size={15} /></Button></Link></Card></div>;
}

function Admin() {
  const overview = useGetAdminOverview();
  const appointments = useListAppointments();
  if (overview.isLoading) return <LoadingPage />;
  if (overview.isError || !overview.data) return <QueryError onRetry={() => overview.refetch()} />;
  const data = overview.data;
  const max = Math.max(...data.appointmentsByStatus.map((item) => item.value), 1);
  return <div className="page-in"><PageHeading eyebrow="Clinician workspace" title="Care overview" description="A concise view of the care network today. Built for calm decisions, not noisy dashboards." action={<div className="flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))]"><UsersRound size={15} /> Admin view</div>} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><AdminMetric label="Patients" value={data.patientCount} icon={UsersRound} tone="teal" /><AdminMetric label="Appointments" value={data.appointmentCount} icon={CalendarDays} tone="blue" /><AdminMetric label="Needs attention" value={data.pendingAppointments} icon={Clock3} tone="peach" /><AdminMetric label="Records this week" value={data.recordsAddedThisWeek} icon={FilePlus2} tone="yellow" /></div><div className="mt-6 grid gap-6 lg:grid-cols-[.85fr_1.15fr]"><Card className="p-7"><p className="eyebrow mb-2">Appointment flow</p><h2 className="display-font text-2xl font-semibold">By status</h2><div className="mt-8 space-y-5">{data.appointmentsByStatus.map((item) => <div key={item.label}><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">{item.label}</span><span className="mono-font text-xs text-[hsl(var(--muted-foreground))]">{item.value}</span></div><div className="h-3 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))] transition-all" style={{ width: `${(item.value / max) * 100}%` }} /></div></div>)}</div></Card><Card className="p-7"><div className="mb-6 flex items-start justify-between"><div><p className="eyebrow mb-2">Today at a glance</p><h2 className="display-font text-2xl font-semibold">Recent appointments</h2></div><Stethoscope className="text-[hsl(var(--primary))]" size={20} /></div>{appointments.isLoading ? <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : (appointments.data ?? []).slice(0, 4).map((appointment) => <div key={appointment.id} className="flex items-center gap-4 border-t border-[hsl(var(--border))] py-4 first:border-t-0 first:pt-0"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">{appointment.doctorName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{appointment.doctorName}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatShortDate(appointment.date)} · {appointment.time}</p></div><span className={cx('rounded-full px-2 py-1 text-[10px] font-bold uppercase', statusTone(appointment.status))}>{appointment.status}</span></div>)}</Card></div><Card className="mt-6 flex items-center gap-4 bg-[hsl(var(--secondary)/.42)] p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--card))] text-[hsl(var(--primary))]"><Info size={19} /></div><p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">This overview is designed to support clinical workflows. Always use professional judgment and the complete patient record for decisions.</p></Card></div>;
}

function AdminMetric({ label, value, icon: MetricIcon, tone }: { label: string; value: number; icon: Icon; tone: Tone }) {
  const colors: Record<Tone, string> = { teal: 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]', peach: 'bg-[hsl(var(--accent)/.3)] text-[hsl(var(--accent-foreground))]', blue: 'bg-[hsl(var(--chart-3)/.15)] text-[hsl(var(--chart-3))]', ink: 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]', yellow: 'bg-[hsl(var(--chart-5)/.2)] text-[hsl(var(--foreground))]' };
  return <Card className="p-5"><div className="flex items-center justify-between"><div className={cx('flex h-10 w-10 items-center justify-center rounded-xl', colors[tone])}><MetricIcon size={18} /></div><span className="mono-font text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Live</span></div><p className="display-font mt-6 text-4xl font-semibold">{value}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{label}</p></Card>;
}

function About() {
  return <div className="page-in max-w-4xl"><p className="eyebrow mb-4">The thinking behind AI Medical</p><h1 className="display-font max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">Good health care starts with feeling heard.</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-[hsl(var(--muted-foreground))]">AI Medical helps you make sense of the in-between moments: the symptom you are unsure about, the appointment you need to remember, the record that should not be buried in a drawer.</p><div className="mt-12 grid gap-4 md:grid-cols-2"><Card className="p-7"><div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><HeartPulse size={21} /></div><h2 className="display-font text-2xl font-semibold">Human-centered by design</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Clear language, useful context, and fewer places to lose the thread. Your health story belongs to you.</p></Card><Card className="p-7"><div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.3)] text-[hsl(var(--accent-foreground))]"><ShieldCheck size={21} /></div><h2 className="display-font text-2xl font-semibold">Safety has edges</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">AI Medical does not diagnose, prescribe, or replace a healthcare professional. It is a guide for better questions and better preparation.</p></Card></div><Card className="mt-4 bg-[hsl(var(--sidebar))] p-8 text-[hsl(var(--sidebar-foreground))] md:p-10"><p className="eyebrow text-[hsl(var(--sidebar-primary))]">A note worth keeping</p><h2 className="display-font mt-3 text-3xl font-semibold">If something feels urgent, trust that feeling.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[hsl(var(--sidebar-foreground)/.7)]">For severe, sudden, or life-threatening symptoms, contact your local emergency service. For everything else, use this space to gather context and connect with a licensed clinician.</p><Link href="/recommendations" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--sidebar-primary))]" data-testid="link-about-guidance">Read safety guidance <ArrowRight size={15} /></Link></Card></div>;
}

function RouterContent() {
  const [location] = useLocation();
  return <AppShell><Switch><Route path="/" component={Dashboard} /><Route path="/predict" component={Predict} /><Route path="/appointments" component={Appointments} /><Route path="/records" component={Records} /><Route path="/history" component={History} /><Route path="/recommendations" component={Recommendations} /><Route path="/admin" component={Admin} /><Route path="/about" component={About} /><Route component={NotFound} /></Switch></AppShell>;
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><RouterContent /></RoutedErrorBoundary></WouterRouter><Toaster /></QueryClientProvider>;
}

export default App;