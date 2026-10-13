import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { safeNext } from "../../../shared/domain.ts";
import { SITE_BADGE, SITE_NAME } from "../../../shared/site.ts";
import { ApiError, api } from "../api";
import { Shell } from "../Shell";
import { useSession } from "../session";

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));

  useEffect(() => {
    document.title = `登录 · ${SITE_NAME}`;
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/login", { method: "POST", body: JSON.stringify({ username, password }) });
      session.markIn();
      navigate(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登录失败");
      setBusy(false);
    }
  }

  return (
    <Shell variant="login">
      <div className="login">
        <span className="badge disp">{SITE_BADGE}</span>
        <h1 className="disp">管理员登录</h1>
        <p>所有人都能看菜谱，登录后可编辑。</p>
        <form className="card" onSubmit={(event) => void onSubmit(event)}>
          <div className="f">
            <label htmlFor="username">账号</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="f">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <div className="err">{error}</div>}
          </div>
          <div className="actions">
            <button className="btn fill" type="submit" disabled={busy}>
              {busy ? "登录中…" : "登录"}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
