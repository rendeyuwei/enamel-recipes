import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COPY } from "../../../shared/copy.ts";
import { coverGlyph, recipeMatches, type RecipeCard } from "../../../shared/domain.ts";
import { api } from "../api";
import { useLocale } from "../locale";
import { Shell } from "../Shell";
import { useSession } from "../session";

type Catalog = { total: number; addedThisWeek: number; recipes: RecipeCard[] };

export function ListPage() {
  const session = useSession();
  const { href, lang } = useLocale();
  const text = COPY[lang];
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    api<Catalog>("/recipes")
      .then((body) => {
        if (!live) return;
        setCatalog(body);
        setFailed(false);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const recipes = catalog?.recipes.filter((recipe) => recipeMatches(recipe, q)) ?? [];
  const tally = q.trim() ? text.found(recipes.length) : text.tally(catalog?.total ?? 0, catalog?.addedThisWeek ?? 0);

  return (
    <Shell variant="list">
      <div className="listwrap">
        <aside className="side">
          <h1 className="disp">
            {text.heroLead}
            <br />
            {text.heroTail}
            <span>{text.heroEm}</span>
          </h1>
          <p>{text.intro}</p>
          <form
            className="search"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={text.searchPlaceholder}
              aria-label={text.searchLabel}
            />
            <button type="submit">{text.searchButton}</button>
          </form>
          {catalog && <div className="tally mono">{tally}</div>}
        </aside>
        <div className="plates">
          {failed && (
            <div className="card empty">
              <p>{text.listError}</p>
              <button className="btn" type="button" onClick={() => setAttempt((n) => n + 1)}>
                {text.retry}
              </button>
            </div>
          )}
          {!failed && !catalog && <p className="tally">{text.loadingList}</p>}
          {catalog && catalog.recipes.length === 0 && (
            <div className="card empty">
              {session.status === "in" ? (
                <p>
                  {text.emptyLead}
                  <Link to={href("/new")}>{text.emptyAction}</Link>
                </p>
              ) : (
                <p>{text.emptyGuest}</p>
              )}
            </div>
          )}
          {catalog && catalog.recipes.length > 0 && recipes.length === 0 && (
            <div className="card empty">
              <p>
                {text.noMatchBefore}
                <span lang="" translate="no">
                  {q.trim()}
                </span>
                {text.noMatchAfter}
              </p>
            </div>
          )}
          {recipes.map((recipe) => {
            const glyph = coverGlyph(recipe.title);
            const names = recipe.ingredients.slice(0, 3).map((item) => item.name).join(" · ");
            return (
              <Link className="plate" to={href(`/${recipe.id}`)} key={recipe.id}>
                <div className={`thumb t-${glyph.tone}`}>
                  {recipe.coverKey ? (
                    <img src={`/recipes/img/${recipe.coverKey}`} alt="" />
                  ) : (
                    <span className="glyph disp" lang="" translate="no">
                      {glyph.char}
                    </span>
                  )}
                </div>
                <h3 lang="" translate="no">
                  {recipe.title}
                </h3>
                <p>
                  <span className="ingr" lang="" translate="no">
                    {names} ·{" "}
                  </span>
                  {text.stepCount(recipe.stepCount)}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
