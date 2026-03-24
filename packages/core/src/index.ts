export type Unit = {
  id: number;
  unitName: string;
  remark: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppContext = {
  currentUnitId: number | null;
  currentTaxYear: number;
  units: Unit[];
};

export type CreateUnitPayload = {
  unitName: string;
  remark?: string;
};

export type DeleteUnitChallenge = {
  challengeId: string;
  confirmationCode: string;
  expiresAt: string;
};

