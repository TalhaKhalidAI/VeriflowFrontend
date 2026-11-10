import { useState, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ShiftRecord } from '../../Shifts/types';
import type { AdminUser } from '../../Admin/types';
import { useAuthStore } from '../../../store/authStore';

interface AttendanceChartProps {
  shifts: ShiftRecord[];
  users: AdminUser[];
}

type Granularity = 'day' | 'hour' | 'minute';
type RangePreset = '7d' | '14d' | '30d' | 'all';

// Palette of industrial employee accent colors
const EMPLOYEE_COLORS = [
  '#38BDF8', // Cyber Blue
  '#FACC15', // Caution Yellow
  '#10B981', // Emerald Pass
  '#C084FC', // Tech Purple
  '#F97316', // Hazard Amber
  '#EC4899', // Pink Laser
  '#14B8A6', // Teal
  '#6366F1', // Indigo
];

export function AttendanceChart({ shifts, users }: AttendanceChartProps) {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin' || currentUser?.user_role?.toLowerCase() === 'admin';
  const canViewAllShifts =
    isAdmin ||
    Boolean(currentUser?.permissions?.['shifts.view.any']) ||
    Boolean(currentUser?.permissions?.['shifts.view.all']) ||
    Boolean(currentUser?.permissions?.['shifts.view']);

  const chartRef = useRef<any>(null);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [rangePreset, setRangePreset] = useState<RangePreset>('7d');
  const [zoomRange, setZoomRange] = useState<[number, number]>([0, 100]);

  // Map user ID to display name
  const userMap = useMemo(() => {
    const map = new Map<number, { name: string; email: string; role: string }>();
    if (currentUser) {
      map.set(Number(currentUser.id) || 1, {
        name: currentUser.name || currentUser?.email?.split('@')[0] || 'My Account',
        email: currentUser.email,
        role: currentUser.role || 'worker',
      });
    }
    (users || []).forEach((u) => {
      if (!u) return;
      map.set(u.id, {
        name: u.name || u.email?.split('@')[0] || `User #${u.id}`,
        email: u.email,
        role: u.role || 'worker',
      });
    });
    (shifts || []).forEach((s) => {
      if (!s) return;
      if (!map.has(s.user_id) && (s.user_name || s.user_email)) {
        map.set(s.user_id, {
          name: s.user_name || s.user_email?.split('@')[0] || `User #${s.user_id}`,
          email: s.user_email || '',
          role: 'worker',
        });
      }
    });
    return map;
  }, [users, shifts, currentUser]);

  // Build employee list: Non-admin users strictly see only their own account.
  // Admins see only users who actually have shift records in the database.
  const employees = useMemo(() => {
    if (!canViewAllShifts) {
      const myId = Number(currentUser?.id) || 1;
      return [{
        id: myId,
        name: currentUser?.name || currentUser?.email?.split('@')[0] || 'My Account',
        color: '#38BDF8',
      }];
    }

    const ids = new Set<number>();
    shifts.forEach((s) => ids.add(s.user_id));
    if (ids.size === 0 && currentUser) {
      ids.add(Number(currentUser.id) || 1);
    }

    return Array.from(ids).map((id, index) => {
      const u = userMap.get(id);
      return {
        id,
        name: u?.name || `Worker #${id}`,
        color: EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length],
      };
    });
  }, [shifts, userMap, canViewAllShifts, currentUser]);

  // Aggregate attendance data based on selected granularity (Day / Hour / Minute)
  const chartData = useMemo(() => {
    const now = new Date();

    if (granularity === 'day') {
      const daysCount = rangePreset === '7d' ? 7 : rangePreset === '14d' ? 14 : rangePreset === '30d' ? 30 : 14;
      const categories: string[] = [];
      const dateKeys: string[] = [];

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        dateKeys.push(dateKey);
        categories.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }

      // Initialize series per employee
      const seriesMap = new Map<number, number[]>();
      (employees || []).forEach((emp) => {
        if (!emp) return;
        seriesMap.set(emp.id, new Array(categories.length).fill(0));
      });

      // Sum actual shift hours strictly from shifts in database
      (shifts || []).forEach((s) => {
      if (!s) return;
        if (!s.started_at) return;
        if (!canViewAllShifts && s.user_id !== Number(currentUser?.id)) return;
        const sDate = s.started_at ? String(s.started_at).split('T')[0] : '';
        const idx = dateKeys.indexOf(sDate);
        if (idx !== -1 && seriesMap.has(s.user_id)) {
          const start = new Date(s.started_at).getTime();
          const end = s.ended_at ? new Date(s.ended_at).getTime() : new Date().getTime();
          const hours = Math.max(0.1, (end - start) / 3600000);
          const arr = seriesMap.get(s.user_id)!;
          arr[idx] = parseFloat((arr[idx] + hours).toFixed(1));
        }
      });

      return {
        categories,
        series: employees.map((emp) => ({
          name: emp.name,
          type: 'bar',
          stack: 'attendance',
          emphasis: { focus: 'series' },
          itemStyle: { color: emp.color, borderRadius: [2, 2, 0, 0] },
          data: seriesMap.get(emp.id) || [],
        })),
        yAxisName: 'Hours Clocked (h)',
      };
    }

    if (granularity === 'hour') {
      // 24 Hour Day Breakdown (00:00 to 23:00)
      const categories: string[] = [];
      for (let h = 0; h < 24; h++) {
        categories.push(`${String(h).padStart(2, '0')}:00`);
      }

      const seriesMap = new Map<number, number[]>();
      (employees || []).forEach((emp) => {
        if (!emp) return;
        seriesMap.set(emp.id, new Array(24).fill(0));
      });

      // Populate actual shift distribution by active hours
      (shifts || []).forEach((s) => {
      if (!s) return;
        if (!s.started_at) return;
        if (!canViewAllShifts && s.user_id !== Number(currentUser?.id)) return;
        const start = new Date(s.started_at);
        const end = s.ended_at ? new Date(s.ended_at) : new Date();
        const startH = start.getHours();
        const durationHours = Math.max(1, Math.min(24, Math.ceil((end.getTime() - start.getTime()) / 3600000)));

        if (seriesMap.has(s.user_id)) {
          const arr = seriesMap.get(s.user_id)!;
          for (let i = 0; i < durationHours; i++) {
            const h = (startH + i) % 24;
            arr[h] = parseFloat((arr[h] + 1).toFixed(1));
          }
        }
      });

      return {
        categories,
        series: employees.map((emp) => ({
          name: emp.name,
          type: 'bar',
          stack: 'activeHours',
          emphasis: { focus: 'series' },
          itemStyle: { color: emp.color, borderRadius: [2, 2, 0, 0] },
          data: seriesMap.get(emp.id) || [],
        })),
        yAxisName: 'Active Workers On Duty',
      };
    }

    // granularity === 'minute' (Timeline intervals 08:00 - 18:00)
    const categories: string[] = [
      '08:00', '08:15', '08:30', '08:45',
      '09:00', '09:15', '09:30', '09:45',
      '10:00', '10:15', '10:30', '10:45',
      '11:00', '11:15', '11:30', '11:45',
      '12:00', '12:15', '12:30', '12:45',
      '13:00', '13:15', '13:30', '13:45',
      '14:00', '14:15', '14:30', '14:45',
      '15:00', '15:15', '15:30', '15:45',
      '16:00', '16:15', '16:30', '16:45',
      '17:00', '17:15', '17:30', '17:45',
      '18:00',
    ];

    const seriesMap = new Map<number, number[]>();
    (employees || []).forEach((emp) => {
        if (!emp) return;
      seriesMap.set(emp.id, new Array(categories.length).fill(0));
    });

    (shifts || []).forEach((s) => {
      if (!s) return;
      if (!s.started_at) return;
      if (!canViewAllShifts && s.user_id !== Number(currentUser?.id)) return;
      const start = new Date(s.started_at);
      const end = s.ended_at ? new Date(s.ended_at) : new Date();
      const sH = start.getHours() + start.getMinutes() / 60;
      const eH = end.getHours() + end.getMinutes() / 60;

      if (seriesMap.has(s.user_id)) {
        const arr = seriesMap.get(s.user_id)!;
        categories.forEach((cat, idx) => {
          const [hStr, mStr] = cat.split(':');
          const catH = parseInt(hStr, 10) + parseInt(mStr, 10) / 60;
          if (catH >= sH && catH <= eH) {
            arr[idx] = 15;
          }
        });
      }
    });

    return {
      categories,
      series: employees.map((emp) => ({
        name: emp.name,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: emp.color },
        itemStyle: { color: emp.color },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: emp.color + '40' },
              { offset: 1, color: emp.color + '00' },
            ],
          },
        },
        data: seriesMap.get(emp.id) || [],
      })),
      yAxisName: 'Minutes Active / Slot (min)',
    };
  }, [granularity, rangePreset, shifts, employees, canViewAllShifts, currentUser]);

  // ECharts Option
  const option = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        textStyle: { color: '#F8FAFC', fontFamily: 'monospace' },
        formatter: (params: any[]) => {
          if (!params || !params.length) return '';
          const header = `<div class="font-bold text-yellow-400 mb-1 border-b border-slate-700 pb-1">${params[0].name}</div>`;
          const rows = params
            .filter((p) => p.value > 0)
            .map(
              (p) =>
                `<div class="flex items-center justify-between gap-4 py-0.5">
                  <span class="flex items-center gap-1.5 text-xs text-slate-300">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${p.color}"></span>
                    ${p.seriesName}
                  </span>
                  <span class="font-mono font-bold text-xs text-white">${p.value} ${granularity === 'day' ? 'hrs' : granularity === 'minute' ? 'mins' : 'duty'}</span>
                </div>`
            )
            .join('');
          return header + (rows || '<div class="text-xs text-slate-500">No shift activity logged</div>');
        },
      },
      legend: {
        data: employees.map((e) => e.name),
        textStyle: { color: '#94A3B8', fontSize: 11, fontFamily: 'monospace' },
        top: 0,
        right: 10,
        type: 'scroll',
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '16%',
        top: '45px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: chartData.categories,
        axisLine: { lineStyle: { color: '#1E293B' } },
        axisLabel: { color: '#94A3B8', fontSize: 11, fontFamily: 'monospace' },
      },
      yAxis: {
        type: 'value',
        name: chartData.yAxisName,
        nameTextStyle: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' },
        axisLine: { lineStyle: { color: '#1E293B' } },
        splitLine: { lineStyle: { color: '#1E293B' } },
        axisLabel: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' },
      },
      dataZoom: [
        {
          type: 'slider',
          show: true,
          xAxisIndex: [0],
          start: zoomRange[0],
          end: zoomRange[1],
          bottom: 0,
          height: 24,
          backgroundColor: '#0F172A',
          borderColor: '#1E293B',
          fillerColor: 'rgba(250, 204, 21, 0.15)',
          handleStyle: {
            color: '#FACC15',
            borderColor: '#07111D',
            borderWidth: 2,
          },
          textStyle: { color: '#94A3B8', fontSize: 10, fontFamily: 'monospace' },
        },
        {
          type: 'inside',
          xAxisIndex: [0],
          start: zoomRange[0],
          end: zoomRange[1],
        },
      ],
      series: chartData.series,
    };
  }, [chartData, employees, granularity, zoomRange]);

  // Interactive Zoom Controls
  const handleZoomIn = () => {
    setZoomRange(([start, end]) => {
      const delta = (end - start) * 0.25;
      const nextStart = Math.min(start + delta / 2, 40);
      const nextEnd = Math.max(end - delta / 2, 60);
      return [nextStart, nextEnd];
    });
  };

  const handleZoomOut = () => {
    setZoomRange(([start, end]) => {
      const delta = (end - start) * 0.35;
      const nextStart = Math.max(0, start - delta / 2);
      const nextEnd = Math.min(100, end + delta / 2);
      return [nextStart, nextEnd];
    });
  };

  const handleResetZoom = () => {
    setZoomRange([0, 100]);
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar: Granularity, Range & Zoom Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#07111D] p-3 rounded-xl border border-[#1E293B]">
        {/* Left: Granularity Dropdown (Day / Hour / Minute) */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
            Resolution:
          </span>
          <div className="join flex flex-wrap gap-1">
            <button
              onClick={() => setGranularity('day')}
              className={`join-item btn btn-xs font-mono ${
                granularity === 'day' ? 'btn-warning font-bold text-slate-900' : 'btn-ghost text-slate-300'
              }`}
            >
              Day View
            </button>
            <button
              onClick={() => setGranularity('hour')}
              className={`join-item btn btn-xs font-mono ${
                granularity === 'hour' ? 'btn-warning font-bold text-slate-900' : 'btn-ghost text-slate-300'
              }`}
            >
              Hour View
            </button>
            <button
              onClick={() => setGranularity('minute')}
              className={`join-item btn btn-xs font-mono ${
                granularity === 'minute' ? 'btn-warning font-bold text-slate-900' : 'btn-ghost text-slate-300'
              }`}
            >
              Minute View
            </button>
          </div>

          {granularity === 'day' && (
            <select
              value={rangePreset}
              onChange={(e) => setRangePreset(e.target.value as RangePreset)}
              aria-label="Attendance Date Range Preset"
              className="select select-bordered select-xs bg-[#0F172A] border-[#1E293B] text-white font-mono w-full sm:w-auto min-h-[32px]"
            >
              <option value="7d">Last 7 Days</option>
              <option value="14d">Last 14 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          )}
        </div>

        {/* Right: Zoom In / Zoom Out / Reset Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-400">Zoom:</span>
          <div className="join">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="join-item btn btn-xs bg-[#0F172A] border-[#1E293B] hover:border-yellow-400 text-slate-200"
            >
              🔍 +
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="join-item btn btn-xs bg-[#0F172A] border-[#1E293B] hover:border-yellow-400 text-slate-200"
            >
              🔍 −
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset Zoom"
              className="join-item btn btn-xs bg-[#0F172A] border-[#1E293B] hover:border-yellow-400 text-slate-200"
            >
              ↺ Reset
            </button>
          </div>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            (Pinch / scroll to zoom inside chart)
          </span>
        </div>
      </div>

      {/* Main ECharts Attendance Visualizer */}
      <div className="w-full h-80 sm:h-96">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ width: '100%', height: '100%' }}
          notMerge={true}
        />
      </div>

      {/* Bottom Summary Tags */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1 border-t border-[#1E293B] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span>Interactive Zoom Active ({zoomRange[0]}% - {zoomRange[1]}%)</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{employees.length} Tracked {employees.length === 1 ? 'Operator' : 'Operators'}</span>
          <span className="text-emerald-400 font-bold">● Shift Logs Synchronized</span>
        </div>
      </div>
    </div>
  );
}

export default AttendanceChart;
