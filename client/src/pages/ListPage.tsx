import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { coverGlyph, recipeMatches, type RecipeCard } from "../../../shared/domain.ts";
import { SITE_NAME } from "../../../shared/site.ts";
import { api } from "../api";
import { Shell } from "../Shell";
import { useSession } from "../session";

type Catalog = { total: number; addedThisWeek: number; recipes: RecipeCard[] };

export function ListPage() {
  const session = useSession();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = `${SITE_NAME} · 菜谱`;
  }, []);

  useEffect(() => {
    let live = true;
    api<Catalog>("/recipes")
      .then((body) => {
        if (!live) return;
        setCatalog(body);
        setError("");
      })
      .catch(() => {
        if (live) setError("菜谱没有加载出来。");
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const recipes = catalog?.recipes.filter((recipe) => recipeMatches(recipe, q)) ?? [];
  const tally = q.trim()
    ? `找到 ${recipes.length} 道`
    : `共 ${catalog?.total ?? 0} 道 · 本周新增 ${catalog?.addedThisWeek ?? 0}`;

  return (
    <Shell variant="list">
      <div className="listwrap">
        <aside className="side">
          <h1 className="disp">
            今天
            <br />
            吃<span>啥</span>
          </h1>
          <p>抖音上刷到、自己做成功的菜，都记在这只饭盆里。</p>
          <form
            className="search"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="搜菜名或食材，如「土豆」"
              aria-label="搜索菜谱"
            />
            <button type="submit">搜索</button>
          </form>
          {catalog && <div className="tally mono">{tally}</div>}
        </aside>
        <div className="plates">
          {error && (
            <div className="card empty">
              <p>{error}</p>
              <button className="btn" type="button" onClick={() => setAttempt((n) => n + 1)}>
                重试
              </button>
            </div>
          )}
          {!error && !catalog && <p className="tally">正在加载菜谱…</p>}
          {catalog && catalog.recipes.length === 0 && (
            <div className="card empty">
              {session.status === "in" ? (
                <p>
                  还没有菜谱。<Link to="/new">添加第一道菜</Link>
                </p>
              ) : (
                <p>还没有菜谱，登录后可编辑，添加第一道菜</p>
              )}
            </div>
          )}
          {catalog && catalog.recipes.length > 0 && recipes.length === 0 && (
            <div className="card empty">
              <p>没有找到「{q.trim()}」。</p>
            </div>
          )}
          {recipes.map((recipe) => {
            const glyph = coverGlyph(recipe.title);
            const names = recipe.ingredients.slice(0, 3).map((item) => item.name).join(" · ");
            return (
              <Link className="plate" to={`/${recipe.id}`} key={recipe.id}>
                <div className={`thumb t-${glyph.tone}`}>
                  {recipe.coverKey ? (
                    <img src={`/recipes/img/${recipe.coverKey}`} alt="" />
                  ) : (
                    <span className="glyph disp">{glyph.char}</span>
                  )}
                </div>
                <h3>{recipe.title}</h3>
                <p>
                  <span className="ingr">{names} · </span>
                  {recipe.stepCount} 步
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
