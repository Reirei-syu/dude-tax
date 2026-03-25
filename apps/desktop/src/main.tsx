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
import { MonthRecordEntryPage } from "./pages/MonthRecordEntryPage";
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
      {
        path: "import",
        element: (
          <PlaceholderModulePage
            title="批量导入"
            description="后续里程碑将提供模板下载、导入预览和冲突处理。"
          />
        ),
      },
      { path: "calculation", element: <CalculationCenterPage /> },
      {
        path: "results",
        element: <AnnualResultsPage />,
      },
      {
        path: "history",
        element: (
          <PlaceholderModulePage
            title="历史查询"
            description="后续里程碑将提供历史年度结果只读查询与导出。"
          />
        ),
      },
      {
        path: "maintenance",
        element: (
          <PlaceholderModulePage
            title="系统维护"
            description="后续里程碑将实现税率维护、提示说明、备份恢复与路径偏好。"
          />
        ),
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
