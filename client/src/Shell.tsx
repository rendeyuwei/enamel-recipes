import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SITE_BADGE, SITE_NAME, SITE_ROMAN } from "../../shared/site.ts";
import { api } from "./api";
import { useSession } from "./session";

type Props = {
  variant: "list" | "detail" | "form" | "login";
  editTo?: string;
  children: ReactNode;
};

export function Shell({ variant, editTo, children }: Props) {
  const session = useSession();
  const navigate = useNavigate();

  async function logout() {
    try {
      await api("/logout", { method: "POST" });
    } finally {
      session.markOut();
      navigate("/");
    }
  }

  let actions: ReactNode = null;
  if (variant === "login") {
    actions = (
      <Link className="btn" to="/">
        先随便看看
      </Link>
    );
  } else if (variant === "form") {
    actions = (
      <>
        <span className="label">已登录 · 管理员</span>
        <button className="btn" type="button" onClick={() => void logout()}>
          退出
        </button>
      </>
    );
  } else if (session.status === "in" && variant === "list") {
    actions = (
      <>
        <span className="label">已登录 · 管理员</span>
        <Link className="btn fill" to="/new">
          ＋ 新菜谱
        </Link>
      </>
    );
  } else if (session.status === "in" && variant === "detail" && editTo) {
    actions = (
      <Link className="btn" to={editTo}>
        编辑
      </Link>
    );
  } else if (session.status === "out") {
    const next = variant === "detail" && editTo ? editTo : "/new";
    actions = (
      <Link className="btn" to={`/login?next=${encodeURIComponent(next)}`}>
        登录
      </Link>
    );
  }

  return (
    <>
      <header>
        <Link className="brand" to="/">
          <span className="badge disp">{SITE_BADGE}</span>
          <span>
            <b className="disp">{SITE_NAME}</b>
            <small>{SITE_ROMAN}</small>
          </span>
        </Link>
        <div className="who">{actions}</div>
      </header>
      <main>{children}</main>
    </>
  );
}
