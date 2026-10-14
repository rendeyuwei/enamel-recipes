import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { Shell } from "./Shell";
import { SessionProvider } from "./session";

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

function stubSession(authenticated: boolean) {
  const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/session")) return json({ authenticated });
    if (url.endsWith("/logout")) {
      expect(init?.method).toBe("POST");
      expect(url).toBe("/recipes/api/logout");
      return new Response(null, { status: 204 });
    }
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderShell(variant: "list" | "detail" | "form" | "login", authenticated: boolean, editTo?: string) {
  stubSession(authenticated);
  return render(
    <SessionProvider>
      <MemoryRouter>
        <Shell variant={variant} editTo={editTo}>
          <p>正文</p>
        </Shell>
      </MemoryRouter>
    </SessionProvider>,
  );
}

function headerLabels(): string[] {
  const who = document.querySelector("header .who");
  if (!who) throw new Error("header actions missing");
  return [...who.children].map((node) => node.textContent?.trim() ?? "");
}

it("shows the new-recipe action and logout on a signed-in list", async () => {
  const user = userEvent.setup();
  renderShell("list", true);
  expect((await screen.findByText("已登录 · 管理员")).className).toBe("label");
  expect(headerLabels()).toEqual(["已登录 · 管理员", "＋ 新菜谱", "退出"]);
  const create = screen.getByRole("link", { name: "＋ 新菜谱" });
  expect(create.getAttribute("href")).toBe("/new");
  expect(create.className).toBe("btn fill");
  await user.click(screen.getByRole("button", { name: "退出" }));
  const login = await screen.findByRole("link", { name: "登录" });
  expect(login.getAttribute("href")).toBe("/login?next=%2Fnew");
  expect(screen.queryByRole("button", { name: "退出" })).toBeNull();
  expect(screen.queryByText("已登录 · 管理员")).toBeNull();
});

it("shows edit and logout on a signed-in recipe", async () => {
  renderShell("detail", true, "/7/edit");
  await screen.findByText("已登录 · 管理员");
  expect(headerLabels()).toEqual(["已登录 · 管理员", "编辑", "退出"]);
  expect(screen.getByRole("link", { name: "编辑" }).getAttribute("href")).toBe("/7/edit");
  expect(screen.queryByRole("link", { name: "＋ 新菜谱" })).toBeNull();
});

it("shows only logout on a signed-in form", async () => {
  renderShell("form", true);
  await screen.findByText("已登录 · 管理员");
  expect(headerLabels()).toEqual(["已登录 · 管理员", "退出"]);
  expect(screen.queryByRole("link", { name: "＋ 新菜谱" })).toBeNull();
  expect(screen.queryByRole("link", { name: "编辑" })).toBeNull();
});

it("keeps the guest list and login headers", async () => {
  renderShell("list", false);
  const login = await screen.findByRole("link", { name: "登录" });
  expect(login.getAttribute("href")).toBe("/login?next=%2Fnew");
  expect(headerLabels()).toEqual(["登录"]);
  expect(screen.queryByRole("button", { name: "退出" })).toBeNull();
  expect(screen.queryByText("已登录 · 管理员")).toBeNull();
});

it("keeps the login page browse link", async () => {
  renderShell("login", false);
  expect((await screen.findByRole("link", { name: "先随便看看" })).getAttribute("href")).toBe("/");
  expect(headerLabels()).toEqual(["先随便看看"]);
  expect(screen.queryByRole("button", { name: "退出" })).toBeNull();
});

it("sends a guest from a recipe toward that recipe's edit page", async () => {
  renderShell("detail", false, "/7/edit");
  const login = await screen.findByRole("link", { name: "登录" });
  expect(login.getAttribute("href")).toBe("/login?next=%2F7%2Fedit");
  expect(headerLabels()).toEqual(["登录"]);
});
