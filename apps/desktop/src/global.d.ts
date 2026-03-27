export {};

type SalaryTaxDesktopSaveFilter = {
  name: string;
  extensions: string[];
};

type SalaryTaxDesktopSaveFileInput = {
  defaultPath: string;
  filters: SalaryTaxDesktopSaveFilter[];
  base64Content: string;
};

type SalaryTaxDesktopSaveFileResult = {
  canceled: boolean;
  filePath?: string;
};

type SalaryTaxDesktopRuntimeConfig = {
  apiBaseUrl: string;
  managedApi: boolean;
  databasePath: string;
};

declare global {
  interface Window {
    salaryTaxDesktop?: {
      version: string;
      runtimeConfig: SalaryTaxDesktopRuntimeConfig;
      saveFile: (
        input: SalaryTaxDesktopSaveFileInput,
      ) => Promise<SalaryTaxDesktopSaveFileResult>;
    };
  }
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
