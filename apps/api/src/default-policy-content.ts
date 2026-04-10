import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TaxPolicyContent } from "@dude-tax/core";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultPolicyContentPath = path.join(currentDir, "default-policy-content.json");
const EMPTY_POLICY_CONTENT: TaxPolicyContent = {
  policyItems: [],
  policyTitle: "",
  policyBody: "",
  policyIllustrationDataUrl: "",
};

let cachedDefaultPolicyContent: TaxPolicyContent | null = null;

const clonePolicyContent = (content: TaxPolicyContent): TaxPolicyContent =>
  JSON.parse(JSON.stringify(content)) as TaxPolicyContent;

export const getDefaultPolicyContent = (): TaxPolicyContent => {
  if (cachedDefaultPolicyContent) {
    return clonePolicyContent(cachedDefaultPolicyContent);
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(defaultPolicyContentPath, "utf8"),
    ) as TaxPolicyContent;
    cachedDefaultPolicyContent = parsed;
    return clonePolicyContent(parsed);
  } catch {
    cachedDefaultPolicyContent = EMPTY_POLICY_CONTENT;
    return clonePolicyContent(EMPTY_POLICY_CONTENT);
  }
};

export const getDefaultPolicyContentJson = () => JSON.stringify(getDefaultPolicyContent());
