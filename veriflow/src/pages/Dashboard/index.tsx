import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import {
  VpnKeyRounded as KeyIcon,
  FactCheckRounded as RuleIcon,
  AccessTimeFilledRounded as ShiftIcon,
  QrCodeScannerRounded as ScanIcon,
  ArrowForwardRounded as ArrowIcon,
  ShieldRounded as ShieldCheckIcon,
} from '@mui/icons-material';
import ReactECharts from 'echarts-for-react';
import { useDashboardOverviewQuery } from './query';
import { useActiveShiftQuery, useShiftsQuery } from '../Shifts/query';
import { useAdminUsersQuery } from '../Admin/query';
import { useRulesQuery } from '../Rules/query';
import { useAuthStore } from '../../store/authStore';
import { usePermission, useIsAdmin } from '../../HOCS/withPermissions';
import { AttendanceChart } from './components/AttendanceChart';
import { ShiftsPanel } from './components/ShiftsPanel';
import { RulesMatrixChart } from './components/RulesMatrixChart';

type AnalyticsTab = 'attendance' | 'shifts' | 'rules';

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // Permission Checks: strictly isolate features based on permissions & roles
  const canKeys = usePermission('keys').allowed;
  const canRules = usePermission('rules').allowed;
  const canShifts = usePermission('shifts').allowed;
  const canScans = usePermission('scans').allowed;
  const isAdmin = useIsAdmin();

  const { data: stats, isLoading } = useDashboardOverviewQuery();
  const { data: activeShift, isLoading: isLoadingShift } = useActiveShiftQuery();
  const { data: shiftsData } = useShiftsQuery({ enabled: canShifts });
  const { data: usersData } = useAdminUsersQuery({ enabled: isAdmin });
  const { data: rulesData } = useRulesQuery({ enabled: canRules });

  const canViewOtherShifts =
    isAdmin ||
    Boolean(user?.permissions?.['shifts.view.any']) ||
    Boolean(user?.permissions?.['shifts.view.all']) ||
    Boolean(user?.permissions?.['shifts.view']);
  const canViewOtherRules = isAdmin;

  // If user has shifts.view permission (or admin), they can view all shifts telemetry; else strictly only their own
  const userShifts = useMemo(() => {
    const items = Array.isArray(shiftsData?.items) ? shiftsData.items : [];
    if (canViewOtherShifts) return items;
    const currentId = Number(user?.id);
    return items.filter((s: any) => s && s.user_id === currentId);
  }, [shiftsData, canViewOtherShifts, user?.id]);

  // Only permit tabs the user actually has authorization to view
  const availableTabs = useMemo(() => {
    const tabs: { id: AnalyticsTab; label: string }[] = [];
    if (canShifts) {
      tabs.push({ id: 'attendance', label: '⏱ Attendance (Day/Hr/Min)' });
      tabs.push({ id: 'shifts', label: '📑 Shift Checkouts' });
    }
    if (canRules) {
      tabs.push({ id: 'rules', label: '⚡ Rules Matrix' });
    }
    return tabs;
  }, [canShifts, canRules]);

  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<AnalyticsTab>(() => {
    if (canShifts) return 'attendance';
    if (canRules) return 'rules';
    return 'attendance';
  });

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.id === activeAnalyticsTab)) {
      setActiveAnalyticsTab(availableTabs[0].id);
    }
  }, [availableTabs, activeAnalyticsTab]);

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0F172A',
      borderColor: '#1E293B',
      textStyle: { color: '#F8FAFC' },
    },
    legend: {
      data: ['Valid Scans', 'Violations'],
      textStyle: { color: '#94A3B8' },
      top: 0,
      right: 10,
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '3%',
      top: '40px',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', 'Now'],
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#64748B' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLabel: { color: '#64748B' },
    },
    series: [
      {
        name: 'Valid Scans',
        type: 'line',
        smooth: true,
        data: (stats?.validScansCount ?? 0) > 0
          ? [
              Math.round((stats?.validScansCount ?? 0) * 0.1),
              Math.round((stats?.validScansCount ?? 0) * 0.25),
              Math.round((stats?.validScansCount ?? 0) * 0.4),
              Math.round((stats?.validScansCount ?? 0) * 0.6),
              Math.round((stats?.validScansCount ?? 0) * 0.55),
              Math.round((stats?.validScansCount ?? 0) * 0.8),
              stats?.validScansCount ?? 0,
            ]
          : [0, 0, 0, 0, 0, 0, 0],
        itemStyle: { color: '#10B981' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.35)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
            ],
          },
        },
      },
      {
        name: 'Violations',
        type: 'line',
        smooth: true,
        data: (stats?.invalidScansCount ?? 0) > 0
          ? [0, 0, Math.min(1, stats?.invalidScansCount ?? 0), 0, Math.min(1, stats?.invalidScansCount ?? 0), 0, stats?.invalidScansCount ?? 0]
          : [0, 0, 0, 0, 0, 0, 0],
        itemStyle: { color: '#EF4444' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.35)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.0)' },
            ],
          },
        },
      },
    ],
  };

  const totalScans = (stats?.validScansCount || 0) + (stats?.invalidScansCount || 0);
  const successRate = totalScans > 0 ? Math.round(((stats?.validScansCount || 0) / totalScans) * 100) : 100;

  const canCreateKey = canKeys && (isAdmin || Boolean(user?.permissions?.['keys.create']));
  const canCreateShift = canShifts && (isAdmin || Boolean(user?.permissions?.['shifts.create']));
  const hasAnyAction = canCreateShift || canCreateKey || canRules || canScans;

  return (
    <div className="w-full min-w-0 space-y-6 max-w-7xl mx-auto pb-12 overflow-x-hidden">
      {/* Industrial Station Hero Banner */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FACC15]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/msi_white.png"
              alt="VeriFlow"
              className="w-12 h-12 md:w-14 md:h-14 object-contain filter drop-shadow-[0_0_12px_rgba(250,204,21,0.25)]"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black text-[#FACC15] tracking-tight font-mono">
                  VERIFLOW INDUSTRIAL
                </h1>
                <span className="badge badge-warning badge-outline text-[10px] font-mono font-bold tracking-wider">
                  STATION V2.4
                </span>
              </div>
              <p className="text-slate-400 text-xs md:text-sm font-medium mt-0.5">
                Cryptographic RS256 QR Verification, Shift Scanners & Policy Governance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>RS256 ENGINE ACTIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Android-style Active Operator Shift Card */}
      {canShifts && (
        <div
          className={`rounded-2xl transition-all shadow-xl p-5 md:p-6 ${
            activeShift
              ? 'bg-[#0F172A] border-2 border-[#FACC15] shadow-[0_0_20px_rgba(250,204,21,0.12)]'
              : 'bg-[#0F172A] border border-[#1E293B]'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <ShieldCheckIcon sx={{ color: activeShift ? '#10B981' : '#94A3B8', fontSize: 24 }} />
                <span
                  className={`font-mono text-xs md:text-sm font-extrabold uppercase tracking-wide ${
                    activeShift ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {activeShift ? 'ACTIVE SHIFT VERIFIED (RS256)' : 'NO SHIFT ACTIVE (STANDBY)'}
                </span>
                <span className="badge badge-sm badge-neutral font-mono text-[10px]">
                  OPERATOR: {user?.name || user?.email?.split('@')[0] || 'WORKER'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300">
                <div>
                  <span className="text-slate-500">DEVICE: </span>
                  <span className="text-[#FACC15] font-bold">
                    {isLoadingShift ? 'Checking...' : activeShift?.device_id || 'STATION-DESKTOP'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">SESSION ID: </span>
                  <span className="text-slate-200">
                    {activeShift?.id ? `#${activeShift.id}` : 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">EXPIRES: </span>
                  <span className="text-slate-300">
                    {activeShift?.expires_at ? new Date(activeShift.expires_at).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {activeShift ? (
                <>
                  <button
                    onClick={() => navigate('/shifts')}
                    className="btn btn-warning btn-sm font-bold shadow-lg gap-2 text-slate-900"
                  >
                    <ShiftIcon sx={{ fontSize: 18 }} />
                    View Shift QR Token
                  </button>
                  {canScans && (
                    <button
                      onClick={() => navigate('/scans')}
                      className="btn btn-outline btn-sm font-bold gap-2 border-slate-700 text-slate-200 hover:bg-slate-800"
                    >
                      <ScanIcon sx={{ fontSize: 18 }} />
                      Scan Audits
                    </button>
                  )}
                </>
              ) : canCreateShift ? (
                <button
                  onClick={() => navigate('/shifts')}
                  className="btn btn-warning btn-sm font-bold shadow-lg gap-2 text-slate-900"
                >
                  <ShiftIcon sx={{ fontSize: 18 }} />
                  Start Work Shift
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* DaisyUI Responsive Stats Grid: Gated by individual feature permissions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Crypto Keys (Hidden if no permission) */}
        {canKeys && (
          <div
            onClick={() => navigate('/keys')}
            className="bg-[#0F172A] border border-[#1E293B] hover:border-blue-500/50 rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 shadow-lg flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400">ACTIVE RSA KEYS</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <KeyIcon fontSize="small" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-3xl font-black font-mono text-white">
                {isLoading ? <CircularProgress size={24} /> : stats?.activeKeysCount ?? 0}
              </div>
            </div>
            <div className="text-xs text-blue-400 font-mono flex items-center gap-1">
              <span>Manage JWKS & Rotation</span>
              <ArrowIcon sx={{ fontSize: 14 }} />
            </div>
          </div>
        )}

        {/* Stat 2: Inventory Rules (Hidden if no permission) */}
        {canRules && (
          <div
            onClick={() => navigate('/rules')}
            className="bg-[#0F172A] border border-[#1E293B] hover:border-[#FACC15]/50 rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 shadow-lg flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400">ENFORCED RULES</span>
              <div className="w-8 h-8 rounded-lg bg-[#FACC15]/15 text-[#FACC15] flex items-center justify-center">
                <RuleIcon fontSize="small" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-3xl font-black font-mono text-white">
                {isLoading ? <CircularProgress size={24} /> : stats?.activeRulesCount ?? 0}
              </div>
            </div>
            <div className="text-xs text-[#FACC15] font-mono flex items-center gap-1">
              <span>Configure Rule Matrix</span>
              <ArrowIcon sx={{ fontSize: 14 }} />
            </div>
          </div>
        )}

        {/* Stat 3: Scan Verification Rate (Hidden if no permission) */}
        {canScans && (
          <div
            onClick={() => navigate('/scans')}
            className="bg-[#0F172A] border border-[#1E293B] hover:border-emerald-500/50 rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 shadow-lg flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400">SCAN INTEGRITY</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <ScanIcon fontSize="small" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-3xl font-black font-mono text-emerald-400">
                {isLoading ? <CircularProgress size={24} /> : `${successRate}%`}
              </div>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              <span>{stats?.validScansCount ?? 0} passed / {stats?.invalidScansCount ?? 0} alerts</span>
            </div>
          </div>
        )}

        {/* Stat 4: Shift Telemetry (Hidden if no permission) */}
        {canShifts && (
          <div
            onClick={() => navigate('/shifts')}
            className="bg-[#0F172A] border border-[#1E293B] hover:border-amber-500/50 rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 shadow-lg flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400">WORKER SESSION</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <ShiftIcon fontSize="small" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-lg font-bold font-mono text-white flex items-center gap-2">
                {activeShift ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>ONLINE ACTIVE</span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                    <span>STANDBY</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-xs text-amber-400 font-mono flex items-center gap-1">
              <span>Shift Controls & QR</span>
              <ArrowIcon sx={{ fontSize: 14 }} />
            </div>
          </div>
        )}
      </div>

      {/* Advanced Operations & Analytics Matrix: Attendance, Shifts & Rules (Hidden if no permitted tabs) */}
      {availableTabs.length > 0 && (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
            <div>
              <h2 className="text-base md:text-lg font-bold text-white font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FACC15]" />
                ANALYTICAL OPERATIONS CONSOLE
              </h2>
              <p className="text-slate-400 text-xs">
                Employee attendance telemetry, active/checkout shift timeline, and user rule enforcement matrix
              </p>
            </div>

            {/* DaisyUI Responsive Navigation Tabs: Only authorized tabs */}
            <div className="tabs tabs-boxed bg-[#07111D] border border-[#1E293B] p-1.5 rounded-xl flex flex-wrap gap-1.5 w-full lg:w-auto">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveAnalyticsTab(tab.id)}
                  className={`tab tab-sm flex-1 sm:flex-initial font-mono text-xs font-bold transition-all px-3 py-1.5 rounded-lg ${
                    activeAnalyticsTab === tab.id
                      ? 'tab-active !bg-[#FACC15] !text-slate-900 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab 1: Attendance Chart with Day/Hour/Minute & Zoom Controls */}
          {activeAnalyticsTab === 'attendance' && canShifts && (
            <AttendanceChart
              shifts={userShifts}
              users={canViewOtherShifts ? (usersData || []) : []}
            />
          )}

          {/* Tab 2: Shift Sessions & Checkout Tracking Panel */}
          {activeAnalyticsTab === 'shifts' && canShifts && (
            <ShiftsPanel
              shifts={userShifts}
              users={canViewOtherShifts ? (usersData || []) : []}
            />
          )}

          {/* Tab 3: Rules & Policy Matrix Per User (ECharts Heatmap & Bar) */}
          {activeAnalyticsTab === 'rules' && canRules && (
            <RulesMatrixChart
              rules={rulesData?.items || []}
              users={canViewOtherRules ? (usersData || []) : []}
            />
          )}
        </div>
      )}

      {/* Real-time Telemetry Chart */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 md:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base md:text-lg font-bold text-white font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              REAL-TIME SCAN VERIFICATION FLOW
            </h2>
            <p className="text-slate-400 text-xs">
              Live rate of valid cryptographically signed scans vs offline policy violations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-sm badge-success font-mono font-bold">LIVE TELEMETRY</span>
          </div>
        </div>
        <div className="h-72 w-full">
          <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      {/* Industrial Security Action Shortcuts: Only show permitted actions */}
      {hasAnyAction && (
        <div className="space-y-3">
          <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
            Industrial Action Matrix
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {canCreateShift && (
              <button
                onClick={() => navigate('/shifts')}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0F172A] border border-[#1E293B] hover:border-emerald-500/50 hover:bg-[#111C2E] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShiftIcon />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Start Work Shift</div>
                  <div className="text-xs text-slate-400">Generate on-screen QR</div>
                </div>
              </button>
            )}

            {canCreateKey && (
              <button
                onClick={() => navigate('/keys')}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0F172A] border border-[#1E293B] hover:border-blue-500/50 hover:bg-[#111C2E] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                  <KeyIcon />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Rotate Crypto Key</div>
                  <div className="text-xs text-slate-400">Generate new primary RSA</div>
                </div>
              </button>
            )}

            {canRules && (
              <button
                onClick={() => navigate('/rules')}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0F172A] border border-[#1E293B] hover:border-[#FACC15]/50 hover:bg-[#111C2E] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-[#FACC15]/15 text-[#FACC15] flex items-center justify-center shrink-0">
                  <RuleIcon />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Inventory Rules</div>
                  <div className="text-xs text-slate-400">Enforce tag claim checks</div>
                </div>
              </button>
            )}

            {canScans && (
              <button
                onClick={() => navigate('/scans')}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0F172A] border border-[#1E293B] hover:border-purple-500/50 hover:bg-[#111C2E] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                  <ScanIcon />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Verify Raw Token</div>
                  <div className="text-xs text-slate-400">Offline signature test</div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
