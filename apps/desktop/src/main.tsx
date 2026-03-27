import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import { AnnualResultsPage } from "./pages/AnnualResultsPage";
import { AppLayout } from "./components/AppLayout";
import { PlaceholderModulePage } from "./components/PlaceholderModulePage";
import { CalculationCenterPage } from "./pages/CalculationCenterPage";
import { AppContextProvider } from "./context/AppContextProvider";
import { EmployeeManagementPage } from "./pages/EmployeeManagementPage";
import { HomePage } from "./pages/HomePage";
import { HistoryQueryPage } from "./pages/HistoryQueryPage";
import { ImportPage } from "./pages/ImportPage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { MonthRecordEntryPage } from "./pages/MonthRecordEntryPage";
import { QuickCalculatePage } from "./pages/QuickCalculatePage";
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
      { path: "entry", element: <MonthRecordEntryPage /> },
      { path: "import", element: <ImportPage /> },
      { path: "quick-calc", element: <QuickCalculatePage /> },
      { path: "calculation", element: <CalculationCenterPage /> },
      {
        path: "results",
        element: <AnnualResultsPage />,
      },
      {
        path: "history",
        element: <HistoryQueryPage />,
      },
      {
        path: "maintenance",
        element: <MaintenancePage />,
      },
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
