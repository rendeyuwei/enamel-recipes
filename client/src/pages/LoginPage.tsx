import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { COPY } from "../../../shared/copy.ts";
import { safeNext } from "../../../shared/domain.ts";
import { localizeError } from "../../../shared/errors.ts";
import { SITE_BADGE } from "../../../shared/site.ts";
import { ApiError, api } from "../api";
import { useLocale } from "../locale";
import { Shell } from "../Shell";
import { useSession } from "../session";

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const { href, lang } = useLocale();
  const text = COPY[lang];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ code?: string; message?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/login", { method: "POST", body: JSON.stringify({ username, password }) });
      session.markIn();
      navigate(next === "/" ? href("/") : next);
    } catch (err) {
      if (err instanceof ApiError) setError({ code: err.code, message: err.message });
      else setError({ code: "client.fallback" });
      setBusy(false);
    }
  }

  const message = error ? localizeError(lang, error.code, error.message, "form") : "";

  return (
    <Shell variant="login">
      <div className="login">
        <span className="badge disp" lang="zh-CN" translate="no">
          {SITE_BADGE}
        </span>
        <h1 className="disp">{text.loginHeading}</h1>
        <p>{text.loginIntro}</p>
        <form className="card" onSubmit={(event) => void onSubmit(event)}>
          <div className="f">
            <label htmlFor="username">{text.username}</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="f">
            <label htmlFor="password">{text.password}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {message && <div className="err">{message}</div>}
          </div>
          <div className="actions">
            <button className="btn fill" type="submit" disabled={busy}>
              {busy ? text.loggingIn : text.login}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
