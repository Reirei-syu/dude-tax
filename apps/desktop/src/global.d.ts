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

declare global {
  interface Window {
    salaryTaxDesktop?: {
      version: string;
      saveFile: (
        input: SalaryTaxDesktopSaveFileInput,
      ) => Promise<SalaryTaxDesktopSaveFileResult>;
    };
  }
}
