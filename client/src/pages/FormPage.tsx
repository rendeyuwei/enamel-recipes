import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatBytes, validateWrite, type ImageRef, type RecipeRecord } from "../../../shared/domain.ts";
import { SITE_NAME } from "../../../shared/site.ts";
import { ApiError, api } from "../api";
import { Shell } from "../Shell";

type Draft = ImageRef & { pending: boolean };

function line(name: string, amount: string): string {
  return amount ? `${name} ${amount}` : name;
}

function messages(fields: { field: string; message: string }[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.field, field.message]));
}

export function FormPage({ mode }: { mode: "new" | "edit" }) {
  const params = useParams();
  const navigate = useNavigate();
  const id = params.id ?? "";
  const [title, setTitle] = useState("");
  const [douyinUrl, setDouyinUrl] = useState("");
  const [ingredientText, setIngredientText] = useState("");
  const [stepText, setStepText] = useState("");
  const [images, setImages] = useState<Draft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [missing, setMissing] = useState(false);
  const [ready, setReady] = useState(mode === "new");

  useEffect(() => {
    document.title = `${mode === "new" ? "新菜谱" : "编辑菜谱"} · ${SITE_NAME}`;
  }, [mode]);

  useEffect(() => {
    if (mode !== "edit") return;
    let live = true;
    api<RecipeRecord>(`/recipes/${id}`)
      .then((recipe) => {
        if (!live) return;
        setTitle(recipe.title);
        setDouyinUrl(recipe.douyinUrl ?? "");
        setIngredientText(recipe.ingredients.map((item) => line(item.name, item.amount)).join("\n"));
        setStepText(recipe.steps.join("\n"));
        setImages(recipe.images.map((image) => ({ ...image, pending: false })));
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else setFormError("菜谱没有加载出来。");
      });
    return () => {
      live = false;
    };
  }, [id, mode]);

  async function removePending() {
    await Promise.all(
      images
        .filter((image) => image.pending)
        .map((image) => api(`/uploads/${image.key}`, { method: "DELETE" }).catch(() => undefined)),
    );
  }

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const room = 8 - images.length;
    const files = [...list].slice(0, room);
    for (const file of files) {
      if (file.size > 2 * 1024 * 1024) {
        setFormError("单张图片不能超过 2MB");
        continue;
      }
      const body = new FormData();
      body.set("file", file);
      try {
        const image = await api<ImageRef>("/uploads", { method: "POST", body });
        setImages((prev) => [...prev, { ...image, pending: true }]);
        setFormError("");
      } catch (err) {
        setFormError(err instanceof ApiError ? err.message : "图片没有传上去。");
      }
    }
  }

  async function removeImage(image: Draft) {
    setImages((prev) => prev.filter((item) => item.key !== image.key));
    if (image.pending) await api(`/uploads/${image.key}`, { method: "DELETE" }).catch(() => undefined);
  }

  async function save() {
    const payload = {
      title,
      douyinUrl,
      ingredientLines: ingredientText.split(/\r?\n/),
      stepLines: stepText.split(/\r?\n/),
      imageKeys: images.map((image) => image.key),
    };
    const parsed = validateWrite(payload);
    if (!parsed.ok) {
      setErrors(messages(parsed.fields));
      setFormError("");
      return;
    }
    setSaving(true);
    setFormError("");
    setErrors({});
    try {
      const recipe = await api<RecipeRecord>(mode === "new" ? "/recipes" : `/recipes/${id}`, {
        method: mode === "new" ? "POST" : "PUT",
        body: JSON.stringify(payload),
      });
      navigate(`/${recipe.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fields) setErrors(messages(err.fields));
        if (err.status === 401) navigate(`/login?next=${mode === "new" ? "/new" : `/${id}/edit`}`);
      } else {
        setFormError("没有保存成功。");
      }
      setSaving(false);
    }
  }

  async function removeRecipe() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await api(`/recipes/${id}`, { method: "DELETE" });
      navigate("/");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "没有删掉。");
      setSaving(false);
    }
  }

  const back = mode === "edit" && title ? `/${id}` : "/";
  const backLabel = mode === "edit" && title ? `← 返回${title}` : "← 全部菜谱";

  return (
    <Shell variant="form">
      <Link
        className="back"
        to={back}
        onClick={(event) => {
          if (images.some((image) => image.pending)) {
            event.preventDefault();
            void removePending().then(() => navigate(back));
          }
        }}
      >
        {backLabel}
      </Link>
      <div className="dhead">
        <h1 className="disp">{mode === "new" ? "新菜谱" : "编辑菜谱"}</h1>
      </div>
      {missing && <div className="card empty">没有这道菜。</div>}
      {!missing && !ready && <p className="tally">正在加载…</p>}
      {!missing && ready && (
        <div className="card">
          <div className="formgrid">
            <div className="full">
              <div className="f">
                <label htmlFor="title">菜名</label>
                <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
                {errors.title && <div className="err">{errors.title}</div>}
              </div>
              <div className="f">
                <label htmlFor="douyin">
                  抖音链接<span className="hint">选填，详情页会显示「看原视频」</span>
                </label>
                <input id="douyin" value={douyinUrl} onChange={(event) => setDouyinUrl(event.target.value)} />
                {errors.douyinUrl && <div className="err">{errors.douyinUrl}</div>}
              </div>
            </div>
            <div className="f">
              <label htmlFor="ingredients">
                食材<span className="hint">一行一种</span>
              </label>
              <textarea id="ingredients" value={ingredientText} onChange={(event) => setIngredientText(event.target.value)} />
              {errors.ingredients && <div className="err">{errors.ingredients}</div>}
            </div>
            <div className="f">
              <label htmlFor="steps">
                步骤<span className="hint">一行一步</span>
              </label>
              <textarea id="steps" value={stepText} onChange={(event) => setStepText(event.target.value)} />
              {errors.steps && <div className="err">{errors.steps}</div>}
            </div>
            <div className="full f">
              <label>
                截图
                <span className="hint">
                  最多 8 张，每张不超过 2MB · 已传 {images.length} / 8 · 按顺序跟步骤
                </span>
              </label>
              <div className="uploads">
                {images.map((image) => (
                  <div className="up" key={image.key}>
                    <div className="img">
                      <img src={`/recipes/img/${image.key}`} alt={image.filename} />
                    </div>
                    <button className="x" type="button" aria-label="删除这张截图" onClick={() => void removeImage(image)}>
                      ×
                    </button>
                    <div className="bar">
                      <span>{image.filename}</span>
                      <span className="mono">{formatBytes(image.bytes)}</span>
                    </div>
                  </div>
                ))}
                {images.length < 8 && (
                  <label className="add">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) => {
                        void onFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    <span>
                      <span className="disp">＋</span>
                      <br />
                      添加截图
                    </span>
                  </label>
                )}
              </div>
              {errors.images && <div className="err">{errors.images}</div>}
              {formError && <div className="err">{formError}</div>}
            </div>
          </div>
          <div className="actions">
            {mode === "edit" ? (
              <button className="btn red" type="button" onClick={() => void removeRecipe()} disabled={saving}>
                {confirmDelete ? "再点一次，确认删除" : "删除这道菜"}
              </button>
            ) : (
              <span />
            )}
            <span className="action-right">
              <Link
                className="btn"
                to={back}
                onClick={(event) => {
                  if (!images.some((image) => image.pending)) return;
                  event.preventDefault();
                  void removePending().then(() => navigate(back));
                }}
              >
                取消
              </Link>
              <button className="btn fill" type="button" onClick={() => void save()} disabled={saving}>
                {saving ? "保存中…" : mode === "edit" ? "保存修改" : "保存这道菜"}
              </button>
            </span>
          </div>
        </div>
      )}
    </Shell>
  );
}
