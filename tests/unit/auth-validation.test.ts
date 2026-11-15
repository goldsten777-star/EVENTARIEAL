import { describe, expect, it } from "vitest";
import { loginSchema, resetPasswordSchema, signupSchema } from "@/lib/validation/auth";

const valid = { fullName: "נועה כהן", email: "Noa@Example.com ", password: "secret123", confirmPassword: "secret123" };

describe("signupSchema", () => {
  it("accepts valid input and normalizes the email", () => {
    const r = signupSchema.parse(valid);
    expect(r.email).toBe("noa@example.com");
    expect(r.fullName).toBe("נועה כהן");
  });

  it.each([
    ["short password", { password: "abc12", confirmPassword: "abc12" }, "password"],
    ["password without digits", { password: "abcdefgh", confirmPassword: "abcdefgh" }, "password"],
    ["password without letters", { password: "12345678", confirmPassword: "12345678" }, "password"],
    ["mismatched confirmation", { confirmPassword: "secret124" }, "confirmPassword"],
    ["invalid email", { email: "noa@" }, "email"],
    ["missing name", { fullName: " " }, "fullName"],
  ])("rejects %s", (_label, override, field) => {
    const r = signupSchema.safeParse({ ...valid, ...override });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0])).toContain(field);
  });

  it("accepts a Hebrew-letter password with digits", () => {
    expect(signupSchema.safeParse({ ...valid, password: "סיסמה1234", confirmPassword: "סיסמה1234" }).success).toBe(true);
  });

  it("returns Hebrew messages", () => {
    const r = signupSchema.safeParse({ ...valid, email: "x" });
    expect(r.error!.issues[0].message).toBe("כתובת אימייל לא תקינה");
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    const r = loginSchema.safeParse({ email: "", password: "" });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0]).sort()).toEqual(["email", "password"]);
  });
});

describe("resetPasswordSchema", () => {
  it("checks the confirmation", () => {
    expect(resetPasswordSchema.safeParse({ password: "newpass99", confirmPassword: "newpass99" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "newpass99", confirmPassword: "x" }).success).toBe(false);
  });
});
