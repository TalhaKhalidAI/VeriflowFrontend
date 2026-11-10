import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,

  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Paper,
  Stack,
  Switch,
  Alert,
  MenuItem,
} from '@mui/material';
import {
  AddRounded as AddIcon,
  EditRounded as EditIcon,
  DeleteRounded as DeleteIcon,
  PlayArrowRounded as TestIcon,
  VerifiedUserRounded as PolicyIcon,
} from '@mui/icons-material';
import {
  useRulesQuery,
  useCreateRuleMutation,
  useUpdateRuleMutation,
  useToggleRuleStatusMutation,
  useDeleteRuleMutation,
  useEvaluateClaimsMutation,
  useApplicableRulesQuery,
} from './query';
import { useKeysQuery } from '../Keys/query';
import { useAdminUsersQuery } from '../Admin/query';
import type { InventoryRule } from './types';
import { Table, type TableColumn, type TableAction } from '../../components/Table';
import { ToastMsgs } from '../../api/toastUtils';
import { useAuthStore } from '../../store/authStore';

export function RulesPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.user_role?.toLowerCase() === 'admin';
  const canCreateRule = isAdmin || Boolean(user?.permissions?.['inventory_rules.create']);
  const canUpdateRule = isAdmin || Boolean(user?.permissions?.['inventory_rules.update']);
  const canDeleteRule = isAdmin || Boolean(user?.permissions?.['inventory_rules.delete']);
  const canViewRule = isAdmin || Boolean(user?.permissions?.['inventory_rules.view']) || canCreateRule || canUpdateRule || canDeleteRule;

  const { data: keysData } = useKeysQuery();
  const keys = keysData?.items || [];
  const currentUserId = Number(user?.id);
  const { data: usersData = [] } = useAdminUsersQuery({ show_permissions: false, enabled: isAdmin });

  const userOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; email: string; role: string }>();
    if (currentUserId) {
      map.set(currentUserId, {
        id: currentUserId,
        name: user?.name || user?.email?.split('@')[0] || `User #${currentUserId}`,
        email: user?.email || '',
        role: user?.role || user?.user_role || 'user',
      });
    }
    (usersData || []).forEach((u) => {
      if (!u?.id) return;
      map.set(Number(u.id), {
        id: Number(u.id),
        name: u.name || u.email?.split('@')[0] || `User #${u.id}`,
        email: u.email || '',
        role: u.role || u.user_role || 'user',
      });
    });
    return Array.from(map.values());
  }, [usersData, currentUserId, user]);

  const userMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string; email: string; role: string }>();
    userOptions.forEach((u) => m.set(u.id, u));
    return m;
  }, [userOptions]);

  const keyMap = useMemo(() => {
    const m = new Map<string, (typeof keys)[number]>();
    keys.forEach((k) => m.set(k.id, k));
    return m;
  }, [keys]);

  const getUserLabel = (uid?: number | null) => {
    if (uid == null) return 'System / Global';
    const info = userMap.get(Number(uid));
    return info ? `${info.name} (#${info.id})` : `User #${uid}`;
  };

  const isKeyOwnedOrShared = (k: (typeof keys)[number], uid?: string | number | null) => {
    if (!uid) return true;
    const numUid = Number(uid);
    if (!numUid) return true;
    if (Number(k.created_by) === numUid) return true;
    if (Array.isArray((k as any).shared_with) && (k as any).shared_with.some((su: any) => Number(su) === numUid || Number(su?.user_id) === numUid)) {
      return true;
    }
    return false;
  };

  const [applicableModalOpen, setApplicableModalOpen] = useState(false);
  const [applicableUserId, setApplicableUserId] = useState('');
  const [applicableKeyId, setApplicableKeyId] = useState('');
  const { data: applicableRules = [], isLoading: isLoadingApplicable } = useApplicableRulesQuery(
    applicableKeyId || undefined
  );

  const { data: rulesData, isLoading } = useRulesQuery();
  const createRuleMutation = useCreateRuleMutation();
  const updateRuleMutation = useUpdateRuleMutation();
  const toggleRuleMutation = useToggleRuleStatusMutation();
  const deleteRuleMutation = useDeleteRuleMutation();
  const evaluateMutation = useEvaluateClaimsMutation();

  // Dialog States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<InventoryRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<InventoryRule | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  // Form State
  const [selectedRuleUserId, setSelectedRuleUserId] = useState<string>('');
  const [form, setForm] = useState({
    rule_name: '',
    matching_claim_key: 'warehouse_id',
    expected_value: 'WH-CENTRAL-01',
    key_id: '',
    is_active: true,
  });

  // Test Claims State
  const [testClaimsJson, setTestClaimsJson] = useState(
    JSON.stringify({ warehouse_id: 'WH-CENTRAL-01', sku: 'SKU-88', status: 'verified' }, null, 2)
  );
  const [testKeyId, setTestKeyId] = useState<string>('');

  const handleOpenCreate = () => {
    setEditingRule(null);
    const defaultUid = isAdmin ? '' : String(currentUserId || '');
    const defaultKey = !isAdmin
      ? keys.find((k) => isKeyOwnedOrShared(k, currentUserId))?.id || ''
      : '';
    setSelectedRuleUserId(defaultUid);
    setForm({
      rule_name: '',
      matching_claim_key: 'warehouse_id',
      expected_value: 'WH-CENTRAL-01',
      key_id: defaultKey,
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (rule: InventoryRule) => {
    setEditingRule(rule);
    setSelectedRuleUserId(rule.user_id != null ? String(rule.user_id) : '');
    setForm({
      rule_name: rule.rule_name,
      matching_claim_key: rule.matching_claim_key,
      expected_value: rule.expected_value,
      key_id: rule.key_id || '',
      is_active: rule.is_active,
    });
    setModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!form.rule_name.trim() || !form.matching_claim_key.trim() || !form.expected_value.trim()) {
      ToastMsgs.error('All rule fields are required');
      return;
    }

    const payload = {
      ...form,
      key_id: form.key_id.trim() ? form.key_id.trim() : null,
      user_id: selectedRuleUserId ? Number(selectedRuleUserId) : null,
    };

    if (editingRule) {
      await updateRuleMutation.mutateAsync({
        ruleId: editingRule.id,
        payload,
      });
    } else {
      await createRuleMutation.mutateAsync(payload);
    }
    setModalOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!ruleToDelete) return;
    await deleteRuleMutation.mutateAsync(ruleToDelete.id);
    setDeleteDialogOpen(false);
    setRuleToDelete(null);
  };

  const handleRunEvaluation = async () => {
    try {
      const parsedClaims = JSON.parse(testClaimsJson);
      await evaluateMutation.mutateAsync({
        claims: parsedClaims,
        key_id: testKeyId || undefined,
      });
    } catch {
      ToastMsgs.error('Invalid JSON payload in claims test');
    }
  };

  const rules = canViewRule ? (rulesData?.items || []) : [];

  const mainRuleColumns: TableColumn<InventoryRule>[] = [
    {
      key: 'is_active',
      label: 'Enforcement',
      render: (_, r) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Switch
            size="small"
            checked={r.is_active}
            disabled={!canUpdateRule}
            onChange={(e) =>
              toggleRuleMutation.mutate({ ruleId: r.id, isActive: e.target.checked })
            }
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: '#10B981' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                bgcolor: '#10B981',
              },
            }}
          />
          <Chip
            size="small"
            label={r.is_active ? 'ACTIVE' : 'DISABLED'}
            sx={{
              fontWeight: 700,
              fontSize: '0.65rem',
              bgcolor: r.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
              color: r.is_active ? '#34D399' : '#94A3B8',
            }}
          />
        </Stack>
      ),
    },
    {
      key: 'rule_name',
      label: 'Rule Name',
      render: (_, r) => (
        <Box>
          <Typography variant="body2" fontWeight={700} sx={{ color: '#F8FAFC' }}>
            {r.rule_name}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            ID: {String(r.id || '').slice(0, 8)}...
          </Typography>
        </Box>
      ),
    },
    {
      key: 'matching_claim_key',
      label: 'Target Claim Key',
      render: (_, r) => (
        <Chip
          size="small"
          label={r.matching_claim_key}
          sx={{
            fontFamily: 'monospace',
            bgcolor: 'rgba(59, 130, 246, 0.15)',
            color: '#60A5FA',
            fontWeight: 600,
          }}
        />
      ),
    },
    {
      key: 'expected_value',
      label: 'Expected Value',
      render: (_, r) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#FACC15' }}>
          == "{r.expected_value}"
        </Typography>
      ),
    },
    {
      key: 'key_id',
      label: 'Target Cryptographic Key',
      render: (_, r) => {
        const boundKey = r.key_id ? keyMap.get(r.key_id) : undefined;
        return (
          <Stack spacing={0.5} alignItems="flex-start">
            <Chip
              size="small"
              label={
                boundKey
                  ? `🔑 ${boundKey.name} (${boundKey.kid})`
                  : r.key_id
                  ? `Key: ${String(r.key_id).slice(0, 8)}...`
                  : '🌐 GLOBAL (All Keys)'
              }
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                bgcolor: r.key_id ? 'rgba(147, 51, 234, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: r.key_id ? '#C084FC' : '#34D399',
                border: `1px solid ${r.key_id ? 'rgba(147, 51, 234, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              }}
            />
            {boundKey && (
              <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.7rem' }}>
                Key Owner: {getUserLabel(boundKey.created_by)}
              </Typography>
            )}
            {r.user_id != null && (
              <Typography variant="caption" sx={{ color: '#38BDF8', fontSize: '0.72rem', fontWeight: 600 }}>
                👤 Assigned Worker: {getUserLabel(r.user_id)}
              </Typography>
            )}
          </Stack>
        );
      },
    },
  ];

  const mainRuleActions: TableAction<InventoryRule>[] = [
    ...(canUpdateRule ? [{
      icon: <EditIcon fontSize="small" />,
      title: 'Edit Rule',
      variant: 'primary' as const,
      onClick: (r: InventoryRule) => handleOpenEdit(r),
    }] : []),
    ...(canDeleteRule ? [{
      icon: <DeleteIcon fontSize="small" />,
      title: 'Delete Rule',
      variant: 'error' as const,
      onClick: (r: InventoryRule) => {
        setRuleToDelete(r);
        setDeleteDialogOpen(true);
      },
    }] : []),
  ];

  const applicableColumns: TableColumn<InventoryRule>[] = [
    {
      key: 'rule_name',
      label: 'Policy Name',
      render: (_, ar) => (
        <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600 }}>
          {ar.rule_name}
        </Typography>
      ),
    },
    {
      key: 'matching_claim_key',
      label: 'Claim Key',
      render: (_, ar) => (
        <Chip
          size="small"
          label={ar.matching_claim_key}
          sx={{ fontFamily: 'monospace', bgcolor: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA' }}
        />
      ),
    },
    {
      key: 'expected_value',
      label: 'Expected Value',
      render: (_, ar) => (
        <Typography variant="body2" sx={{ color: '#FACC15', fontFamily: 'monospace' }}>
          == "{ar.expected_value}"
        </Typography>
      ),
    },
    {
      key: 'key_id',
      label: 'Applicable Scope',
      render: (_, ar) => (
        <Chip
          size="small"
          label={ar?.key_id ? `Key: ${String(ar.key_id).slice(0, 8)}...` : 'GLOBAL'}
          sx={{
            fontSize: 10,
            bgcolor: ar.key_id ? 'rgba(147, 51, 234, 0.15)' : 'rgba(255, 255, 255, 0.06)',
            color: ar.key_id ? '#C084FC' : '#CBD5E1',
          }}
        />
      ),
    },
  ];

  return (
    <Box sx={{ width: '100%', minWidth: 0, maxWidth: 1400, mx: 'auto', overflowX: 'hidden' }}>
      {/* Top Banner */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            fontWeight={800}
            sx={{ color: '#F8FAFC', letterSpacing: -0.5, fontSize: { xs: '1.3rem', sm: '1.5rem' } }}
          >
            Inventory Rules & Verification Policies
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
            Configure matching rules for JWT claims embedded in QR product tags and shift authorizations.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PolicyIcon />}
            onClick={() => setApplicableModalOpen(true)}
            sx={{
              borderColor: 'rgba(56, 189, 248, 0.4)',
              color: '#38BDF8',
              '&:hover': { borderColor: '#38BDF8', bgcolor: 'rgba(56, 189, 248, 0.1)' },
            }}
          >
            Applicable Verification Rules
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<TestIcon />}
            onClick={() => setTestDialogOpen(true)}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.15)',
              color: '#F8FAFC',
              '&:hover': { borderColor: '#3B82F6', bgcolor: 'rgba(59, 130, 246, 0.1)' },
            }}
          >
            Evaluate Claims Matrix
          </Button>

          {canCreateRule && (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
              sx={{ bgcolor: '#2563EB', '&:hover': { bgcolor: '#1D4ED8' } }}
            >
              Add Verification Rule
            </Button>
          )}
        </Stack>
      </Box>

      {!canViewRule && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You do not have permission to view inventory rules (requires 'inventory_rules.view' permission).
        </Alert>
      )}

      {/* Rules Table */}
      <Table<InventoryRule>
        columns={mainRuleColumns}
        data={rules}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage={canViewRule ? "No inventory validation rules found." : "No verification rules accessible (inventory_rules.view disabled)."}
        actions={mainRuleActions}
        showSearch={true}
        searchPlaceholder="Search rules by name, claim key, or value..."
        showPagination={true}
        itemsPerPage={10}
      />

      {/* Modal: Create or Edit Rule */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#0F172A', color: '#F8FAFC', border: '1px solid rgba(255, 255, 255, 0.1)' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingRule ? 'Edit Verification Policy' : 'Create Verification Policy'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
            Enforces policy checks when a mobile scanner inspects product tags or worker shift credentials.
          </Typography>

          <TextField
            fullWidth
            label="Rule Name"
            placeholder="e.g. Warehouse 101 Access Policy"
            value={form.rule_name}
            onChange={(e) => setForm({ ...form, rule_name: e.target.value })}
            sx={{ mb: 2 }}
          />

          <TextField
            select
            fullWidth
            size="small"
            label="Assigned Worker / User (Optional)"
            value={selectedRuleUserId}
            onChange={(e) => {
              const uid = e.target.value;
              setSelectedRuleUserId(uid);
              if (uid && !form.key_id) {
                const userKeys = keys.filter((k) => isKeyOwnedOrShared(k, uid));
                const activeKey = userKeys.find((k) => k.status === 'active') || userKeys[0];
                if (activeKey) {
                  setForm((prev) => ({ ...prev, key_id: activeKey.id }));
                }
              }
            }}
            disabled={!isAdmin && userOptions.length <= 1}
            helperText="Assign this rule to a specific worker / user (persisted in database with this rule)"
            sx={{ mb: 2 }}
          >
            {isAdmin && (
              <MenuItem value="">
                <em>🌐 All Users (Show All Available Keys)</em>
              </MenuItem>
            )}
            {(isAdmin ? userOptions : userOptions.filter((u) => u.id === currentUserId)).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                👤 {u.name} {u.email ? `(${u.email})` : ''} — ID #{u.id} {u.id === currentUserId ? '• (You)' : `• ${u.role.toUpperCase()}`}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            fullWidth
            label="Target Cryptographic Key"
            value={form.key_id}
            onChange={(e) => {
              const kidVal = e.target.value;
              setForm({ ...form, key_id: kidVal });
            }}
            helperText={
              isAdmin
                ? "Select a specific key to bind this policy, or choose Global to enforce across all tokens."
                : "Select the cryptographic key that this policy applies to."
            }
            sx={{ mb: 2 }}
          >
            {isAdmin && (
              <MenuItem value="">
                <em>🌐 Global Verification Policy (All Keys)</em>
              </MenuItem>
            )}
            {keys
              .filter((k) => !selectedRuleUserId || isKeyOwnedOrShared(k, selectedRuleUserId))
              .map((k) => {
                const isShared = selectedRuleUserId && Number(k.created_by) !== Number(selectedRuleUserId);
                return (
                  <MenuItem key={k.id} value={k.id}>
                    🔑 {k.name} (kid: {k.kid}) — {isShared ? `🤝 Shared Key (Owner: ${getUserLabel(k.created_by)})` : `👤 Owner: ${getUserLabel(k.created_by)}`} ({k.status ? k.status.toUpperCase() : "ACTIVE"})
                  </MenuItem>
                );
              })}
          </TextField>

          <TextField
            fullWidth
            label="Matching Claim Key"
            placeholder="e.g. warehouse_id, status, facility"
            value={form.matching_claim_key}
            onChange={(e) => setForm({ ...form, matching_claim_key: e.target.value })}
            helperText="The JWT attribute name extracted from the scanned QR code"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Expected Exact Match Value"
            placeholder="e.g. WH-CENTRAL-01"
            value={form.expected_value}
            onChange={(e) => setForm({ ...form, expected_value: e.target.value })}
            sx={{ mb: 2 }}
          />

          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <Typography variant="body2">Rule is immediately active</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRule}
            disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
            sx={{ bgcolor: '#2563EB' }}
          >
            {createRuleMutation.isPending || updateRuleMutation.isPending ? (
              <CircularProgress size={20} />
            ) : editingRule ? (
              'Save Changes'
            ) : (
              'Create Policy'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Applicable Rules for Verification (GET /rules/applicable) */}
      <Dialog
        open={applicableModalOpen}
        onClose={() => setApplicableModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#0B132B', color: '#F8FAFC', border: '1px solid #1E293B', borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <PolicyIcon /> Active Applicable Verification Policies
        </DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#94A3B8' }}>
            Inspect active policies that apply to a token verification context (Global + Key-Specific). The scan verification engine enforces these exact rules when validating claims.
          </Typography>

          <TextField
            select
            fullWidth
            label="Select User (Filter Keys by User)"
            value={applicableUserId}
            onChange={(e) => {
              const uid = e.target.value;
              setApplicableUserId(uid);
              if (!uid) {
                setApplicableKeyId('');
              } else {
                const userKey = keys.find((k) => isKeyOwnedOrShared(k, uid));
                setApplicableKeyId(userKey ? userKey.id : '');
              }
            }}
            size="small"
            helperText="Select a user by name to filter applicable verification keys for that user"
          >
            <MenuItem value="">
              <em>👥 All Users / Global</em>
            </MenuItem>
            {userOptions.map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                👤 {u.name} {u.email ? `(${u.email})` : ''} — ID #{u.id}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            fullWidth
            label="Verification Signing Key Context (key_id)"
            value={applicableKeyId}
            onChange={(e) => setApplicableKeyId(e.target.value)}
            size="small"
            helperText="Filter applicable rules by signing key. If none selected, returns universal global rules."
          >
            <MenuItem value="">
              <em>All / Global Context Only (No specific key)</em>
            </MenuItem>
            {keys
              .filter((k) => !applicableUserId || isKeyOwnedOrShared(k, applicableUserId))
              .map((k) => (
                <MenuItem key={k.id} value={k.id}>
                  🔑 {k.name} (kid: {k.kid}) — 👤 {getUserLabel(k.created_by)} ({k.status ? k.status.toUpperCase() : "ACTIVE"})
                </MenuItem>
              ))}
          </TextField>

          {isLoadingApplicable ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={28} sx={{ color: '#38BDF8' }} />
            </Box>
          ) : applicableRules.length === 0 ? (
            <Paper sx={{ p: 3, bgcolor: '#07111D', border: '1px dashed #334155', textAlign: 'center', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                No active applicable rules found for this verification context.
              </Typography>
            </Paper>
          ) : (
            <Table<InventoryRule>
              columns={applicableColumns}
              data={applicableRules}
              rowKey="id"
              isLoading={isLoadingApplicable}
              emptyMessage="No active applicable rules found for this verification context."
              showSearch={false}
              showPagination={true}
              itemsPerPage={5}
              size="xs"
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setApplicableModalOpen(false)} sx={{ color: '#94A3B8' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Delete Confirmation */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        PaperProps={{
          sx: { bgcolor: '#0F172A', color: '#F8FAFC', border: '1px solid rgba(255, 255, 255, 0.1)' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#EF4444' }}>Delete Rule?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#94A3B8' }}>
            Are you sure you want to permanently remove <strong>{ruleToDelete?.rule_name}</strong>? Scanners will no longer enforce this requirement.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: '#94A3B8' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleteRuleMutation.isPending}
          >
            {deleteRuleMutation.isPending ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Evaluate Claims Simulator */}
      <Dialog
        open={testDialogOpen}
        onClose={() => setTestDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#0F172A', color: '#F8FAFC', border: '1px solid rgba(255, 255, 255, 0.1)' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Evaluate Claim Set Simulator</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#94A3B8', mb: 2 }}>
            Simulate offline and online tag verification by passing raw decoded claims into the rule evaluator.
          </Typography>

          <TextField
            select
            fullWidth
            size="small"
            label="Target Verification Key Context"
            value={testKeyId}
            onChange={(e) => setTestKeyId(e.target.value)}
            helperText="Select which key's rules to evaluate against (or Global for global-only rules)"
            sx={{ mb: 2 }}
          >
            <MenuItem value="">
              <em>🌐 Global Policy Rules Only (key_id = null)</em>
            </MenuItem>
            {keys.map((k) => (
              <MenuItem key={k.id} value={k.id}>
                🔑 {k.name} (kid: {k.kid}) — Owner: {getUserLabel(k.created_by)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            multiline
            rows={5}
            label="Claims JSON Payload"
            value={testClaimsJson}
            onChange={(e) => setTestClaimsJson(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem', color: '#38BDF8' },
            }}
          />

          <Button
            variant="contained"
            onClick={handleRunEvaluation}
            disabled={evaluateMutation.isPending}
            sx={{ bgcolor: '#3B82F6', mb: 3 }}
          >
            {evaluateMutation.isPending ? <CircularProgress size={20} /> : 'Run Evaluation'}
          </Button>

          {evaluateMutation.data && (() => {
            const data = evaluateMutation.data;
            const isValid = data.is_valid ?? (data.status === 'passed');
            const totalEvaluated = data.evaluated_rules_count ?? data.total_rules_evaluated ?? 0;
            const violations = data.violations || [];
            const failedCount = violations.length;
            const passedCount = Math.max(0, totalEvaluated - failedCount);

            return (
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: '#07111D',
                  border: `1px solid ${
                    isValid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'
                  }`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isValid ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                    <Typography
                      variant="subtitle1"
                      fontWeight={800}
                      sx={{
                        color: isValid ? '#34D399' : '#F87171',
                        fontFamily: 'monospace',
                        letterSpacing: '0.05em',
                      }}
                    >
                      EVALUATION RESULT: {isValid ? 'PASSED (VALID)' : 'VIOLATIONS DETECTED'}
                    </Typography>
                  </div>
                  <span
                    className={`badge font-mono font-bold text-xs ${
                      isValid ? 'badge-success text-slate-900' : 'badge-error text-white'
                    }`}
                  >
                    {isValid ? 'VERIFIED' : 'POLICY REJECTED'}
                  </span>
                </div>

                <Typography variant="body2" sx={{ color: '#94A3B8', fontFamily: 'monospace' }}>
                  Evaluated: {totalEvaluated} rules | Passed: {passedCount} | Violations: {failedCount}
                </Typography>

                {violations.length > 0 && (
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    {violations.map((v, idx) => (
                      <Alert
                        key={idx}
                        severity="error"
                        sx={{ bgcolor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                      >
                        <strong>{v.rule_name || `Rule #${v.rule_id}`}</strong>:{' '}
                        {v.reason || (
                          <>
                            Expected <code>{v.expected_value}</code> for <code>{v.claim_key}</code>, but got <code>{JSON.stringify(v.actual_value)}</code>
                          </>
                        )}
                      </Alert>
                    ))}
                  </Stack>
                )}
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setTestDialogOpen(false)} sx={{ color: '#94A3B8' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RulesPage;
