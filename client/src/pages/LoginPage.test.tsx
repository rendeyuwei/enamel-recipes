import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import { SessionProvider } from "../session";

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

it("shows the server's login error under the password", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/session")) return json({ authenticated: false });
    expect(init?.body).toBe(JSON.stringify({ username: "rende", password: "nope" }));
    return json({ error: "账号或密码不对，再试一次。" }, 401);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </SessionProvider>,
  );
  expect(await screen.findByRole("heading", { name: "管理员登录" })).toBeTruthy();
  expect(screen.getByText("所有人都能看菜谱，登录后可编辑。")).toBeTruthy();
  await user.type(screen.getByLabelText("账号"), "rende");
  await user.type(screen.getByLabelText("密码"), "nope");
  await user.click(screen.getByRole("button", { name: "登录" }));
  expect(await screen.findByText("账号或密码不对，再试一次。")).toBeTruthy();
});
