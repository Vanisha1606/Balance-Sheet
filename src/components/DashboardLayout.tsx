import React, { useState } from 'react';
import { IonIcon, IonButton, IonSpinner, useIonAlert } from '@ionic/react';
import { App as CapacitorApp } from '@capacitor/app';
import { add } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';

import { localTemplateService } from '../services/local-template-service';
import './DashboardLayout.css';
import { useStatusBar, StatusBarPresets } from '../hooks/useStatusBar';
import { pickTemplateIdForDevice } from '../utils/deviceTemplate';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [isCreating, setIsCreating] = useState(false);
  const history = useHistory();
  const location = useLocation();
  const [presentAlert] = useIonAlert();

  useStatusBar(StatusBarPresets.light);

  React.useEffect(() => {
    const handleBackButton = (ev: Event) => {
      (ev as CustomEvent).detail.register(10, () => {
        if (location.pathname === '/app/dashboard/home') {
          presentAlert({
            header: 'Exit App',
            message: 'Are you sure you want to exit?',
            buttons: [
              { text: 'Cancel', role: 'cancel' },
              { text: 'Exit', handler: () => CapacitorApp.exitApp() },
            ],
          });
        }
      });
    };

    document.addEventListener('ionBackButton', handleBackButton);
    return () => document.removeEventListener('ionBackButton', handleBackButton);
  }, [location.pathname, presentAlert]);

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const canCreate = await localTemplateService.canCreateInvoice();
      if (!canCreate) {
        presentAlert({
          header: 'File Limit Reached',
          message: `You can save a maximum of ${localTemplateService.maxInvoices} balance sheets. Please delete some files before creating a new one.`,
          buttons: ['OK'],
        });
        return;
      }

      const templates = await localTemplateService.fetchStoreTemplates(1, 100);
      const templateId = pickTemplateIdForDevice(templates.items);

      if (templateId) {
        await localTemplateService.setActiveTemplateId(templateId);
        history.push(`/app/editor/default?template=${templateId}`);
      } else {
        presentAlert({
          header: 'Template Unavailable',
          message: 'Could not load a balance sheet template. Please restart the app and try again.',
          buttons: ['OK'],
        });
      }
    } catch (error) {
      console.error('Error creating balance sheet:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src="/img/bi.png"
            alt="Balance Sheet"
            style={{ width: 28, height: 28, borderRadius: 6, marginRight: 8 }}
          />
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Balance Sheet</h1>
        </div>

        <IonButton
          fill="solid"
          color="primary"
          onClick={handleCreate}
          disabled={isCreating}
          style={{
            height: '36px',
            fontSize: '14px',
            textTransform: 'none',
            '--padding-start': '12px',
            '--padding-end': '16px',
            '--border-radius': '8px',
            fontWeight: 500,
          }}
        >
          {isCreating ? (
            <IonSpinner name="crescent" style={{ width: '20px', height: '20px' }} />
          ) : (
            <>
              <IonIcon icon={add} slot="start" style={{ fontSize: '18px', marginRight: '4px' }} />
              Create
            </>
          )}
        </IonButton>
      </header>

      <div className="dashboard-body">
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
