import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Chip,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  DashboardRounded as DashboardIcon,
  VpnKeyRounded as KeyIcon,
  FactCheckRounded as RulesIcon,
  AccessTimeFilledRounded as ShiftsIcon,
  QrCodeScannerRounded as ScansIcon,
  MenuRounded as MenuIcon,
  ChevronLeftRounded as ChevronLeftIcon,
  ChevronRightRounded as ChevronRightIcon,
  LogoutRounded as LogoutIcon,
  AdminPanelSettingsRounded as AdminIcon,
  LockResetRounded as Security2FAIcon,
  ManageAccountsRounded as AccountSettingsIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { checkPermission, PERMISSION_MAP } from '../../HOCS/withPermissions';
import { useActiveShiftQuery } from '../../pages/Shifts/query';
import { useQueryClient } from '@tanstack/react-query';
import { ToastMsgs } from '../../api/toastUtils';
import { AccountModal } from '../AccountModal';
import { http } from '../../api/http/https';

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

export interface NavItem {
  id: string;
  title: string;
  path: string;
  icon: React.ReactElement;
  pageKey: string;
  badge?: string;
  description: string;
}

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    path: '/dashboard',
    icon: <DashboardIcon />,
    pageKey: 'dashboard',
    description: 'System overview & real-time telemetry',
  },
  {
    id: 'shifts',
    title: 'Shifts & Tokens',
    path: '/shifts',
    icon: <ShiftsIcon />,
    pageKey: 'shifts',
    description: 'Worker shift sessions & RS256 QR tokens',
  },
  {
    id: 'scans',
    title: 'Scan Audits',
    path: '/scans',
    icon: <ScansIcon />,
    pageKey: 'scans',
    description: 'Offline sync & scan history',
  },
  {
    id: 'rules',
    title: 'Inventory Rules',
    path: '/rules',
    icon: <RulesIcon />,
    pageKey: 'rules',
    description: 'Claim validation policies',
  },
  {
    id: 'keys',
    title: 'Crypto Keys',
    path: '/keys',
    icon: <KeyIcon />,
    pageKey: 'keys',
    description: 'RS256 asymmetric keys & JWKS',
  },
  {
    id: 'security',
    title: 'Security & 2FA',
    path: '/security',
    icon: <Security2FAIcon />,
    pageKey: 'security',
    description: 'TOTP authenticator & email OTP',
  },
  {
    id: 'admin',
    title: 'Admin Console',
    path: '/admin',
    icon: <AdminIcon />,
    pageKey: 'admin',
    description: 'Identity governance & safety controls',
  },
];

