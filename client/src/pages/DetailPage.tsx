import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { attachImages, formatShanghaiDate, type ImageRef, type RecipeRecord } from "../../../shared/domain.ts";
import { SITE_NAME } from "../../../shared/site.ts";
import { ApiError, api } from "../api";
import { Shell } from "../Shell";

export function DetailPage() {
  const params = useParams();
  const id = params.id ?? "";
  const [recipe, setRecipe] = useState<RecipeRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<ImageRef | null>(null);

  useEffect(() => {
    let live = true;
    setRecipe(null);
    setMissing(false);
    setError("");
    api<RecipeRecord>(`/recipes/${id}`)
      .then((body) => {
        if (!live) return;
        setRecipe(body);
        document.title = `${body.title} · ${SITE_NAME}`;
      })
      .catch((err: unknown) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else setError("这道菜没有加载出来。");
      });
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Shell variant="detail" editTo={`/${id}/edit`}>
      <Link className="back" to="/">
        ← 全部菜谱
      </Link>
      {error && <div className="card empty">{error}</div>}
      {missing && <div className="card empty">没有这道菜。</div>}
      {!recipe && !missing && !error && <p className="tally">正在加载…</p>}
      {recipe && (
        <>
          <div className="dhead">
            <div>
              <h1 className="disp">{recipe.title}</h1>
              <div className="meta mono">
                {formatShanghaiDate(recipe.createdAt)} 录入 · {recipe.ingredients.length} 种食材 · {recipe.steps.length} 步
              </div>
            </div>
            {recipe.douyinUrl && (
              <a className="btn red" href={recipe.douyinUrl} target="_blank" rel="noreferrer">
                ▶ 看原视频
              </a>
            )}
          </div>
          <div className="dgrid">
            <div className="card ings">
              <h2>备料</h2>
              <ul className="ing">
                {recipe.ingredients.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    <span>{item.name}</span>
                    <span className="mono">{item.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h2>做法</h2>
              <div className="steps">
                {attachImages(recipe.steps, recipe.images).map((step, index) => (
                  <div className="step" key={step.text}>
                    <span className="n">{index + 1}</span>
                    <div>
                      {step.text}
                      {step.images.length > 0 && (
                        <div className="shots">
                          {step.images.map((image) => (
                            <button
                              key={image.key}
                              type="button"
                              className="shot"
                              onClick={() => setOpen(image)}
                              aria-label={`查看截图 ${image.filename}`}
                            >
                              <img src={`/recipes/img/${image.key}`} alt={image.filename} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={open.filename} onClick={() => setOpen(null)}>
          <img src={`/recipes/img/${open.key}`} alt={open.filename} onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </Shell>
  );
}
