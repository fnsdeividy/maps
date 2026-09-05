import { describe, expect, it } from "vitest";
import {
  environmentBannerLabel,
  resolveAppEnvironment,
} from "@/lib/appEnvironment";

describe("resolveAppEnvironment", () => {
  it("usa APP_ENV quando informado", () => {
    expect(resolveAppEnvironment({ APP_ENV: "test" })).toBe("test");
    expect(resolveAppEnvironment({ APP_ENV: "development" })).toBe("development");
    expect(resolveAppEnvironment({ APP_ENV: "production" })).toBe("production");
  });

  it("trata aliases de preview/staging como teste", () => {
    expect(resolveAppEnvironment({ APP_ENV: "staging" })).toBe("test");
    expect(resolveAppEnvironment({ VERCEL_ENV: "preview" })).toBe("test");
  });

  it("em next dev (NODE_ENV=development) mostra desenvolvimento", () => {
    expect(resolveAppEnvironment({ NODE_ENV: "development" })).toBe("development");
  });

  it("em build de produção sem override não mostra selo", () => {
    expect(resolveAppEnvironment({ NODE_ENV: "production" })).toBe("production");
    expect(environmentBannerLabel("production")).toBeNull();
  });

  it("textos do selo", () => {
    expect(environmentBannerLabel("development")).toBe("Ambiente de desenvolvimento");
    expect(environmentBannerLabel("test")).toBe("Ambiente de teste");
  });
});
