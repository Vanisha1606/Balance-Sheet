import React, { useState } from "react";
import { IonApp, IonRouterOutlet, IonContent, IonPage, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Route, Redirect } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import BudgetPage from "./pages/BudgetPage";
import OnboardingPage from "./pages/OnboardingPage";
import { readOnboardingCompleted } from "./utils/balance-sheet-storage-reset";

import DashboardLayout from "./components/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";

import { InvoiceProvider } from "./contexts/InvoiceContext";
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";
import "./theme/variables.css";
import "./App.css";

setupIonicReact({ mode: 'ios' });

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '24px' }}>
          <h2 style={{ marginBottom: '16px' }}>Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>{error.message}</p>
          <button
            onClick={resetErrorBoundary}
            style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--ion-color-primary, #3880ff)', color: '#fff', cursor: 'pointer', fontSize: '16px' }}
          >
            Try Again
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}

const AppContent: React.FC = () => {
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(() => readOnboardingCompleted());

  const onboardingGuard = (component: React.ReactNode) =>
    isOnboardingCompleted ? component : <Redirect to="/" />;

  return (
    <IonApp className="light-theme platform-ios">
      <InvoiceProvider>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route
              exact
              path="/"
              render={() =>
                isOnboardingCompleted ? (
                  <Redirect to="/app/dashboard/home" />
                ) : (
                  <OnboardingPage onComplete={() => setIsOnboardingCompleted(true)} />
                )
              }
            />

            <Route
              path="/app/dashboard"
              render={() =>
                onboardingGuard(
                  <DashboardLayout>
                    <IonRouterOutlet>
                      <Route exact path="/app/dashboard/home" component={DashboardHome} />
                      <Route exact path="/app/dashboard">
                        <Redirect to="/app/dashboard/home" />
                      </Route>
                    </IonRouterOutlet>
                  </DashboardLayout>
                )
              }
            />

            <Route exact path="/app/editor/:fileName" render={() => onboardingGuard(<BudgetPage />)} />
            <Route exact path="/app/editor" render={() => onboardingGuard(<BudgetPage />)} />

            <Route exact path="/app/files">
              <Redirect to="/app/dashboard/home" />
            </Route>
            <Route exact path="/app">
              {isOnboardingCompleted ? <Redirect to="/app/dashboard/home" /> : <Redirect to="/" />}
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      </InvoiceProvider>
    </IonApp>
  );
};

const App: React.FC = () => (
  <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
    <AppContent />
  </ErrorBoundary>
);

export default App;
