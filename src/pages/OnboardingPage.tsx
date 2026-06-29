import React, { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonButton,
  IonIcon,
  useIonAlert,
} from '@ionic/react';
import { App as CapacitorApp } from '@capacitor/app';
import { chevronForwardOutline } from 'ionicons/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useHistory } from 'react-router-dom';
import { useStatusBar, StatusBarPresets } from '../hooks/useStatusBar';
import {
  ONBOARDING_SLIDES,
  ONBOARDING_STORAGE_KEY,
} from '../constants/onboarding';
import './OnboardingPage.css';

interface OnboardingPageProps {
  onComplete: () => void;
}

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onComplete }) => {
  const [presentAlert] = useIonAlert();
  const [slideIndex, setSlideIndex] = useState(0);
  const history = useHistory();
  const slide = ONBOARDING_SLIDES[slideIndex];
  const isLastSlide = slideIndex === ONBOARDING_SLIDES.length - 1;
  const isWelcomeSlide = slide.id === 'welcome';

  useStatusBar(StatusBarPresets.light);

  React.useEffect(() => {
    const handleBackButton = (ev: Event) => {
      (ev as CustomEvent).detail.register(10, () => {
        if (slideIndex > 0) {
          setSlideIndex(0);
          return;
        }
        presentAlert({
          header: 'Exit App',
          message: 'Are you sure you want to exit?',
          buttons: [
            { text: 'Cancel', role: 'cancel' },
            { text: 'Exit', handler: () => CapacitorApp.exitApp() },
          ],
        });
      });
    };

    document.addEventListener('ionBackButton', handleBackButton);
    return () => document.removeEventListener('ionBackButton', handleBackButton);
  }, [presentAlert, slideIndex]);

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    onComplete();
    history.replace('/app/dashboard/home');
  };

  return (
    <IonPage className="onboarding-page light">
      <IonContent fullscreen className="onboarding-content">
        <div className="onboarding-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="step-container"
            >
              <div className="step-header">
                <div className="step-icon onboarding-logo-wrap">
                  <img
                    src={slide.image}
                    alt="Balance Sheet"
                    className="onboarding-logo-image"
                  />
                </div>
                <h1 className="step-title">{slide.title}</h1>
                <p className="step-subtitle">{slide.subtitle}</p>
              </div>

              <div className="step-content">
                {isWelcomeSlide && slide.features ? (
                  <div className="onboarding-welcome">
                    <div className="welcome-features">
                      {slide.features.map((feature) => (
                        <div className="feature-item" key={feature}>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="onboarding-caption">{slide.caption}</p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="onboarding-dots">
            {ONBOARDING_SLIDES.map((item, index) => (
              <span
                key={item.id}
                className={`onboarding-dot${index === slideIndex ? ' active' : ''}`}
              />
            ))}
          </div>

          <div className="onboarding-footer">
            {isLastSlide ? (
              <IonButton expand="block" color="primary" className="action-btn start-planning-btn" onClick={completeOnboarding}>
                Start App
              </IonButton>
            ) : (
              <IonButton
                expand="block"
                className="action-btn next-btn"
                onClick={() => setSlideIndex(1)}
              >
                Next
                <IonIcon icon={chevronForwardOutline} slot="end" />
              </IonButton>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default OnboardingPage;
