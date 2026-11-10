import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { WarningAmberRounded as AlertIcon, RefreshRounded as RefreshIcon, HomeRounded as HomeIcon } from '@mui/icons-material';
import React, { useState } from 'react';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
      ? (error as any).message || (error as any).detail || (error as any).error || JSON.stringify(error, null, 2)
      : String(error);
  const stack =
    error instanceof Error
      ? error.stack
      : typeof error === 'object' && error !== null && (error as any).stack
      ? (error as any).stack
      : typeof error === 'object'
      ? JSON.stringify(error, null, 2)
      : '';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#07111D',
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 5 },
          maxWidth: 620,
          width: '100%',
          textAlign: 'center',
          borderRadius: 4,
          border: '1px solid #1E293B',
          bgcolor: '#0F172A',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <Box sx={{ mb: 2, display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertIcon sx={{ fontSize: 48, color: '#EF4444' }} />
        </Box>

        <Typography variant="h5" fontWeight={800} sx={{ color: '#F8FAFC', mb: 1, fontFamily: 'monospace' }}>
          RUNTIME SYSTEM SHIELD
        </Typography>

        <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3, lineHeight: 1.6 }}>
          An unexpected rendering anomaly occurred. Veriflow's defensive boundaries prevented a browser crash. You can safely retry or return to the main dashboard console.
        </Typography>

        <Box
          sx={{
            textAlign: 'left',
            bgcolor: '#07111D',
            p: 2,
            borderRadius: 2,
            border: '1px solid #1E293B',
            mb: 3,
            overflowX: 'auto',
          }}
        >
          <Typography variant="caption" sx={{ color: '#F87171', fontFamily: 'monospace', fontWeight: 600, display: 'block' }}>
            {errorMessage || 'Unknown UI Error'}
          </Typography>
          {stack && showDetails && (
            <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace', display: 'block', mt: 1, whiteSpace: 'pre-wrap', fontSize: 10 }}>
              {stack}
            </Typography>
          )}
          {stack && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-[11px] font-mono text-yellow-400 hover:underline mt-2 inline-block cursor-pointer"
            >
              {showDetails ? 'Hide Stack Trace' : 'Show Technical Trace'}
            </button>
          )}
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={resetErrorBoundary}
            sx={{
              bgcolor: '#FACC15',
              color: '#07111D',
              fontWeight: 700,
              textTransform: 'none',
              px: 3,
              '&:hover': { bgcolor: '#EAB308' },
            }}
          >
            Retry View
          </Button>

          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={() => {
              window.location.href = '/dashboard';
            }}
            sx={{
              borderColor: '#1E293B',
              color: '#F8FAFC',
              fontWeight: 600,
              textTransform: 'none',
              px: 3,
              '&:hover': { borderColor: '#FACC15', bgcolor: 'rgba(250, 204, 21, 0.05)' },
            }}
          >
            Return to Dashboard
          </Button>

          <Button
            variant="text"
            onClick={() => window.location.reload()}
            sx={{
              color: '#64748B',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': { color: '#94A3B8' },
            }}
          >
            Reload App
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
  const handleError = (error: unknown, info: React.ErrorInfo) => {
    console.error('Veriflow Runtime Error Shield Caught:', error, info);
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        window.location.href = '/dashboard';
      }}
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  );
}
