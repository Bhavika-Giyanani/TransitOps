import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Trip } from '../../types';
import { FleetManagerDashboard } from '../dashboard/FleetManagerDashboard';
import { DriverDashboard } from '../dashboard/DriverDashboard';
import { SafetyOfficerDashboard } from '../dashboard/SafetyOfficerDashboard';
import { FinancialAnalystDashboard } from '../dashboard/FinancialAnalystDashboard';
import { GettingStartedGuide } from '../dashboard/GettingStartedGuide';
import { LayoutDashboard, Compass } from 'lucide-react';

interface DashboardViewProps {
  onOpenNewTripModal: () => void;
  onOpenAddVehicleModal: () => void;
  onOpenAddDriverModal?: () => void;
  onOpenLogMaintModal: () => void;
  onOpenCompleteTripModal: (trip: Trip) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewTripModal,
  onOpenAddVehicleModal,
  onOpenAddDriverModal = () => {},
  onOpenLogMaintModal,
  onOpenCompleteTripModal,
}) => {
  const {
    userRole,
    currentUser,
    vehicles,
    trips,
    isLoadingData,
    dataLoadError,
    refreshData,
  } = useApp();

  const onboardingKey = currentUser
    ? `transitops_onboarding_v2_dismissed_${currentUser.tenantId || 'tenant'}_${currentUser.id}`
    : '';
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(
    () => Boolean(onboardingKey && localStorage.getItem(onboardingKey) === 'true'),
  );
  const shouldShowOnboarding = !isOnboardingDismissed;
  const [activeTab, setActiveTab] = useState<'onboarding' | 'dashboard'>(
    shouldShowOnboarding ? 'onboarding' : 'dashboard'
  );
  const openDashboard = () => {
    setActiveTab('dashboard');
    if (userRole !== 'fleet_manager' || trips.length > 0) {
      setIsOnboardingDismissed(true);
      if (onboardingKey) localStorage.setItem(onboardingKey, 'true');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {isLoadingData && (
        <div role="status" className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          Loading saved fleet data…
        </div>
      )}
      {dataLoadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{dataLoadError}</span>
          <button
            type="button"
            onClick={() => void refreshData()}
            disabled={isLoadingData}
            className="rounded-lg border border-red-400/40 px-3 py-1.5 font-semibold hover:bg-red-500/10 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}
      {shouldShowOnboarding && (
        <div className="flex items-center justify-between pb-2 border-b border-inherit">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('onboarding')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'onboarding'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Getting Started Guide</span>
            </button>
            <button
              onClick={openDashboard}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{userRole === 'safety_officer'
                ? 'Safety Dashboard'
                : userRole === 'financial_analyst'
                  ? 'Financial Dashboard'
                  : userRole === 'driver'
                    ? 'Driver Dashboard'
                    : 'Fleet Operations Dashboard'}</span>
            </button>
          </div>
          <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
            {isLoadingData ? 'Loading organization workspace…' : `${vehicles.length} fleet asset${vehicles.length === 1 ? '' : 's'} · ${trips.length} trip${trips.length === 1 ? '' : 's'}`}
          </span>
        </div>
      )}

      {shouldShowOnboarding && activeTab === 'onboarding' ? (
        <GettingStartedGuide
          onOpenAddVehicleModal={onOpenAddVehicleModal}
          onOpenAddDriverModal={onOpenAddDriverModal}
          onOpenNewTripModal={onOpenNewTripModal}
        />
      ) : (
        <>
          {userRole === 'fleet_manager' && (
            <FleetManagerDashboard
              onOpenNewTripModal={onOpenNewTripModal}
              onOpenAddVehicleModal={onOpenAddVehicleModal}
              onOpenLogMaintModal={onOpenLogMaintModal}
              onOpenCompleteTripModal={onOpenCompleteTripModal}
            />
          )}

          {userRole === 'driver' && (
            <DriverDashboard
              onOpenCompleteTripModal={onOpenCompleteTripModal}
            />
          )}

          {userRole === 'safety_officer' && <SafetyOfficerDashboard />}

          {userRole === 'financial_analyst' && <FinancialAnalystDashboard />}
        </>
      )}
    </div>
  );
};
