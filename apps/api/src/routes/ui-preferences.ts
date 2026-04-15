import { WORKSPACE_DIALOG_SCOPES, WORKSPACE_PAGE_SCOPES } from "@dude-tax/core";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  uiPreferenceSchemas,
  uiPreferencesRepository,
} from "../repositories/ui-preferences-repository.js";

const pageScopeSchema = z.object({
  scope: z.enum(WORKSPACE_PAGE_SCOPES),
});

const dialogScopeSchema = z.object({
  scope: z.enum(WORKSPACE_DIALOG_SCOPES),
});

const sidebarPayloadSchema = z.object({
  collapsed: z.boolean(),
});

const navigationOrderPayloadSchema = z.object({
  order: z.array(z.string().trim().min(1)),
});

const pageLayoutPayloadSchema = z.object({
  collapsedSections: z.record(z.string().trim().min(1), z.boolean()).optional(),
  cards: z.array(uiPreferenceSchemas.workspaceCardLayoutSchema),
});

const dialogLayoutPayloadSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(240),
  height: z.number().int().min(180),
  isMaximized: z.boolean(),
});

const replyValidationError = (
  reply: {
    status: (statusCode: number) => {
      send: (body: unknown) => unknown;
    };
  },
  issues: unknown,
) =>
  reply.status(400).send({
    message: "UI 偏好参数不合法",
    issues,
  });

export const registerUiPreferenceRoutes = async (app: FastifyInstance) => {
  app.get("/api/ui-preferences/sidebar", async () => ({
    collapsed: uiPreferencesRepository.getSidebarCollapsed(),
  }));

  app.put("/api/ui-preferences/sidebar", async (request, reply) => {
    const parsedBody = sidebarPayloadSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return replyValidationError(reply, parsedBody.error.flatten());
    }

    return uiPreferencesRepository.setSidebarCollapsed(parsedBody.data.collapsed);
  });

  app.get("/api/ui-preferences/navigation-order", async () =>
    uiPreferencesRepository.getNavigationOrder(),
  );

  app.put("/api/ui-preferences/navigation-order", async (request, reply) => {
    const parsedBody = navigationOrderPayloadSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return replyValidationError(reply, parsedBody.error.flatten());
    }

    return uiPreferencesRepository.setNavigationOrder(parsedBody.data.order);
  });

  app.get("/api/ui-preferences/layouts/:scope", async (request, reply) => {
    const parsedParams = pageScopeSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return replyValidationError(reply, parsedParams.error.flatten());
    }

    return uiPreferencesRepository.getPageLayout(parsedParams.data.scope);
  });

  app.put("/api/ui-preferences/layouts/:scope", async (request, reply) => {
    const parsedParams = pageScopeSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return replyValidationError(reply, parsedParams.error.flatten());
    }

    const parsedBody = pageLayoutPayloadSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return replyValidationError(reply, parsedBody.error.flatten());
    }

    return uiPreferencesRepository.setPageLayout(parsedParams.data.scope, parsedBody.data);
  });

  app.delete("/api/ui-preferences/layouts/:scope", async (request, reply) => {
    const parsedParams = pageScopeSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return replyValidationError(reply, parsedParams.error.flatten());
    }

    uiPreferencesRepository.resetPageLayout(parsedParams.data.scope);
    return { success: true };
  });

  app.get("/api/ui-preferences/dialogs/:scope", async (request, reply) => {
    const parsedParams = dialogScopeSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return replyValidationError(reply, parsedParams.error.flatten());
    }

    return uiPreferencesRepository.getDialogLayout(parsedParams.data.scope);
  });

  app.put("/api/ui-preferences/dialogs/:scope", async (request, reply) => {
    const parsedParams = dialogScopeSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return replyValidationError(reply, parsedParams.error.flatten());
    }

    const parsedBody = dialogLayoutPayloadSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return replyValidationError(reply, parsedBody.error.flatten());
    }

    return uiPreferencesRepository.setDialogLayout(parsedParams.data.scope, parsedBody.data);
  });

  app.delete("/api/ui-preferences/dialogs/:scope", async (request, reply) => {
    const parsedParams = dialogScopeSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return replyValidationError(reply, parsedParams.error.flatten());
    }

    uiPreferencesRepository.resetDialogLayout(parsedParams.data.scope);
    return { success: true };
  });
};