export function DashboardLayout({ children }: { children?: React.ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const mobileSidebarOpen = useAppStore((state) => state.mobileSidebarOpen);
  const setMobileSidebarOpen = useAppStore((state) => state.setMobileSidebarOpen);
  const isApiOffline = useAppStore((state) => state.isApiOffline);
  const apiOfflineMessage = useAppStore((state) => state.apiOfflineMessage);
  const setApiOffline = useAppStore((state) => state.setApiOffline);

  const queryClient = useQueryClient();
  const [isCheckingHealth, setIsCheckingHealth] = React.useState(false);
  const [accountModalOpen, setAccountModalOpen] = React.useState(false);

  const handleRetryApi = React.useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      await http.get('/health', { skipToast: true });
      setApiOffline(false);
      queryClient.invalidateQueries();
      ToastMsgs.success('API connection restored!');
    } catch {
      // Still offline
    } finally {
      setIsCheckingHealth(false);
    }
  }, [setApiOffline, queryClient]);

  // Periodic health ping when offline to auto-recover
  React.useEffect(() => {
    if (!isApiOffline) return;
    const interval = setInterval(() => {
      handleRetryApi();
    }, 12000);
    return () => clearInterval(interval);
  }, [isApiOffline, handleRetryApi]);

  // Continuously sync user permissions and role with the server
  React.useEffect(() => {
    let isMounted = true;
    const syncProfile = async () => {
      try {
        const profile = await http.get<any>("/users/users_config/me");
        if (isMounted && profile && (profile.id || profile.email)) {
          useAuthStore.getState().setUser({
            ...profile,
            role: profile.user_role || profile.role || "user",
            user_role: profile.user_role || profile.role || "user",
            permissions: profile.permissions || {},
          });
        }
      } catch (err) {
        // Ignored in background
      }
    };
    syncProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  // Live active shift query for industrial telemetry
  const { data: activeShift } = useActiveShiftQuery();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // On mobile, the temporary slide-out drawer should ALWAYS show full expanded labels & profile info
  const isDrawerExpanded = isMobile ? true : sidebarOpen;
  const currentWidth = sidebarOpen ? DRAWER_WIDTH : COLLAPSED_WIDTH;

  // Filter navigation items by active user permissions
  const visibleNavItems = NAVIGATION_ITEMS.filter((item) => {
    const requirement = PERMISSION_MAP[item.pageKey];
    if (!requirement) return true;
    const { allowed } = checkPermission(
      user?.permissions || {},
      requirement.permissions,
      requirement.mode,
      user?.role,
      user?.user_role,
      requirement.adminOnly
    );
    return allowed;
  });

  // Mobile Bottom Bar Items (matching Android app-tabs)
  const mobileDockItems = visibleNavItems.slice(0, 4);

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#07111D',
        borderRight: '1px solid #1E293B',
        color: '#F8FAFC',
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          px: isDrawerExpanded ? 2 : 1.5,
          borderBottom: '1px solid #1E293B',
          justifyContent: isDrawerExpanded ? 'space-between' : 'center',
        }}
      >
        {isDrawerExpanded ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <img
              src="/msi_white.png"
              alt="VeriFlow Logo"
              style={{ width: 34, height: 30, objectFit: 'contain' }}
              onError={(e) => {
                // Fallback if image fails to load
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 900,
                  letterSpacing: '0.05em',
                  lineHeight: 1.1,
                  color: '#FACC15',
                  fontFamily: 'monospace',
                }}
              >
                VERIFLOW
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#94A3B8',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                INDUSTRIAL OS
              </Typography>
            </Box>
          </Box>
        ) : (
          <img
            src="/msi_white.png"
            alt="VeriFlow Logo"
            style={{ width: 32, height: 28, objectFit: 'contain' }}
          />
        )}

        {isMobile ? (
          <IconButton size="small" onClick={() => setMobileSidebarOpen(false)} sx={{ color: '#94A3B8', '&:hover': { color: '#F8FAFC' } }}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        ) : (
          sidebarOpen && (
            <IconButton size="small" onClick={toggleSidebar} sx={{ color: '#94A3B8', '&:hover': { color: '#F8FAFC' } }}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          )
        )}
      </Box>

      {/* Industrial Shift Status Card in Sidebar (when open) */}
      {isDrawerExpanded && (
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <div
            className={`p-2.5 rounded-lg border text-xs font-mono transition-all ${
              activeShift
                ? 'bg-[#0F172A] border-[#FACC15]/60 text-slate-200 shadow-[0_0_15px_rgba(250,204,21,0.1)]'
                : 'bg-[#0F172A]/50 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 font-bold">
                {activeShift ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[#FACC15] tracking-wide">SHIFT ACTIVE</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-slate-400">STANDBY MODE</span>
                  </>
                )}
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                RS256
              </span>
            </div>
            {activeShift ? (
              <div className="text-[11px] space-y-0.5 text-slate-300">
                <div className="truncate">DEV: <span className="text-yellow-400">{activeShift.device_id || 'STATION-01'}</span></div>
                <div className="text-emerald-400 text-[10px] font-semibold">VALIDATED WORKER</div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500">No shift currently active</div>
            )}
          </div>
        </Box>
      )}

      {/* Navigation List */}
      <List sx={{ px: 1, py: 1.5, flex: 1 }}>
        {visibleNavItems.map((item) => {
          const isSelected = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.id} disablePadding sx={{ display: 'block', mb: 0.5 }}>
              <Tooltip title={!isDrawerExpanded ? item.title : ''} placement="right">
                <ListItemButton
                  onClick={() => {
                    navigate(item.path);
                    if (isMobile) setMobileSidebarOpen(false);
                  }}
                  sx={{
                    minHeight: 44,
                    borderRadius: 1.5,
                    px: isDrawerExpanded ? 2 : 1.5,
                    bgcolor: isSelected ? 'rgba(250, 204, 21, 0.14)' : 'transparent',
                    color: isSelected ? '#FACC15' : '#F8FAFC',
                    borderLeft: isSelected ? '3px solid #FACC15' : '3px solid transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: isSelected ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      color: isSelected ? '#FACC15' : '#FFFFFF',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: isDrawerExpanded ? 2 : 'auto',
                      justifyContent: 'center',
                      color: isSelected ? '#FACC15' : '#94A3B8',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {isDrawerExpanded && (
                    <ListItemText
                      primary={item.title}
                      secondary={isMobile ? item.description : undefined}
                      primaryTypographyProps={{
                        fontSize: '0.88rem',
                        fontWeight: isSelected ? 800 : 600,
                        letterSpacing: '0.02em',
                        color: isSelected ? '#FACC15' : '#F8FAFC',
                      }}
                      secondaryTypographyProps={{
                        fontSize: '0.7rem',
                        color: '#94A3B8',
                        noWrap: true,
                      }}
                    />
                  )}
                  {isDrawerExpanded && item.badge && (
                    <Chip
                      size="small"
                      label={item.badge}
                      sx={{
                        height: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        bgcolor: 'rgba(250, 204, 21, 0.2)',
                        color: '#FACC15',
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      {/* Operator Session Footer */}
      <Box
        sx={{
          p: isDrawerExpanded ? 2 : 1,
          borderTop: '1px solid #1E293B',
          bgcolor: '#0B1323',
        }}
      >
        {isDrawerExpanded ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box onClick={() => setAccountModalOpen(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden', cursor: 'pointer', borderRadius: 1.5, p: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
              <Avatar
                src={user?.profile_pic || undefined}
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: '#FACC15',
                  color: '#07111D',
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                {(user?.name || user?.email || 'U')[0].toUpperCase()}
              </Avatar>
              <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="body2" fontWeight={700} noWrap sx={{ color: '#F8FAFC' }}>
                  {user?.name || user?.email}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#FACC15',
                    textTransform: 'uppercase',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    fontFamily: 'monospace',
                  }}
                >
                  {user?.role || user?.user_role || 'Worker'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title="Account Governance & Profile">
                <IconButton size="small" onClick={() => setAccountModalOpen(true)} sx={{ color: '#94A3B8', '&:hover': { color: '#FACC15' } }}>
                  <AccountSettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Log out">
                <IconButton size="small" onClick={handleLogout} sx={{ color: '#94A3B8', '&:hover': { color: '#EF4444' } }}>
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Tooltip title="Account Governance & Profile" placement="right">
              <IconButton onClick={() => setAccountModalOpen(true)} sx={{ color: '#94A3B8', mx: 'auto', display: 'block', '&:hover': { color: '#FACC15' } }}>
                <AccountSettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Log out" placement="right">
              <IconButton onClick={handleLogout} sx={{ color: '#94A3B8', mx: 'auto', display: 'block', '&:hover': { color: '#EF4444' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', width: '100%', maxWidth: '100vw', minHeight: '100dvh', bgcolor: '#07111D', overflowX: 'hidden' }}>
      {/* Mobile Drawer (Accessible via hamburger or bottom dock More) */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: '1px solid #1E293B',
              bgcolor: '#07111D',
              color: '#F8FAFC',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        /* Desktop Drawer */
        <Drawer
          variant="permanent"
          sx={{
            width: currentWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: currentWidth,
              boxSizing: 'border-box',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflowX: 'hidden',
              borderRight: '1px solid #1E293B',
              bgcolor: '#07111D',
              color: '#F8FAFC',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          maxWidth: '100%',
          width: { xs: '100%', md: `calc(100% - ${currentWidth}px)` },
          minHeight: '100dvh',
          bgcolor: '#07111D',
          overflowX: 'hidden',
          // pb on mobile prevents bottom navigation bar from overlapping page content
          pb: { xs: 10, md: 3 },
        }}
      >
        {/* Top Industrial HUD Navbar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'rgba(7, 17, 29, 0.92)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid #1E293B',
            zIndex: theme.zIndex.drawer + 1,
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 3 }, minHeight: { xs: 54, sm: 58 }, gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.5 }, minWidth: 0, flex: 1 }}>
              {isMobile ? (
                <IconButton
                  color="inherit"
                  edge="start"
                  onClick={() => setMobileSidebarOpen(true)}
                  sx={{ color: '#FACC15', mr: 0.25, flexShrink: 0 }}
                >
                  <MenuIcon />
                </IconButton>
              ) : (
                !sidebarOpen && (
                  <IconButton
                    color="inherit"
                    edge="start"
                    onClick={toggleSidebar}
                    sx={{ mr: 1, color: '#94A3B8', flexShrink: 0 }}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                )
              )}

              {/* Title & Industrial route breadcrumb */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="hidden sm:inline-block w-2 h-2 bg-[#FACC15] rounded-sm rotate-45 shrink-0" />
                <Typography
                  variant="subtitle1"
                  noWrap
                  sx={{
                    fontWeight: 800,
                    color: '#F8FAFC',
                    letterSpacing: '0.02em',
                    fontSize: { xs: '0.92rem', sm: '1rem' },
                  }}
                >
                  {visibleNavItems.find((n) => location.pathname.startsWith(n.path))?.title || 'System Console'}
                </Typography>
              </div>
            </Box>

            {/* Industrial Telemetry & Status Badges */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1 }, flexShrink: 0 }}>
              {/* Active Shift Live Pill */}
              {activeShift ? (
                <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FACC15]/15 border border-[#FACC15]/40 text-[#FACC15] font-mono text-xs font-bold shadow-[0_0_10px_rgba(250,204,21,0.15)]">
                  <span className="w-2 h-2 rounded-full bg-[#FACC15] animate-ping" />
                  <span>SHIFT ON: {activeShift.device_id || 'ACTIVE'}</span>
                </div>
              ) : (
                <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/60 text-slate-400 font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span>STANDBY</span>
                </div>
              )}

              {/* API Online/Offline Telemetry Badge */}
              {isApiOffline ? (
                <div
                  onClick={handleRetryApi}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/15 border border-rose-500/50 text-rose-300 font-mono text-[10px] sm:text-[11px] font-bold animate-pulse hover:bg-rose-500/25 transition-all"
                  title="API is currently offline. Click to test reconnection."
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="hidden sm:inline">API</span> OFFLINE
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] sm:text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="hidden sm:inline">API</span> ONLINE
                </div>
              )}

              {/* User Role Badge */}
              <div
                className={`inline-flex items-center px-2 py-1 rounded-md font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
                  user?.role === 'admin'
                    ? 'bg-rose-500/15 border border-rose-500/40 text-rose-400'
                    : 'bg-blue-500/15 border border-blue-500/40 text-blue-400'
                }`}
              >
                {user?.role === 'admin' ? 'ADMIN' : 'OPERATOR'}
              </div>
            </Box>
          </Toolbar>
        </AppBar>

        {/* API Offline Persistent Warning Banner */}
        {isApiOffline && (
          <div className="mx-3 sm:mx-6 mt-3 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/40 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="text-2xl select-none">⚠️</span>
              <div>
                <div className="font-bold text-white text-sm font-mono flex items-center gap-2">
                  <span>BACKEND API UNREACHABLE</span>
                  <span className="badge badge-xs badge-error font-mono font-bold">OFFLINE</span>
                </div>
                <p className="text-xs text-rose-200/90 mt-0.5">
                  {apiOfflineMessage || 'The backend service is currently offline or unreachable. Existing views remain operational; retrying connection in background.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={handleRetryApi}
                disabled={isCheckingHealth}
                className="btn btn-xs btn-error text-white font-mono font-bold gap-1 shadow-md hover:scale-105 transition-all"
              >
                {isCheckingHealth ? 'Pinging...' : '↻ Reconnect'}
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Route View */}
        <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: '100%', width: '100%', overflowX: 'hidden', p: { xs: 1.5, sm: 2.5, md: 3 } }}>
          {children || <Outlet />}
        </Box>
      </Box>

      <AccountModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} />

      {/* Mobile Bottom Navigation Dock */}
      {isMobile && (
        <Box
          component="nav"
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 0,
            height: 62,
            width: '100%',
            display: { xs: 'flex', md: 'none' },
            flexDirection: 'row',
            alignItems: 'stretch',
            justifyContent: 'space-around',
            bgcolor: 'rgba(15, 23, 42, 0.98)',
            borderTop: '1px solid #1E293B',
            boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {mobileDockItems.map((item) => {
            const isSelected = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                style={{
                  flex: '1 1 0%',
                  minWidth: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  padding: '4px 2px',
                  border: 'none',
                  borderTop: isSelected ? '2px solid #FACC15' : '2px solid transparent',
                  backgroundColor: isSelected ? 'rgba(250, 204, 21, 0.1)' : 'transparent',
                  color: isSelected ? '#FACC15' : '#94A3B8',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {React.cloneElement(item.icon, {
                    sx: { fontSize: 20, color: isSelected ? '#FACC15' : 'inherit' },
                  })}
                  {item.id === 'shifts' && activeShift && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: -4,
                        width: 8,
                        height: 8,
                        backgroundColor: '#34D399',
                        borderRadius: '50%',
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    marginTop: 2,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {String(item?.title || '').split(' ')[0]}
                </span>
              </button>
            );
          })}

          {/* Menu / More Button to open full Drawer on Mobile */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '4px 2px',
              border: 'none',
              borderTop: mobileSidebarOpen ? '2px solid #FACC15' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: mobileSidebarOpen ? '#FACC15' : '#94A3B8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <MenuIcon sx={{ fontSize: 20 }} />
            <span style={{ fontSize: '10px', fontWeight: 700, marginTop: 2 }}>More</span>
          </button>
        </Box>
      )}
    </Box>
  );
}

export default DashboardLayout;
