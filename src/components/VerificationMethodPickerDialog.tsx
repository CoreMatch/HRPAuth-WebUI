import { useEffect, useState } from 'react';
import { Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material';

export type VerificationMethodKey = 'webauthn' | 'totp' | 'email' | 'recovery_key';

export interface VerificationMethodOption {
  key: VerificationMethodKey;
  title: string;
  description?: string;
  emergency?: boolean;
  disabled?: boolean;
}

interface VerificationMethodPickerDialogProps {
  open: boolean;
  title: string;
  description?: string;
  value: VerificationMethodKey | null;
  options: VerificationMethodOption[];
  closeLabel: string;
  revealEmergencyLabel?: string;
  emergencyDescription?: string;
  onSelect: (method: VerificationMethodKey) => void;
  onClose: () => void;
}

export function getPreferredVerificationMethod(
  methods: VerificationMethodKey[]
): VerificationMethodKey | null {
  const priority: VerificationMethodKey[] = ['webauthn', 'totp', 'email', 'recovery_key'];
  return priority.find((method) => methods.includes(method)) ?? null;
}

function MethodButton({
  option,
  selected,
  onClick,
}: {
  option: VerificationMethodOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={selected ? 'contained' : 'outlined'}
      fullWidth
      disabled={option.disabled}
      onClick={onClick}
      sx={{
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        textTransform: 'none',
        px: 2,
        py: 1.5,
      }}
    >
      <Stack spacing={0.5} alignItems="flex-start" sx={{ width: '100%' }}>
        <Typography variant="body1" sx={{ fontWeight: 600 }} color="inherit">
          {option.title}
        </Typography>
        {option.description && (
          <Typography variant="body2" color={selected ? 'inherit' : 'text.secondary'} sx={{ textAlign: 'left' }}>
            {option.description}
          </Typography>
        )}
      </Stack>
    </Button>
  );
}

export default function VerificationMethodPickerDialog({
  open,
  title,
  description,
  value,
  options,
  closeLabel,
  revealEmergencyLabel,
  emergencyDescription,
  onSelect,
  onClose,
}: VerificationMethodPickerDialogProps) {
  const [showEmergencyOptions, setShowEmergencyOptions] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowEmergencyOptions(false);
    }
  }, [open]);

  const primaryOptions = options.filter((option) => !option.emergency);
  const emergencyOptions = options.filter((option) => option.emergency);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}

          {primaryOptions.map((option) => (
            <MethodButton
              key={option.key}
              option={option}
              selected={value === option.key}
              onClick={() => onSelect(option.key)}
            />
          ))}

          {emergencyOptions.length > 0 && (
            <>
              {primaryOptions.length > 0 && <Divider />}
              <Button
                type="button"
                variant="text"
                onClick={() => setShowEmergencyOptions((prev) => !prev)}
                sx={{ alignSelf: 'flex-start', textTransform: 'none', px: 0 }}
              >
                {revealEmergencyLabel}
              </Button>
              <Collapse in={showEmergencyOptions}>
                <Stack spacing={1.5}>
                  {emergencyDescription && (
                    <Typography variant="body2" color="text.secondary">
                      {emergencyDescription}
                    </Typography>
                  )}
                  {emergencyOptions.map((option) => (
                    <MethodButton
                      key={option.key}
                      option={option}
                      selected={value === option.key}
                      onClick={() => onSelect(option.key)}
                    />
                  ))}
                </Stack>
              </Collapse>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{closeLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
