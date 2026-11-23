import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { COPY } from "../../../shared/copy.ts";
import { formatBytes, validateWrite, type ImageRef, type RecipeRecord } from "../../../shared/domain.ts";
import { localizeError } from "../../../shared/errors.ts";
import { ApiError, api, type FieldIssue } from "../api";
import { useLocale } from "../locale";
import { Shell } from "../Shell";

type Draft = ImageRef & { pending: boolean };
type Issue = { code?: string; message?: string };

function line(name: string, amount: string): string {
  return amount ? `${name} ${amount}` : name;
}

function issues(fields: FieldIssue[]): Record<string, Issue> {
  return Object.fromEntries(fields.map((field) => [field.field, { code: field.code, message: field.message }]));
}

export function FormPage({ mode }: { mode: "new" | "edit" }) {
  const params = useParams();
  const navigate = useNavigate();
  const { href, lang, pathname } = useLocale();
  const text = COPY[lang];
  const id = params.id ?? "";
  const [title, setTitle] = useState("");
  const [douyinUrl, setDouyinUrl] = useState("");
  const [ingredientText, setIngredientText] = useState("");
  const [stepText, setStepText] = useState("");
  const [images, setImages] = useState<Draft[]>([]);
  const [errors, setErrors] = useState<Record<string, Issue>>({});
  const [formError, setFormError] = useState<Issue | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [missing, setMissing] = useState(false);
  const [ready, setReady] = useState(mode === "new");

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
        else setFormError({ code: err instanceof ApiError ? err.code : "client.fallback", message: err instanceof ApiError ? err.message : "" });
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
        setFormError({ code: "upload.too_large" });
        continue;
      }
      const body = new FormData();
      body.set("file", file);
      try {
        const image = await api<ImageRef>("/uploads", { method: "POST", body });
        setImages((prev) => [...prev, { ...image, pending: true }]);
        setFormError(null);
      } catch (err) {
        if (err instanceof ApiError) setFormError({ code: err.code || "client.fallback", message: err.message });
        else setFormError({ code: "client.fallback" });
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
      setErrors(issues(parsed.fields));
      setFormError(null);
      return;
    }
    setSaving(true);
    setFormError(null);
    setErrors({});
    try {
      const recipe = await api<RecipeRecord>(mode === "new" ? "/recipes" : `/recipes/${id}`, {
        method: mode === "new" ? "POST" : "PUT",
        body: JSON.stringify(payload),
      });
      navigate(href(`/${recipe.id}`));
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError({ code: err.code, message: err.message });
        if (err.fields) setErrors(issues(err.fields));
        if (err.status === 401) navigate(href(`/login?next=${encodeURIComponent(pathname)}`));
      } else {
        setFormError({ code: "client.fallback" });
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
      navigate(href("/"));
    } catch (err) {
      if (err instanceof ApiError) setFormError({ code: err.code, message: err.message });
      else setFormError({ code: "client.fallback" });
      setSaving(false);
    }
  }

  const back = mode === "edit" && title ? href(`/${id}`) : href("/");
  const fieldText = (issue: Issue | undefined) => (issue ? localizeError(lang, issue.code, issue.message, "field") : "");
  const formText = formError ? localizeError(lang, formError.code, formError.message, "form") : "";

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
        {mode === "edit" && title ? (
          <>
            {text.backTo}
            <span lang="" translate="no">
              {title}
            </span>
          </>
        ) : (
          text.backAll
        )}
      </Link>
      <div className="dhead">
        <h1 className="disp">{mode === "new" ? text.newHeading : text.editHeading}</h1>
      </div>
      {missing && <div className="card empty">{text.missingRecipe}</div>}
      {!missing && !ready && <p className="tally">{text.loading}</p>}
      {!missing && ready && (
        <div className="card">
          <div className="formgrid">
            <div className="full">
              <div className="f">
                <label htmlFor="title">{text.dishName}</label>
                <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
                {errors.title && <div className="err">{fieldText(errors.title)}</div>}
              </div>
              <div className="f">
                <label htmlFor="douyin">
                  {text.douyin}
                  <span className="hint">{text.douyinHint}</span>
                </label>
                <input id="douyin" value={douyinUrl} onChange={(event) => setDouyinUrl(event.target.value)} />
                {errors.douyinUrl && <div className="err">{fieldText(errors.douyinUrl)}</div>}
              </div>
            </div>
            <div className="f">
              <label htmlFor="ingredients">
                {text.ingredientsLabel}
                <span className="hint">{text.oneIngredient}</span>
              </label>
              <textarea id="ingredients" value={ingredientText} onChange={(event) => setIngredientText(event.target.value)} />
              {errors.ingredients && <div className="err">{fieldText(errors.ingredients)}</div>}
            </div>
            <div className="f">
              <label htmlFor="steps">
                {text.stepsLabel}
                <span className="hint">{text.oneStep}</span>
              </label>
              <textarea id="steps" value={stepText} onChange={(event) => setStepText(event.target.value)} />
              {errors.steps && <div className="err">{fieldText(errors.steps)}</div>}
            </div>
            <div className="full f">
              <label>
                {text.photos}
                <span className="hint">{text.photosHint(images.length)}</span>
              </label>
              <div className="uploads">
                {images.map((image) => (
                  <div className="up" key={image.key}>
                    <div className="img">
                      <img src={`/recipes/img/${image.key}`} alt={image.filename} lang="" translate="no" />
                    </div>
                    <button className="x" type="button" aria-label={text.removePhoto} onClick={() => void removeImage(image)}>
                      ×
                    </button>
                    <div className="bar">
                      <span lang="" translate="no">
                        {image.filename}
                      </span>
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
                      {text.addPhoto}
                    </span>
                  </label>
                )}
              </div>
              {errors.images && <div className="err">{fieldText(errors.images)}</div>}
              {formText && <div className="err">{formText}</div>}
            </div>
          </div>
          <div className="actions">
            {mode === "edit" ? (
              <button className="btn red" type="button" onClick={() => void removeRecipe()} disabled={saving}>
                {confirmDelete ? text.confirmDelete : text.deleteRecipe}
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
                {text.cancel}
              </Link>
              <button className="btn fill" type="button" onClick={() => void save()} disabled={saving}>
                {saving ? text.saving : mode === "edit" ? text.saveChanges : text.saveRecipe}
              </button>
            </span>
          </div>
        </div>
      )}
    </Shell>
  );
}
