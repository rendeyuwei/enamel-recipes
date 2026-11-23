import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
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

function exactRecipesRedirect(href: string): string {
  const url = new URL(href, "https://rende.fun");
  if (url.pathname === "/recipes") return "https://rende.fun/recipes/";
  return url.href;
}

it("keeps the Chinese home query and explicit language through the public redirect", async () => {
  const user = userEvent.setup();
  window.history.replaceState({}, "", "/recipes/en/?q=1#h");
  const link = document.createElement("a");
  link.className = "rf-lang";
  link.href = "/recipes/?q=1&lang=zh#h";
  document.body.appendChild(link);
  try {
    render(
      <SessionProvider>
        <BrowserRouter basename="/recipes/">
          <RecipeRoutes />
        </BrowserRouter>
      </SessionProvider>,
    );
    expect(await screen.findByRole("heading", { name: /dinner/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Home Recipes/ }).getAttribute("href")).toBe("/recipes/en/");
    const before = window.history.length;
    await user.click(link);
    expect(window.location.pathname).toBe("/recipes/");
    expect(window.location.search).toBe("?q=1&lang=zh");
    expect(window.location.hash).toBe("#h");
    expect(window.history.length).toBe(before + 1);
    expect(exactRecipesRedirect(window.location.href)).toBe(window.location.href);
    expect(exactRecipesRedirect("https://rende.fun/recipes?q=1&lang=zh#h")).toBe("https://rende.fun/recipes/");
    expect(screen.getByRole("link", { name: /家常菜本/ }).getAttribute("href")).toBe("/recipes/");
    expect(screen.getByRole("heading", { name: /今天/ })).toBeTruthy();
  } finally {
    link.remove();
  }
});

it("keeps an unsaved editor on one history entry when the language changes", async () => {
  const user = userEvent.setup();
  window.history.replaceState({}, "", "/recipes/en/new");
  const link = document.createElement("a");
  link.className = "rf-lang";
  link.href = "/recipes/new?lang=zh";
  document.body.appendChild(link);
  try {
    render(
      <SessionProvider>
        <BrowserRouter basename="/recipes/">
          <RecipeRoutes />
        </BrowserRouter>
      </SessionProvider>,
    );
    const title = await screen.findByLabelText("Dish name");
    await user.type(title, "EXAMPLE keep");
    const before = window.history.length;
    await user.click(link);
    expect(window.location.pathname).toBe("/recipes/new");
    expect(window.location.search).toBe("?lang=zh");
    expect(window.history.length).toBe(before + 1);
    expect((title as HTMLInputElement).value).toBe("EXAMPLE keep");
  } finally {
    link.remove();
  }
});

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

it("chooses a later shell version the same way, without looking for v1", async () => {
  const user = userEvent.setup();
  const choose = vi.fn((lang: "zh" | "en") => lang === "zh" || lang === "en");
  window.rfLang = { v: 3, leaving: false, choose } as unknown as Window["rfLang"];
  let paints = 0;
  const onLocale = () => {
    paints += 1;
  };
  document.addEventListener("rf:locale", onLocale);
  const link = document.createElement("a");
  link.className = "rf-lang";
  link.href = "/recipes/en/";
  document.body.appendChild(link);
  try {
    renderAt("/recipes/");
    await screen.findByRole("heading", { name: /dinner|今天/ });
    await user.click(link);
    expect(choose).toHaveBeenCalledTimes(1);
    expect(choose).toHaveBeenCalledWith("en");
    expect(paints).toBe(1);
  } finally {
    document.removeEventListener("rf:locale", onLocale);
    link.remove();
    delete window.rfLang;
  }
});

it("chooses the requested language once the route commits, and not after back or forward", async () => {
  const user = userEvent.setup();
  const choose = vi.fn((lang: "zh" | "en") => lang === "zh" || lang === "en");
  window.rfLang = { v: 2, leaving: false, choose } as unknown as Window["rfLang"];
  const paints: string[] = [];
  const onLocale = () => paints.push(document.documentElement.lang);
  document.addEventListener("rf:locale", onLocale);
  const link = document.createElement("a");
  link.className = "rf-lang";
  link.href = "/recipes/en/new";
  link.textContent = "EN";
  document.body.appendChild(link);
  try {
    renderAt("/recipes/new");
    const title = await screen.findByLabelText("菜名");
    await user.type(title, "EXAMPLE · 番茄");
    await user.click(link);
    expect(choose.mock.calls.map((call) => call[0])).toEqual(["en"]);
    expect(paints).toEqual(["en"]);
    expect(link.getAttribute("href")).toBe("/recipes/en/new");
    expect((title as HTMLInputElement).value).toBe("EXAMPLE · 番茄");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(choose).toHaveBeenCalledTimes(1);
    await user.click(link);
    expect(choose.mock.calls.map((call) => call[0])).toEqual(["en", "zh"]);
    expect(paints).toEqual(["en", "zh-CN"]);
  } finally {
    document.removeEventListener("rf:locale", onLocale);
    link.remove();
    delete window.rfLang;
  }
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
