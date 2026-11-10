import { useState } from "react";
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
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  CheckCircleRounded as CheckIcon,
  CancelRounded as CancelIcon,
  VisibilityRounded as VisibilityIcon,
  VerifiedUserRounded as VerifyIcon,
  EditRounded as EditIcon,
  DeleteRounded as DeleteIcon,
} from "@mui/icons-material";
import {
  useScansQuery,
  useVerifyTokenDirectMutation,
  useUpdateScanMutation,
  useDeleteScanMutation,
} from "./query";
import { useAuthStore } from "../../store/authStore";
import type { ScanRecord } from "./types";
import { Table, type TableColumn, type TableAction } from "../../components/Table";
import { ToastMsgs } from "../../api/toastUtils";

export function ScansPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin =
    user?.role?.toLowerCase() === "admin" || user?.user_role?.toLowerCase() === "admin";
  const canViewAny = isAdmin || Boolean(user?.permissions?.["scans.view.any"]);
  const canViewOwn =
    canViewAny ||
    Boolean(user?.permissions?.["scans.view.own"]) ||
    Boolean(user?.permissions?.["scans.view"]);
  const canUpdate = isAdmin || Boolean(user?.permissions?.["scans.update"]);
  const canDelete = isAdmin || Boolean(user?.permissions?.["scans.delete"]);

  const { data: scansData, isLoading } = useScansQuery();
  const verifyTokenMutation = useVerifyTokenDirectMutation();
  const updateScanMutation = useUpdateScanMutation();
  const deleteScanMutation = useDeleteScanMutation();

  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);

  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [tokenToVerify, setTokenToVerify] = useState("");

  // Edit scan state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editScanId, setEditScanId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string>("valid");
  const [editReason, setEditReason] = useState<string>("");

  // Delete scan state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scanToDelete, setScanToDelete] = useState<ScanRecord | null>(null);

  const handleVerifySubmit = async () => {
    if (!tokenToVerify.trim()) {
      ToastMsgs.error("Please paste a JWT token");
      return;
    }
    await verifyTokenMutation.mutateAsync(tokenToVerify.trim());
  };

  const handleEditOpen = (s: ScanRecord) => {
    setEditScanId(s.id);
    setEditStatus(s.status || "valid");
    setEditReason(s.reason || "");
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (editScanId === null) return;
    try {
      await updateScanMutation.mutateAsync({
        scanId: editScanId,
        status: editStatus,
        reason: editReason.trim() || undefined,
      });
      setEditModalOpen(false);
      setEditScanId(null);
    } catch {
      // toast handled in mutation
    }
  };

  const handleDeleteOpen = (s: ScanRecord) => {
    setScanToDelete(s);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!scanToDelete) return;
    try {
      await deleteScanMutation.mutateAsync(scanToDelete.id);
      setDeleteDialogOpen(false);
      setScanToDelete(null);
    } catch {
      // toast handled in mutation
    }
  };

  const scans = canViewOwn ? scansData?.items || [] : [];
  const validCount = scans.filter((s) => s.status === "valid").length;
  const invalidCount = scans.filter((s) => s.status !== "valid").length;

  const scanColumns: TableColumn<ScanRecord>[] = [
    {
      key: "status",
      label: "Verification",
      render: (_, s) => {
        const isValid = s.status === "valid";
        return (
          <Chip
            icon={isValid ? <CheckIcon /> : <CancelIcon />}
            size="small"
            label={String(s.status || "").toUpperCase()}
            sx={{
              fontWeight: 700,
              fontSize: "0.68rem",
              bgcolor: isValid ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: isValid ? "#34D399" : "#F87171",
              border: `1px solid ${isValid ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              "& .MuiChip-icon": {
                color: isValid ? "#34D399" : "#F87171",
              },
            }}
          />
        );
      },
    },
    {
      key: "id",
      label: "Scan ID",
      render: (_, s) => (
        <Typography variant="body2" fontWeight={700} sx={{ color: "#F8FAFC", fontFamily: "monospace" }}>
          #{s.id}
        </Typography>
      ),
    },
    {
      key: "sku",
      label: "Detected SKU / Payload",
      render: (_, s) => {
        const sku =
          s.jwt_scanned?.sku ||
          s.jwt_scanned?.product_id ||
          s.jwt_scanned?.batch_no ||
          "TAG-PAYLOAD";
        return (
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ color: "#E2E8F0" }}>
              {String(sku)}
            </Typography>
            {s.reason && (
              <Typography variant="caption" sx={{ color: "#F87171", display: "block" }}>
                Violation: {s.reason}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      key: "shift_id",
      label: "Shift Binding",
      render: (_, s) => (
        <Typography variant="caption" sx={{ color: "#60A5FA", fontFamily: "monospace" }}>
          {String(s.shift_id || "").slice(0, 12)}...
        </Typography>
      ),
    },
    {
      key: "scanned_at",
      label: "Timestamps",
      render: (_, s) => (
        <Box>
          <Typography variant="caption" sx={{ color: "#94A3B8", display: "block" }}>
            Captured: {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : "N/A"}
          </Typography>
          {s.synced_at && (
            <Typography variant="caption" sx={{ color: "#64748B", display: "block" }}>
              Synced: {new Date(s.synced_at).toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      ),
    },
  ];

  const scanActions: TableAction<ScanRecord>[] = [
    {
      icon: <VisibilityIcon fontSize="small" />,
      title: "Inspect Decoded Claims",
      variant: "primary",
      onClick: (s) => {
        setSelectedScan(s);
        setInspectModalOpen(true);
      },
    },
    ...(canUpdate
      ? [
          {
            icon: <EditIcon fontSize="small" />,
            title: "Edit / Annotate Scan",
            variant: "default" as const,
            onClick: (s: ScanRecord) => handleEditOpen(s),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            icon: <DeleteIcon fontSize="small" />,
            title: "Delete Scan Record",
            variant: "error" as const,
            onClick: (s: ScanRecord) => handleDeleteOpen(s),
          },
        ]
      : []),
  ];

  return (
    <Box sx={{ width: "100%", minWidth: 0, maxWidth: 1400, mx: "auto", overflowX: "hidden" }}>
      {/* Top Banner */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            fontWeight={800}
            sx={{ color: "#F8FAFC", letterSpacing: -0.5, fontSize: { xs: "1.3rem", sm: "1.5rem" } }}
          >
            Scan Audits & Telemetry
          </Typography>
          <Typography variant="body2" sx={{ color: "#94A3B8", mt: 0.5 }}>
            Real-time audit log of product scans collected online and synchronized from offline mobile scanners.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: "100%", md: "auto" } }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<VerifyIcon />}
            onClick={() => setVerifyModalOpen(true)}
            sx={{ bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" } }}
          >
            Verify JWT Signature
          </Button>
        </Stack>
      </Box>

      {/* Metrics Row */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Paper
          sx={{
            p: 2,
            flex: 1,
            bgcolor: "#0B132B",
            borderRadius: 2,
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <Typography variant="caption" sx={{ color: "#94A3B8", fontWeight: 600 }}>
            TOTAL INGESTED SCANS
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ color: "#F8FAFC", mt: 0.5 }}>
            {scans.length}
          </Typography>
        </Paper>

        <Paper
          sx={{
            p: 2,
            flex: 1,
            bgcolor: "#0B132B",
            borderRadius: 2,
            border: "1px solid rgba(16, 185, 129, 0.3)",
          }}
        >
          <Typography variant="caption" sx={{ color: "#34D399", fontWeight: 600 }}>
            VALID VERIFICATIONS
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ color: "#34D399", mt: 0.5 }}>
            {validCount}
          </Typography>
        </Paper>

        <Paper
          sx={{
            p: 2,
            flex: 1,
            bgcolor: "#0B132B",
            borderRadius: 2,
            border: "1px solid rgba(239, 68, 68, 0.3)",
          }}
        >
          <Typography variant="caption" sx={{ color: "#F87171", fontWeight: 600 }}>
            POLICY VIOLATIONS / INVALID
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ color: "#F87171", mt: 0.5 }}>
            {invalidCount}
          </Typography>
        </Paper>
      </Stack>

      {!canViewOwn && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You do not have permission to view scan history (requires scans.view.own or scans.view.any permission).
        </Alert>
      )}

      {/* Scans Table */}
      <Table<ScanRecord>
        columns={scanColumns}
        data={scans}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage={canViewOwn ? "No scans logged yet." : "No scans accessible (scans view permission disabled)."}
        actions={scanActions}
        showSearch={true}
        searchPlaceholder="Search scans by ID, SKU, or shift..."
        showPagination={true}
        itemsPerPage={10}
      />

      {/* Modal: Edit / Annotate Scan */}
      <Dialog
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "#0F172A", color: "#F8FAFC", border: "1px solid rgba(255, 255, 255, 0.1)" },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Edit / Annotate Scan #{editScanId}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#94A3B8", mb: 2 }}>
            Update the verification status or append audit notes to this scan record.
          </Typography>

          <FormControl fullWidth sx={{ mb: 2.5 }}>
            <InputLabel id="edit-scan-status-label" sx={{ color: "#94A3B8" }}>
              Verification Status
            </InputLabel>
            <Select
              labelId="edit-scan-status-label"
              value={editStatus}
              label="Verification Status"
              onChange={(e) => setEditStatus(e.target.value)}
              sx={{
                color: "#F8FAFC",
                ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255, 255, 255, 0.15)" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3B82F6" },
              }}
            >
              <MenuItem value="valid">Valid (Passed)</MenuItem>
              <MenuItem value="invalid">Invalid (Failed Rule)</MenuItem>
              <MenuItem value="warning">Warning (Review Required)</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Annotation / Audit Reason"
            placeholder="e.g. Manual override approved by supervisor..."
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            sx={{
              "& .MuiInputBase-input": { color: "#F8FAFC" },
              "& .MuiInputLabel-root": { color: "#94A3B8" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255, 255, 255, 0.15)" },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setEditModalOpen(false)} sx={{ color: "#94A3B8" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleEditSubmit}
            disabled={updateScanMutation.isPending}
            sx={{ bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" } }}
          >
            {updateScanMutation.isPending ? <CircularProgress size={20} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Confirm Delete Scan */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "#0F172A", color: "#F8FAFC", border: "1px solid rgba(239, 68, 68, 0.2)" },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#F87171" }}>Delete Scan #{scanToDelete?.id}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#CBD5E1", mb: 1 }}>
            Are you sure you want to permanently delete this scan record?
          </Typography>
          <Typography variant="caption" sx={{ color: "#94A3B8" }}>
            This action cannot be undone and removes the verification log from telemetry.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: "#94A3B8" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleteScanMutation.isPending}
            sx={{ bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" } }}
          >
            {deleteScanMutation.isPending ? <CircularProgress size={20} /> : "Delete Record"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Inspect Decoded Claims */}
      <Dialog
        open={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "#0F172A", color: "#F8FAFC", border: "1px solid rgba(255, 255, 255, 0.1)" },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Scan Record #{selectedScan?.id} Claims</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#94A3B8", mb: 2 }}>
            Attributes payload decoded from scanned item during shift:
          </Typography>

          <Paper
            sx={{
              p: 2,
              bgcolor: "#07111D",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 2,
              maxHeight: 400,
              overflowY: "auto",
            }}
          >
            <Typography
              component="pre"
              sx={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#38BDF8", m: 0 }}
            >
              {JSON.stringify(selectedScan?.jwt_scanned || {}, null, 2)}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setInspectModalOpen(false)} sx={{ color: "#94A3B8" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Verify JWT Signature */}
      <Dialog
        open={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: "#0F172A", color: "#F8FAFC", border: "1px solid rgba(255, 255, 255, 0.1)" },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Verify RS256 Token Signature</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#94A3B8", mb: 2 }}>
            Verifies signature using the database public key matching the token unverified <code>kid</code> header.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Raw JWT String (ey...)"
            placeholder="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
            value={tokenToVerify}
            onChange={(e) => setTokenToVerify(e.target.value)}
            sx={{
              mb: 2,
              "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: "0.85rem" },
            }}
          />

          <Button
            variant="contained"
            onClick={handleVerifySubmit}
            disabled={verifyTokenMutation.isPending}
            sx={{ bgcolor: "#2563EB", mb: 2 }}
          >
            {verifyTokenMutation.isPending ? <CircularProgress size={20} /> : "Verify with RSA Engine"}
          </Button>

          {verifyTokenMutation.data && (
            <Alert severity="success" sx={{ bgcolor: "rgba(16, 185, 129, 0.15)", color: "#34D399" }}>
              <strong>VALID RS256 SIGNATURE</strong>: Key ID:{" "}
              <code>{verifyTokenMutation.data.kid || verifyTokenMutation.data.key_id}</code>
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setVerifyModalOpen(false)} sx={{ color: "#94A3B8" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ScansPage;
