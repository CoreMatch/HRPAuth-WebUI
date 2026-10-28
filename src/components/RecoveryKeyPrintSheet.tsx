import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  getRecoveryKeyPrintRoot,
  RECOVERY_KEY_PRINT_ACTIVE_CLASS,
} from './recoveryKeyPrint';
import './RecoveryKeyPrintSheet.css';

export type RecoveryKeyPrintMode = 'key' | 'full';

interface RecoveryKeyPrintSheetProps {
  mode: RecoveryKeyPrintMode;
  recoveryKey: string;
  accountName?: string;
  accountEmail?: string;
  generatedAt?: Date | null;
}

const formatDateTime = (value: Date | null | undefined, locale: string): string => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  } catch {
    return value.toLocaleString();
  }
};

export default function RecoveryKeyPrintSheet({
  mode,
  recoveryKey,
  accountName,
  accountEmail,
  generatedAt,
}: RecoveryKeyPrintSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const groups = recoveryKey.split('-').filter(Boolean);
  const [printRoot] = useState<HTMLElement | null>(getRecoveryKeyPrintRoot);

  useEffect(() => {
    return () => {
      document.body.classList.remove(RECOVERY_KEY_PRINT_ACTIVE_CLASS);
    };
  }, []);

  const sheet = (
    <div className={`rk-sheet rk-sheet--${mode}`}>
      {mode === 'full' && (
        <>
          <header className="rk-sheet-header">
            <span className="rk-sheet-brand">{t('profile.recoveryKeyPrintBrand')}</span>
            <h1 className="rk-sheet-title">{t('profile.recoveryKeyPrintSheetTitle')}</h1>
          </header>
          <div className="rk-sheet-rule" />
        </>
      )}

      <div className="rk-sheet-key">
        <span className="rk-sheet-key-value">
          {groups.map((group, index) => (
            <span className="rk-sheet-key-group" key={`${group}-${index}`}>
              {group}
              {index < groups.length - 1 && <span className="rk-sheet-key-sep">-</span>}
            </span>
          ))}
        </span>
      </div>

      {mode === 'full' && (
        <>
          <dl className="rk-sheet-meta">
            <div className="rk-sheet-meta-row">
              <dt>{t('profile.recoveryKeyPrintSheetAccount')}</dt>
              <dd>{accountName}</dd>
            </div>
            <div className="rk-sheet-meta-row">
              <dt>{t('profile.recoveryKeyPrintSheetEmail')}</dt>
              <dd>{accountEmail}</dd>
            </div>
            <div className="rk-sheet-meta-row">
              <dt>{t('profile.recoveryKeyPrintSheetGeneratedAt')}</dt>
              <dd>{formatDateTime(generatedAt, locale)}</dd>
            </div>
          </dl>

          <section className="rk-sheet-notice">
            <h2 className="rk-sheet-notice-title">{t('profile.recoveryKeyPrintSheetNoticeTitle')}</h2>
            <ul className="rk-sheet-notice-list">
              <li>{t('profile.recoveryKeyPrintSheetNotice1')}</li>
              <li>{t('profile.recoveryKeyPrintSheetNotice2')}</li>
              <li>{t('profile.recoveryKeyPrintSheetNotice3')}</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );

  return printRoot ? createPortal(sheet, printRoot) : null;
}
