import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { RecipeRoutes } from "./App";
import { SessionProvider } from "./session";

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/session")) return json({ authenticated: true });
      if (url.endsWith("/recipes")) return json({ total: 1, addedThisWeek: 0, recipes: [] });
      return json({ error: "账号或密码不对，再试一次。", code: "auth.invalid" }, 401);
    }),
  );
});

function renderAt(path: string) {
  return render(
    <SessionProvider>
      <MemoryRouter basename="/recipes" initialEntries={[path]}>
        <RecipeRoutes />
      </MemoryRouter>
    </SessionProvider>,
  );
}

it("does not treat en as a recipe id", async () => {
  renderAt("/recipes/en");
  expect(await screen.findByRole("heading", { name: /dinner/i })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Home Recipes/ })).toBeTruthy();
  const urls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
  expect(urls.some((url) => url.includes("/recipes/en"))).toBe(false);
  expect(urls.some((url) => url.endsWith("/api/recipes/en"))).toBe(false);
});

it("keeps an unsaved recipe when the language link is used, and again on the way back", async () => {
  const user = userEvent.setup();
  renderAt("/recipes/new");
  const title = await screen.findByLabelText("菜名");
  await user.type(title, "EXAMPLE · 番茄");
  const link = document.createElement("a");
  link.className = "rf-lang";
  link.href = "/recipes/en/new";
  link.textContent = "EN";
  document.body.appendChild(link);
  await user.click(link);
  expect(screen.getByLabelText("Dish name")).toBe(title);
  expect((title as HTMLInputElement).value).toBe("EXAMPLE · 番茄");
  expect(screen.getByRole("button", { name: "Save this recipe" })).toBeTruthy();
  await user.click(link);
  expect((title as HTMLInputElement).value).toBe("EXAMPLE · 番茄");
  expect(screen.getByLabelText("菜名")).toBe(title);
  expect(document.querySelector("script[src*='topbar']")).toBeNull();
  expect(Object.prototype.hasOwnProperty.call(window, "rfLang")).toBe(false);
});

it("shows English for a direct editor URL and localizes a known error code", async () => {
  const user = userEvent.setup();
  renderAt("/recipes/en/login?next=%2Fen%2Fnew#form");
  expect(await screen.findByRole("heading", { name: "Admin login" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
  await user.type(screen.getByLabelText("Username"), "someone");
  await user.type(screen.getByLabelText("Password"), "nope");
  await user.click(screen.getByRole("button", { name: "Log in" }));
  expect(await screen.findByText("Wrong username or password. Try again.")).toBeTruthy();
  expect(screen.queryByText("账号或密码不对，再试一次。")).toBeNull();
});

it("stays in English after logging in from the English page", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/session")) return json({ authenticated: false });
      if (url.endsWith("/login")) return json({ ok: true });
      if (url.endsWith("/recipes")) return json({ total: 0, addedThisWeek: 0, recipes: [] });
      return json({ error: "", code: "client.fallback" }, 500);
    }),
  );
  const user = userEvent.setup();
  renderAt("/recipes/en/login");
  await user.type(await screen.findByLabelText("Username"), "preview");
  await user.type(screen.getByLabelText("Password"), "secret");
  await user.click(screen.getByRole("button", { name: "Log in" }));
  expect(await screen.findByRole("heading", { name: /dinner/i })).toBeTruthy();
  expect(screen.getByRole("link", { name: /New recipe/ })).toBeTruthy();
});

it("localizes an empty English recipe instead of showing the Chinese validation", async () => {
  const user = userEvent.setup();
  renderAt("/recipes/en/new");
  await user.click(await screen.findByRole("button", { name: "Save this recipe" }));
  expect(await screen.findByText("Enter a dish name.")).toBeTruthy();
  expect(screen.queryByText("请填写菜名")).toBeNull();
});
