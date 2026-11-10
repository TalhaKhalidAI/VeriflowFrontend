// src/context/ThemeContext.tsx
import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const CustomThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // VeriFlow Industrial UI is strictly dark-themed (#07111D / #0B132B / #0F172A).
  // Always default to 'dark' so inputs, selects, menus, and labels never render black text on dark surfaces.
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    localStorage.setItem('theme-mode', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'dark';
    document.documentElement.classList.add('dark');
  }, [mode]);

  const toggleTheme = () => {
    setMode('dark');
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'dark',
          primary: {
            main: '#38BDF8',
            light: '#7DD3FC',
            dark: '#0284C7',
            contrastText: '#07111D',
          },
          secondary: {
            main: '#FACC15',
            light: '#FDE047',
            dark: '#EAB308',
            contrastText: '#07111D',
          },
          success: {
            main: '#10B981',
            contrastText: '#07111D',
          },
          warning: {
            main: '#F59E0B',
            contrastText: '#07111D',
          },
          error: {
            main: '#EF4444',
            contrastText: '#F8FAFC',
          },
          background: {
            default: '#07111D',
            paper: '#0F172A',
          },
          text: {
            primary: '#F8FAFC',
            secondary: '#94A3B8',
            disabled: '#64748B',
          },
          divider: '#1E293B',
        },
        shape: {
          borderRadius: 10,
        },
        typography: {
          fontFamily: '"Inter", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          button: {
            textTransform: 'none',
            fontWeight: 700,
          },
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              html: {
                colorScheme: 'dark',
                backgroundColor: '#07111D',
                color: '#F8FAFC',
              },
              body: {
                backgroundColor: '#07111D',
                color: '#F8FAFC',
                overflowX: 'hidden',
              },
            },
          },
          MuiInputBase: {
            styleOverrides: {
              root: {
                color: '#F8FAFC !important',
                backgroundColor: '#07111D',
                fontSize: '0.9rem',
                '&.Mui-disabled': {
                  color: '#94A3B8 !important',
                  WebkitTextFillColor: '#94A3B8 !important',
                },
              },
              input: {
                color: '#F8FAFC !important',
                WebkitTextFillColor: '#F8FAFC !important',
                caretColor: '#FACC15',
                '&::placeholder': {
                  color: '#64748B !important',
                  opacity: 1,
                  WebkitTextFillColor: '#64748B !important',
                },
                '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active': {
                  WebkitBoxShadow: '0 0 0 100px #07111D inset !important',
                  WebkitTextFillColor: '#F8FAFC !important',
                  caretColor: '#FACC15 !important',
                  borderRadius: 'inherit',
                },
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                color: '#F8FAFC !important',
                backgroundColor: '#07111D',
                borderRadius: 8,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(148, 163, 184, 0.28)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#38BDF8',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#FACC15',
                  borderWidth: '1.5px',
                },
              },
              input: {
                color: '#F8FAFC !important',
                WebkitTextFillColor: '#F8FAFC !important',
              },
            },
          },
          MuiFilledInput: {
            styleOverrides: {
              root: {
                color: '#F8FAFC !important',
                backgroundColor: '#07111D',
                '&:hover': {
                  backgroundColor: '#0B132B',
                },
                '&.Mui-focused': {
                  backgroundColor: '#07111D',
                },
              },
              input: {
                color: '#F8FAFC !important',
                WebkitTextFillColor: '#F8FAFC !important',
              },
            },
          },
          MuiInputLabel: {
            styleOverrides: {
              root: {
                color: '#94A3B8',
                '&.Mui-focused': {
                  color: '#FACC15',
                },
                '&.Mui-disabled': {
                  color: '#64748B',
                },
              },
            },
          },
          MuiFormLabel: {
            styleOverrides: {
              root: {
                color: '#94A3B8',
                '&.Mui-focused': {
                  color: '#FACC15',
                },
              },
            },
          },
          MuiFormHelperText: {
            styleOverrides: {
              root: {
                color: '#94A3B8',
              },
            },
          },
          MuiSelect: {
            styleOverrides: {
              select: {
                color: '#F8FAFC !important',
                WebkitTextFillColor: '#F8FAFC !important',
                backgroundColor: 'transparent',
              },
              icon: {
                color: '#94A3B8',
              },
              nativeInput: {
                color: '#F8FAFC !important',
              },
            },
          },
          MuiAutocomplete: {
            styleOverrides: {
              paper: {
                backgroundColor: '#0F172A',
                color: '#F8FAFC',
                border: '1px solid #1E293B',
              },
              option: {
                color: '#F8FAFC',
                '&[aria-selected="true"]': {
                  backgroundColor: 'rgba(250, 204, 21, 0.16) !important',
                  color: '#FACC15',
                },
                '&.Mui-focused': {
                  backgroundColor: 'rgba(56, 189, 248, 0.12) !important',
                },
              },
              popupIndicator: {
                color: '#94A3B8',
              },
              clearIndicator: {
                color: '#94A3B8',
              },
            },
          },
          MuiMenu: {
            styleOverrides: {
              paper: {
                backgroundColor: '#0F172A !important',
                color: '#F8FAFC !important',
                border: '1px solid #1E293B',
                backgroundImage: 'none',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
              },
              list: {
                paddingTop: 4,
                paddingBottom: 4,
              },
            },
          },
          MuiMenuItem: {
            styleOverrides: {
              root: {
                color: '#F8FAFC !important',
                fontSize: '0.875rem',
                minHeight: 38,
                '&:hover': {
                  backgroundColor: 'rgba(56, 189, 248, 0.14) !important',
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(250, 204, 21, 0.16) !important',
                  color: '#FACC15 !important',
                  fontWeight: 700,
                  '&:hover': {
                    backgroundColor: 'rgba(250, 204, 21, 0.24) !important',
                  },
                },
              },
            },
          },
          MuiPopover: {
            styleOverrides: {
              paper: {
                backgroundColor: '#0F172A',
                color: '#F8FAFC',
                border: '1px solid #1E293B',
                backgroundImage: 'none',
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                backgroundColor: '#0B132B',
                color: '#F8FAFC',
                backgroundImage: 'none',
                border: '1px solid #1E293B',
                margin: 12,
                width: 'calc(100% - 24px)',
                maxHeight: 'calc(100% - 24px)',
              },
            },
          },
          MuiDialogTitle: {
            styleOverrides: {
              root: {
                color: '#F8FAFC',
                fontWeight: 800,
                padding: '16px 20px',
              },
            },
          },
          MuiDialogContent: {
            styleOverrides: {
              root: {
                color: '#E2E8F0',
                padding: '16px 20px',
              },
            },
          },
          MuiDialogActions: {
            styleOverrides: {
              root: {
                padding: '12px 20px',
                gap: 8,
                flexWrap: 'wrap',
              },
            },
          },
          MuiButton: {
            defaultProps: {
              disableElevation: true,
            },
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 8,
                minHeight: 38,
                padding: '6px 16px',
                fontSize: '0.84rem',
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.18s ease',
              },
              sizeSmall: {
                minHeight: 36,
                height: 36,
                padding: '5px 14px',
                fontSize: '0.8rem',
              },
              sizeMedium: {
                minHeight: 38,
                height: 38,
                padding: '6px 16px',
                fontSize: '0.85rem',
              },
              sizeLarge: {
                minHeight: 44,
                height: 44,
                padding: '8px 22px',
                fontSize: '0.92rem',
              },
              startIcon: {
                marginRight: 2,
                marginLeft: -2,
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderColor: '#1E293B',
                color: '#E2E8F0',
              },
              head: {
                color: '#94A3B8',
                fontWeight: 800,
                backgroundColor: '#07111D',
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const ThemeProvider = CustomThemeProvider;

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a CustomThemeProvider');
  }
  return context;
};

export const useTheme = useThemeContext;
export default ThemeProvider;
