import { describe, expect, it } from "vitest";
import { ERROR_CODES, errorText, localizeError, zhError } from "./errors.ts";

const HAN = /[\u3400-\u9fff]/;

describe("error codes", () => {
  it("keeps the legacy Chinese sentences and gives English a sentence for every code", () => {
    expect(zhError("title.required")).toBe("请填写菜名");
    expect(zhError("auth.invalid")).toBe("账号或密码不对，再试一次。");
    expect(zhError("upload.too_large")).toBe("单张图片不能超过 2MB");
    expect(zhError("auth.rate")).toBe("试得太勤了，等一会儿再登录。");
    expect(zhError("write.rate")).toBe("写得太勤了，等一会儿再试。");
    for (const code of ERROR_CODES) {
      expect(errorText("zh", code)).toBeTruthy();
      const english = errorText("en", code);
      expect(english).toBeTruthy();
      expect(english).not.toMatch(HAN);
    }
  });

  it("maps known codes and does not leak a Chinese or technical message into English", () => {
    expect(localizeError("en", "auth.required", "请先登录", "form")).toBe("Log in first.");
    expect(localizeError("en", "no.such", "请先登录", "form")).toBe("Something went wrong.");
    expect(localizeError("en", undefined, "Error: secret at /tmp/app.ts:1", "form")).toBe("Something went wrong.");
    expect(localizeError("zh", undefined, "账号或密码不对，再试一次。", "form")).toBe("账号或密码不对，再试一次。");
    expect(localizeError("zh", "title.required", "ignored", "field")).toBe("请填写菜名");
    expect(localizeError("en", undefined, "请填写菜名", "field")).toBe("Check this field.");
  });
});
