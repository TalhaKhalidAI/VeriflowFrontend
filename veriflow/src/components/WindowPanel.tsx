import React from 'react';
import { Box, Card, IconButton, Tooltip, Typography } from '@mui/material';
import {
  OpenInFullRounded as ExpandIcon,
  CloseFullscreenRounded as ContractIcon,
  ExpandLessRounded as CollapseIcon,
  ExpandMoreRounded as UncollapseIcon,
  SwapHorizRounded as SwapIcon,
} from '@mui/icons-material';

export interface WindowPanelProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  onSwapPosition?: () => void;
  swapTooltip?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export const WindowPanel: React.FC<WindowPanelProps> = ({
  title,
  subtitle,
  isFullscreen = false,
  onToggleFullscreen,
  isMinimized = false,
  onToggleMinimize,
  onSwapPosition,
  swapTooltip = 'Move / Swap panel position',
  headerActions,
  children,
}) => {
  return (
    <Card
      sx={
        isFullscreen
          ? {
              position: 'fixed',
              inset: { xs: 8, sm: 16, md: 24 },
              zIndex: 1300,
              bgcolor: '#0B132B',
              border: '1px solid #38BDF8',
              borderRadius: 2.5,
              p: { xs: 2, sm: 3 },
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
            }
          : {
              bgcolor: '#0B132B',
              border: '1px solid #1E293B',
              borderRadius: 2,
              p: { xs: 2, sm: 2.5 },
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }
      }
    >
      {/* Window Title Bar */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 1.5,
          pb: isMinimized ? 0 : 1.5,
          mb: isMinimized ? 0 : 2,
          borderBottom: isMinimized ? 'none' : '1px solid #1E293B',
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{ color: '#F8FAFC', fontWeight: 700, lineHeight: 1.3, wordBreak: 'break-word' }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {headerActions}

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              bgcolor: '#07111D',
              border: '1px solid #1E293B',
              borderRadius: 1.5,
              p: 0.25,
            }}
          >
            {onSwapPosition && (
              <Tooltip title={swapTooltip}>
                <IconButton
                  size="small"
                  onClick={onSwapPosition}
                  sx={{ color: '#94A3B8', '&:hover': { color: '#38BDF8', bgcolor: 'rgba(56, 189, 248, 0.12)' } }}
                >
                  <SwapIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            {onToggleMinimize && !isFullscreen && (
              <Tooltip title={isMinimized ? 'Expand panel' : 'Minimize panel'}>
                <IconButton
                  size="small"
                  onClick={onToggleMinimize}
                  sx={{ color: '#94A3B8', '&:hover': { color: '#FACC15', bgcolor: 'rgba(250, 204, 21, 0.12)' } }}
                >
                  {isMinimized ? <UncollapseIcon sx={{ fontSize: 18 }} /> : <CollapseIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
            )}
            {onToggleFullscreen && (
              <Tooltip title={isFullscreen ? 'Contract to split view' : 'Expand fullscreen'}>
                <IconButton
                  size="small"
                  onClick={onToggleFullscreen}
                  sx={{
                    color: isFullscreen ? '#38BDF8' : '#94A3B8',
                    '&:hover': { color: '#38BDF8', bgcolor: 'rgba(56, 189, 248, 0.12)' },
                  }}
                >
                  {isFullscreen ? <ContractIcon sx={{ fontSize: 16 }} /> : <ExpandIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>

      {/* Window Body */}
      {!isMinimized && (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: isFullscreen ? 'hidden' : 'visible',
          }}
        >
          {children}
        </Box>
      )}
    </Card>
  );
};

