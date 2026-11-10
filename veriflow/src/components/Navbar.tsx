import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  useTheme,
  Avatar,
  Divider,
  Badge,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import {
  Home as HomeIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  DarkMode,
  LightMode,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useThemeMode } from '../hooks/useThemeMode';
import { useAuthStore } from '../store/authStore';

const DRAWER_WIDTH_EXPANDED = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

interface NavbarProps {
  title?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const menuItems = [
  { text: 'Home', icon: <HomeIcon />, path: '/' },
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/talha/dashboard' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

export function Navbar({ title = 'My App', isCollapsed, onToggleCollapse }: NavbarProps) {
  const { mode, toggleTheme } = useThemeMode();
  const logout = useAuthStore((state) => state.logout);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        minHeight: 64
      }}>
        {!isCollapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>T</Avatar>
            <Typography variant="h6" fontWeight={700} noWrap>
              Boilerplate
            </Typography>
          </Box>
        )}
        {isCollapsed && <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>T</Avatar>}
      </Box>

      <Divider />

      <List sx={{ px: 1 }}>
        {menuItems.map((item) => (
          <ListItem
            component="div"
            key={item.text}
            onClick={() => navigate(item.path)}
            sx={{
              minHeight: 48,
              justifyContent: isCollapsed ? 'center' : 'initial',
              px: 2.5,
              borderRadius: 2,
              mb: 0.5,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Tooltip title={isCollapsed ? item.text : ''} placement="right">
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isCollapsed ? 'auto' : 3,
                  justifyContent: 'center',
                  color: 'primary.main'
                }}
              >
                {item.icon}
              </ListItemIcon>
            </Tooltip>
            <ListItemText
              primary={item.text}
              sx={{ opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.2s' }}
            />
          </ListItem>
        ))}
      </List>

      <Box sx={{ mt: 'auto' }}>
        <Divider />
        <List sx={{ px: 1 }}>
          <ListItem
            component="div"
            sx={{
              minHeight: 48,
              justifyContent: isCollapsed ? 'center' : 'initial',
              px: 2.5,
              borderRadius: 2,
              mb: 0.5,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Tooltip title={isCollapsed ? "Profile" : ""} placement="right">
              <ListItemIcon sx={{ minWidth: 0, mr: isCollapsed ? 'auto' : 3, justifyContent: 'center' }}>
                <PersonIcon />
              </ListItemIcon>
            </Tooltip>
            <ListItemText primary="Profile" sx={{ opacity: isCollapsed ? 0 : 1 }} />
          </ListItem>

          <ListItem
            component="div"
            onClick={handleSignOut}
            sx={{
              minHeight: 48,
              justifyContent: isCollapsed ? 'center' : 'initial',
              px: 2.5,
              borderRadius: 2,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'error.lighter', color: 'error.main' },
            }}
          >
            <Tooltip title={isCollapsed ? "Logout" : ""} placement="right">
              <ListItemIcon sx={{ minWidth: 0, mr: isCollapsed ? 'auto' : 3, justifyContent: 'center', color: 'inherit' }}>
                <LogoutIcon />
              </ListItemIcon>
            </Tooltip>
            <ListItemText primary="Logout" sx={{ opacity: isCollapsed ? 0 : 1 }} />
          </ListItem>
        </List>

        <Divider />

        <Box sx={{ display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-end', p: 1 }}>
          <IconButton onClick={onToggleCollapse}>
            {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          width: isMobile ? '100%' : `calc(100% - ${isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED}px)`,
          ml: isMobile ? 0 : `${isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED}px`,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {title}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={toggleTheme} sx={{ color: 'text.primary' }}>
              {mode === 'light' ? <DarkMode /> : <LightMode />}
            </IconButton>

            <IconButton sx={{ color: 'text.primary' }}>
              <Badge badgeContent={3} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            <Avatar sx={{ width: 32, height: 32, ml: 1, bgcolor: 'secondary.main' }}>
              <PersonIcon fontSize="small" />
            </Avatar>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={!isCollapsed || isMobile}
        onClose={onToggleCollapse}
        sx={{
          width: isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          '& .MuiDrawer-paper': {
            width: isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED,
            overflowX: 'hidden',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
}
