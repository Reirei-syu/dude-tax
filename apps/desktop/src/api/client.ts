import type {
  AppContext,
  CreateUnitPayload,
  DeleteUnitChallenge,
  Unit,
} from "@salary-tax/core";

const API_BASE_URL = "http://127.0.0.1:3001";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorBody?.message ?? "请求失败");
  }

  return response.json() as Promise<T>;
};

export const apiClient = {
  getContext() {
    return request<AppContext>("/api/context");
  },
  updateContext(payload: Partial<Pick<AppContext, "currentUnitId" | "currentTaxYear">>) {
    return request<AppContext>("/api/context", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  listUnits() {
    return request<Unit[]>("/api/units");
  },
  createUnit(payload: CreateUnitPayload) {
    return request<Unit>("/api/units", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createDeleteChallenge(unitId: number) {
    return request<DeleteUnitChallenge>(`/api/units/${unitId}/delete-challenge`, {
      method: "POST",
    });
  },
  deleteUnit(unitId: number, challengeId: string, confirmationCode: string) {
    return request<{ success: boolean }>(`/api/units/${unitId}`, {
      method: "DELETE",
      body: JSON.stringify({
        challengeId,
        confirmationCode,
        acknowledgeIrreversible: true,
      }),
    });
  },
};

