import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { COPY } from "../../shared/copy.ts";
import { routerPath } from "../../shared/locale.ts";
import { SITE_BADGE } from "../../shared/site.ts";
import { api } from "./api";
import { useLocale } from "./locale";
import { useSession } from "./session";

type Props = {
  variant: "list" | "detail" | "form" | "login";
  editTo?: string;
  children: ReactNode;
};

export function Shell({ variant, editTo, children }: Props) {
  const session = useSession();
  const navigate = useNavigate();
  const { href, lang } = useLocale();
  const text = COPY[lang];

  async function logout() {
    try {
      await api("/logout", { method: "POST" });
    } finally {
      session.markOut();
      navigate(href("/"));
    }
  }

  const signedIn = variant === "form" || session.status === "in";
  let actions: ReactNode = null;
  if (variant === "login") {
    actions = (
      <Link className="btn" to={href("/")}>
        {text.browse}
      </Link>
    );
  } else if (signedIn) {
    actions = (
      <>
        <span className="label">{text.signedIn}</span>
        {variant === "list" && (
          <Link className="btn fill" to={href("/new")}>
            {text.newRecipe}
          </Link>
        )}
        {variant === "detail" && editTo && (
          <Link className="btn" to={href(editTo)}>
            {text.edit}
          </Link>
        )}
        <button className="btn" type="button" onClick={() => void logout()}>
          {text.logout}
        </button>
      </>
    );
  } else if (session.status === "out") {
    const next = routerPath(lang, variant === "detail" && editTo ? editTo : "/new");
    actions = (
      <Link className="btn" to={href(`/login?next=${encodeURIComponent(next)}`)}>
        {text.login}
      </Link>
    );
  }

  return (
    <>
      <header>
        <Link className="brand" to={href("/")}>
          <span className="badge disp" lang="zh-CN" translate="no">
            {SITE_BADGE}
          </span>
          <span>
            <b className="disp">{text.siteName}</b>
            <small>{text.roman}</small>
          </span>
        </Link>
        <div className="who">{actions}</div>
      </header>
      <main>{children}</main>
    </>
  );
}
