import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AppContextProvider } from "./context/AppContextProvider";
import { CurrentPolicyPage } from "./pages/CurrentPolicyPage";
import { EmployeeManagementPage } from "./pages/EmployeeManagementPage";
import { HistoryQueryPage } from "./pages/HistoryQueryPage";
import { HomePage } from "./pages/HomePage";
import { ImportPage } from "./pages/ImportPage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { MonthRecordEntryPage } from "./pages/MonthRecordEntryPage";
import { QuickCalculatePage } from "./pages/QuickCalculatePage";
import { ResultConfirmationPage } from "./pages/ResultConfirmationPage";
import { UnitManagementPage } from "./pages/UnitManagementPage";
import "./styles.css";

const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "units", element: <UnitManagementPage /> },
      { path: "employees", element: <EmployeeManagementPage /> },
      { path: "quick-calc", element: <QuickCalculatePage /> },
      { path: "entry", element: <MonthRecordEntryPage /> },
      { path: "import", element: <ImportPage /> },
      { path: "result-confirmation", element: <ResultConfirmationPage /> },
      { path: "calculation", element: <Navigate replace to="/result-confirmation" /> },
      { path: "results", element: <Navigate replace to="/result-confirmation" /> },
      { path: "history", element: <HistoryQueryPage /> },
      { path: "policy", element: <CurrentPolicyPage /> },
      { path: "maintenance", element: <MaintenancePage /> },
      { path: "*", element: <Navigate replace to="/" /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppContextProvider>
      <RouterProvider router={router} />
    </AppContextProvider>
  </React.StrictMode>,
);
