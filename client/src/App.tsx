import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { DetailPage } from "./pages/DetailPage";
import { FormPage } from "./pages/FormPage";
import { ListPage } from "./pages/ListPage";
import { LoginPage } from "./pages/LoginPage";
import { RequireAuth, SessionProvider } from "./session";
import { Shell } from "./Shell";

function NotFound() {
  return (
    <Shell variant="list">
      <div className="card empty">
        <p>这页不在菜本里。</p>
        <Link className="btn" to="/">
          回全部菜谱
        </Link>
      </div>
    </Shell>
  );
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter basename="/recipes">
        <Routes>
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
      </BrowserRouter>
    </SessionProvider>
  );
}
