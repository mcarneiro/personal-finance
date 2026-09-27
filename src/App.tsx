import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import PlanScreen from './features/plan/PlanScreen';
import BillsScreen from './features/bills/BillsScreen';
import IncomeScreen from './features/income/IncomeScreen';
import SettingsScreen from './features/settings/SettingsScreen';
import { useAppSelector } from './store/hooks';
import { getCurrentMonth } from './utils/month';

function App() {
  const dataLoading = useAppSelector((state) => state.app.dataLoading);
  const dataLoaded = useAppSelector((state) => state.app.dataLoaded);
  const currentMonth = getCurrentMonth();

  // Keep a loading state until the initial data load settles, so the app never
  // flashes empty data. Inert until the Sheets sync lands.
  if (dataLoading && !dataLoaded) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/plan/${currentMonth}`} replace />} />
      <Route path="/plan" element={<Navigate to={`/plan/${currentMonth}`} replace />} />
      <Route path="/plan/:month" element={<Layout><PlanScreen /></Layout>} />
      <Route path="/bills" element={<Navigate to={`/bills/${currentMonth}`} replace />} />
      <Route path="/bills/:month" element={<Layout><BillsScreen /></Layout>} />
      <Route path="/income" element={<Navigate to={`/income/${currentMonth}`} replace />} />
      <Route path="/income/:month" element={<Layout><IncomeScreen /></Layout>} />
      <Route path="/settings" element={<Layout><SettingsScreen /></Layout>} />
      <Route path="*" element={<Navigate to={`/plan/${currentMonth}`} replace />} />
    </Routes>
  );
}

export default App;
