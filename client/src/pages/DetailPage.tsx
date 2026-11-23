import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { COPY } from "../../../shared/copy.ts";
import { attachImages, formatShanghaiDate, type ImageRef, type RecipeRecord } from "../../../shared/domain.ts";
import { ApiError, api } from "../api";
import { useRecipeTitle } from "../document";
import { useLocale } from "../locale";
import { Shell } from "../Shell";

export function DetailPage() {
  const params = useParams();
  const id = params.id ?? "";
  const { href, lang } = useLocale();
  const text = COPY[lang];
  const [recipe, setRecipe] = useState<RecipeRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<ImageRef | null>(null);
  useRecipeTitle(missing ? null : recipe ? recipe.title : undefined);

  useEffect(() => {
    let live = true;
    setRecipe(null);
    setMissing(false);
    setFailed(false);
    api<RecipeRecord>(`/recipes/${id}`)
      .then((body) => {
        if (!live) return;
        setRecipe(body);
      })
      .catch((err: unknown) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else setFailed(true);
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
      <Link className="back" to={href("/")}>
        {text.backAll}
      </Link>
      {failed && <div className="card empty">{text.detailError}</div>}
      {missing && <div className="card empty">{text.missingRecipe}</div>}
      {!recipe && !missing && !failed && <p className="tally">{text.loading}</p>}
      {recipe && (
        <>
          <div className="dhead">
            <div>
              <h1 className="disp" lang="" translate="no">
                {recipe.title}
              </h1>
              <div className="meta mono">
                {text.meta(formatShanghaiDate(recipe.createdAt), recipe.ingredients.length, recipe.steps.length)}
              </div>
            </div>
            {recipe.douyinUrl && (
              <a className="btn red" href={recipe.douyinUrl} target="_blank" rel="noreferrer">
                {text.watchVideo}
              </a>
            )}
          </div>
          <div className="dgrid">
            <div className="card ings">
              <h2>{text.ingredientsHeading}</h2>
              <ul className="ing">
                {recipe.ingredients.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    <span lang="" translate="no">
                      {item.name}
                    </span>
                    <span className="mono" lang="" translate="no">
                      {item.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h2>{text.method}</h2>
              <div className="steps">
                {attachImages(recipe.steps, recipe.images).map((step, index) => (
                  <div className="step" key={`${index}-${step.text}`}>
                    <span className="n">{index + 1}</span>
                    <div>
                      <span lang="" translate="no">
                        {step.text}
                      </span>
                      {step.images.length > 0 && (
                        <div className="shots">
                          {step.images.map((image) => (
                            <button
                              key={image.key}
                              type="button"
                              className="shot"
                              onClick={() => setOpen(image)}
                              data-user-label="1"
                              aria-label={text.viewPhoto(image.filename)}
                              lang=""
                              translate="no"
                            >
                              <img src={`/recipes/img/${image.key}`} alt={image.filename} lang="" translate="no" />
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
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={open.filename}
          lang=""
          translate="no"
          onClick={() => setOpen(null)}
        >
          <img src={`/recipes/img/${open.key}`} alt={open.filename} lang="" translate="no" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </Shell>
  );
}
