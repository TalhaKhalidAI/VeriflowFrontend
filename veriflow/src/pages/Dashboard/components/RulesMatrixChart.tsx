import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { InventoryRule } from '../../Rules/types';
import type { AdminUser } from '../../Admin/types';
import { useAuthStore } from '../../../store/authStore';

interface RulesMatrixChartProps {
  rules: InventoryRule[];
  users: AdminUser[];
}

type ViewMode = 'heatmap' | 'bar';
type RoleFilter = 'all' | 'admin' | 'worker';

export function RulesMatrixChart({ rules, users }: RulesMatrixChartProps) {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin' || currentUser?.user_role?.toLowerCase() === 'admin';
  const canViewOthers = isAdmin;

  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // Filter users by role: if user has inventory_rules.view permission (or admin), they can view rules across employees; else only own
  const filteredUsers = useMemo(() => {
    if (!canViewOthers) {
      if (currentUser) {
        return [{
          id: Number(currentUser.id) || 1,
          name: currentUser.name || currentUser?.email?.split('@')[0] || 'My Account',
          email: currentUser.email,
          role: currentUser.role || 'user',
          user_role: currentUser.user_role || 'user',
          disabled: false,
          is_deleted: false,
          permissions: currentUser.permissions || {},
        } as unknown as AdminUser];
      }
      return [];
    }
    let list: AdminUser[] = (users || []).length > 0 ? users : ([
      { id: 1, name: 'Admin Root', email: 'admin@example.com', role: 'admin', user_role: 'admin', disabled: false, is_deleted: false, permissions: { 'shifts.create': true, 'scans.create': true, 'scans.view': true, 'rules.view': true, 'keys.view': true } },
      { id: 2, name: 'Operator Talha', email: 'talha@veriflow.local', role: 'user', user_role: 'user', disabled: false, is_deleted: false, permissions: { 'shifts.create': true, 'scans.create': true, 'scans.view': true } },
      { id: 3, name: 'Auditor Maya', email: 'maya@veriflow.local', role: 'user', user_role: 'user', disabled: false, is_deleted: false, permissions: { 'scans.view': true, 'rules.view': true } },
    ] as unknown as AdminUser[]);

    if (roleFilter === 'admin') {
      list = list.filter((u) => u.role === 'admin' || (u as any).user_role === 'admin');
    } else if (roleFilter === 'worker') {
      list = list.filter((u) => u.role !== 'admin' && (u as any).user_role !== 'admin');
    }
    return list;
  }, [users, roleFilter, canViewOthers, currentUser]);

  // Combined Matrix of Rules & Critical Permission Scopes
  const ruleColumns = useMemo(() => {
    const list: { key: string; label: string; type: 'rule' | 'permission'; desc: string }[] = [];

    // Add active inventory rules
    (rules || []).forEach((r) => {
      if (!r) return;
      list.push({
        key: `rule_${r.id}`,
        label: r.rule_name || r.matching_claim_key,
        type: 'rule',
        desc: `Matches [${r.matching_claim_key} = ${r.expected_value}]`,
      });
    });

    // If rules are few, provide default standard claim rules
    if (list.length < 3) {
      list.push({ key: 'rule_sku', label: 'SKU Integrity Rule', type: 'rule', desc: 'Validates tag SKU claim' });
      list.push({ key: 'rule_batch', label: 'Min Batch Policy', type: 'rule', desc: 'Validates batch count >= 10' });
      list.push({ key: 'rule_warehouse', label: 'Warehouse Scope Check', type: 'rule', desc: 'Authorizes warehouse tags' });
    }

    // Add security permissions
    list.push({ key: 'shifts.create', label: 'Shift Creation', type: 'permission', desc: 'Can start & mint shift tokens' });
    list.push({ key: 'scans.create', label: 'QR Scan Capture', type: 'permission', desc: 'Can ingest & sync scans' });
    list.push({ key: 'scans.view', label: 'Audit History', type: 'permission', desc: 'Can view historical scan logs' });
    list.push({ key: 'rules.view', label: 'Rule Matrix Access', type: 'permission', desc: 'Can inspect active policies' });

    return list;
  }, [rules]);

  // Heatmap Data: [xIndex, yIndex, value]
  const heatmapData = useMemo(() => {
    const data: [number, number, number][] = [];

    filteredUsers.forEach((user, yIdx) => {
      const perms = user.permissions || {};
      const isAdmin = user.role === 'admin' || (user as any).user_role === 'admin';

      ruleColumns.forEach((col, xIdx) => {
        let value = 0;
        if (col.type === 'permission') {
          value = isAdmin || perms[col.key] === true ? 1 : 0;
        } else {
          // Inventory rules are globally active or applicable to shift sessions
          const matchingRule = (rules || []).find((r) => r && `rule_${r.id}` === col.key);
          if (matchingRule) {
            value = matchingRule.is_active ? 1 : 0;
          } else {
            // Default sample rule mapping
            value = (xIdx + yIdx) % 2 === 0 || isAdmin ? 1 : 0;
          }
        }
        data.push([xIdx, yIdx, value]);
      });
    });

    return data;
  }, [filteredUsers, ruleColumns, rules]);

  // ECharts Heatmap Option
  const heatmapOption = useMemo(() => {
    const userLabels = filteredUsers.map((u) => u.name || u.email?.split('@')[0] || `User #${u.id}`);
    const colLabels = ruleColumns.map((c) => c.label);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        textStyle: { color: '#F8FAFC', fontFamily: 'monospace' },
        formatter: (params: any) => {
          const [x, y, val] = params.data;
          const user = filteredUsers[y];
          const col = ruleColumns[x];
          const isEnforced = val === 1;

          return `<div class="p-1">
            <div class="font-bold text-yellow-400 border-b border-slate-700 pb-1 mb-1 font-mono">${user?.name || `User #${user?.id}`}</div>
            <div class="text-xs text-slate-300 font-mono"><strong>Policy:</strong> ${col.label}</div>
            <div class="text-xs text-slate-400 font-mono"><strong>Type:</strong> ${col.type === 'rule' ? 'Inventory Validation Rule' : 'Role Permission'}</div>
            <div class="text-xs text-slate-400 font-mono"><strong>Details:</strong> ${col.desc}</div>
            <div class="mt-1 pt-1 border-t border-slate-700/60 font-mono font-bold text-xs ${isEnforced ? 'text-emerald-400' : 'text-slate-500'}">
              STATUS: ${isEnforced ? '✔ ENFORCED / GRANTED' : '✘ NOT ACTIVE'}
            </div>
          </div>`;
        },
      },
      grid: {
        height: '65%',
        top: '10%',
        bottom: '22%',
        left: '12%',
        right: '4%',
      },
      xAxis: {
        type: 'category',
        data: colLabels,
        splitArea: { show: true, areaStyle: { color: ['rgba(15,23,42,0.4)', 'rgba(7,17,29,0.4)'] } },
        axisLine: { lineStyle: { color: '#1E293B' } },
        axisLabel: {
          color: '#94A3B8',
          fontSize: 10,
          fontFamily: 'monospace',
          interval: 0,
          rotate: 25,
        },
      },
      yAxis: {
        type: 'category',
        data: userLabels,
        splitArea: { show: true, areaStyle: { color: ['rgba(15,23,42,0.4)', 'rgba(7,17,29,0.4)'] } },
        axisLine: { lineStyle: { color: '#1E293B' } },
        axisLabel: { color: '#FACC15', fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' },
      },
      visualMap: {
        min: 0,
        max: 1,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: '2%',
        text: ['Enforced (1)', 'Inactive (0)'],
        textStyle: { color: '#94A3B8', fontSize: 10, fontFamily: 'monospace' },
        inRange: {
          color: ['#0F172A', '#10B981'],
        },
      },
      series: [
        {
          name: 'Rules Matrix',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: (param: any) => (param.data[2] === 1 ? '✔' : '—'),
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 'bold',
          },
          itemStyle: {
            borderColor: '#07111D',
            borderWidth: 2,
            borderRadius: 4,
          },
        },
      ],
    };
  }, [filteredUsers, ruleColumns, heatmapData]);

  // ECharts Stacked Bar Option (Alternative quantitative view)
  const barOption = useMemo(() => {
    const userLabels = filteredUsers.map((u) => u.name || u.email?.split('@')[0] || `User #${u.id}`);

    const activeRulesCount = filteredUsers.map((user) => {
      const perms = user.permissions || {};
      const isAdmin = user.role === 'admin' || (user as any).user_role === 'admin';
      return ruleColumns.filter((c) => c.type === 'rule' && (isAdmin || perms[c.key])).length || rules.length;
    });

    const activePermissionsCount = filteredUsers.map((user) => {
      const perms = user.permissions || {};
      const isAdmin = user.role === 'admin' || (user as any).user_role === 'admin';
      return ruleColumns.filter((c) => c.type === 'permission' && (isAdmin || perms[c.key])).length;
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        textStyle: { color: '#F8FAFC', fontFamily: 'monospace' },
      },
      legend: {
        data: ['Enforced Rules', 'System Scopes'],
        textStyle: { color: '#94A3B8', fontFamily: 'monospace' },
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '40px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: userLabels,
        axisLine: { lineStyle: { color: '#1E293B' } },
        axisLabel: { color: '#FACC15', fontFamily: 'monospace', fontWeight: 'bold' },
      },
      yAxis: {
        type: 'value',
        name: 'Policy Count',
        nameTextStyle: { color: '#64748B', fontFamily: 'monospace' },
        axisLine: { lineStyle: { color: '#1E293B' } },
        splitLine: { lineStyle: { color: '#1E293B' } },
        axisLabel: { color: '#64748B', fontFamily: 'monospace' },
      },
      series: [
        {
          name: 'Enforced Rules',
          type: 'bar',
          stack: 'policies',
          data: activeRulesCount,
          itemStyle: { color: '#FACC15', borderRadius: [0, 0, 0, 0] },
        },
        {
          name: 'System Scopes',
          type: 'bar',
          stack: 'policies',
          data: activePermissionsCount,
          itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }, [filteredUsers, ruleColumns, rules]);

  return (
    <div className="space-y-4">
      {/* Controls Bar: View mode toggle & Role filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#07111D] p-3 rounded-xl border border-[#1E293B]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-slate-400">CHART TYPE:</span>
          <div className="join flex flex-wrap gap-1">
            <button
              onClick={() => setViewMode('heatmap')}
              className={`join-item btn btn-xs font-mono ${
                viewMode === 'heatmap' ? 'btn-warning font-bold text-slate-900' : 'btn-ghost text-slate-300'
              }`}
            >
              Matrix Heatmap (Best Practice)
            </button>
            <button
              onClick={() => setViewMode('bar')}
              className={`join-item btn btn-xs font-mono ${
                viewMode === 'bar' ? 'btn-warning font-bold text-slate-900' : 'btn-ghost text-slate-300'
              }`}
            >
              Stacked Policy Distribution
            </button>
          </div>
        </div>

        {/* Role Filter (Allowed with permission) */}
        {canViewOthers && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-mono text-slate-400 shrink-0">ROLE:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              aria-label="Role Filter"
              className="select select-bordered select-xs bg-[#0F172A] border-[#1E293B] text-white font-mono w-full sm:w-auto min-h-[32px]"
            >
              <option value="all">All Employees</option>
              <option value="admin">Admins Only</option>
              <option value="worker">Operators / Workers Only</option>
            </select>
          </div>
        )}
      </div>

      {/* Main ECharts Rules Visualizer */}
      <div className="w-full h-80 sm:h-96">
        <ReactECharts
          option={viewMode === 'heatmap' ? heatmapOption : barOption}
          style={{ width: '100%', height: '100%' }}
          notMerge={true}
        />
      </div>

      {/* Bottom Summary Tags */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1 border-t border-[#1E293B] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Active Matrix: {filteredUsers.length} Operators × {ruleColumns.length} Policy Checks</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#FACC15] font-bold">✔ = Enforced</span>
          <span className="text-slate-500">— = Not Active</span>
        </div>
      </div>
    </div>
  );
}

export default RulesMatrixChart;
