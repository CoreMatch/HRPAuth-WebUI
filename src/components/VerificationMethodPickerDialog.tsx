import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material';

export type VerificationMethodKey = 'webauthn' | 'totp' | 'email' | 'recovery_key';

export interface VerificationMethodOption {
  key: VerificationMethodKey;
  title: string;
  emergency?: boolean;
  disabled?: boolean;
}

interface VerificationMethodPickerDialogProps {
  open: boolean;
  title: string;
  value: VerificationMethodKey | null;
  options: VerificationMethodOption[];
  closeLabel: string;
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
      </Stack>
    </Button>
  );
}

export default function VerificationMethodPickerDialog({
  open,
  title,
  value,
  options,
  closeLabel,
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
