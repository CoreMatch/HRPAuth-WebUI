import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material';

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
  currentLabel?: string;
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
        py: 1.75,
        minHeight: 72,
        borderWidth: selected ? 0 : 1.5,
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
  currentLabel,
  revealEmergencyLabel,
  emergencyDescription,
  onSelect,
  onClose,
}: VerificationMethodPickerDialogProps) {
  const currentOption = value ? options.find((option) => option.key === value) ?? null : null;
  const otherPrimaryOptions = options.filter((option) => option.key !== value && !option.emergency);
  const otherEmergencyOptions = options.filter((option) => option.key !== value && option.emergency);

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

          {currentOption && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">
                {currentLabel}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentOption.title}
              </Typography>
            </Stack>
          )}

          {otherPrimaryOptions.map((option) => (
            <MethodButton
              key={option.key}
              option={option}
              selected={false}
              onClick={() => onSelect(option.key)}
            />
          ))}

          {otherEmergencyOptions.length > 0 && (
            <>
              {(otherPrimaryOptions.length > 0 || currentOption) && <Divider />}
              {revealEmergencyLabel && (
                <Typography variant="subtitle2">
                  {revealEmergencyLabel}
                </Typography>
              )}
              {emergencyDescription && (
                <Typography variant="body2" color="text.secondary">
                  {emergencyDescription}
                </Typography>
              )}
              {otherEmergencyOptions.map((option) => (
                <MethodButton
                  key={option.key}
                  option={option}
                  selected={false}
                  onClick={() => onSelect(option.key)}
                />
              ))}
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
