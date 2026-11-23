import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { COPY } from "../../shared/copy.ts";
import { parseRouter } from "../../shared/locale.ts";
import { RecipeTitleProvider } from "./document";
import { LocaleBridge, LocaleProvider, useLocale } from "./locale";
import { DetailPage } from "./pages/DetailPage";
import { FormPage } from "./pages/FormPage";
import { ListPage } from "./pages/ListPage";
import { LoginPage } from "./pages/LoginPage";
import { RequireAuth, SessionProvider } from "./session";
import { Shell } from "./Shell";

function NotFound() {
  const { href, lang } = useLocale();
  const text = COPY[lang];
  return (
    <Shell variant="list">
      <div className="card empty">
        <p>{text.notFound}</p>
        <Link className="btn" to={href("/")}>
          {text.notFoundHome}
        </Link>
      </div>
    </Shell>
  );
}

export function RecipeRoutes() {
  const location = useLocation();
  const bare = parseRouter(location.pathname).bare;
  const virtual = { ...location, pathname: bare };
  return (
    <LocaleProvider>
      <RecipeTitleProvider>
      <LocaleBridge />
      <Routes location={virtual}>
        <Route path="/" element={<ListPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/new"
          element={
            <RequireAuth>
              <FormPage mode="new" />
            </RequireAuth>
          }
        />
        <Route
          path="/:id/edit"
          element={
            <RequireAuth>
              <FormPage mode="edit" />
            </RequireAuth>
          }
        />
        <Route path="/:id" element={<DetailPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </RecipeTitleProvider>
    </LocaleProvider>
  );
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter basename="/recipes">
        <RecipeRoutes />
      </BrowserRouter>
    </SessionProvider>
  );
}
