import { SITE_NAME, SITE_NAME_EN, SITE_ROMAN, SITE_ROMAN_EN } from "./site.ts";
import type { Lang } from "./locale.ts";
import type { RecipeRoute } from "./locale.ts";

export type Copy = {
  siteName: string;
  roman: string;
  description: string;
  homeTitle: string;
  loginTitle: string;
  newTitle: string;
  editTitle: string;
  missingTitle: string;
  browse: string;
  signedIn: string;
  newRecipe: string;
  edit: string;
  logout: string;
  login: string;
  heroLead: string;
  heroTail: string;
  heroEm: string;
  intro: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchButton: string;
  tally: (total: number, week: number) => string;
  found: (count: number) => string;
  loadingList: string;
  listError: string;
  retry: string;
  emptyLead: string;
  emptyAction: string;
  emptyGuest: string;
  noMatchBefore: string;
  noMatchAfter: string;
  stepCount: (count: number) => string;
  notFound: string;
  notFoundHome: string;
  backAll: string;
  loginHeading: string;
  loginIntro: string;
  username: string;
  password: string;
  loggingIn: string;
  loginFailed: string;
  missingRecipe: string;
  detailError: string;
  loading: string;
  meta: (date: string, ingredients: number, steps: number) => string;
  watchVideo: string;
  ingredientsHeading: string;
  method: string;
  viewPhoto: (filename: string) => string;
  backTo: string;
  newHeading: string;
  editHeading: string;
  dishName: string;
  douyin: string;
  douyinHint: string;
  ingredientsLabel: string;
  oneIngredient: string;
  stepsLabel: string;
  oneStep: string;
  photos: string;
  photosHint: (count: number) => string;
  removePhoto: string;
  addPhoto: string;
  confirmDelete: string;
  deleteRecipe: string;
  cancel: string;
  saving: string;
  saveChanges: string;
  saveRecipe: string;
  saveFailed: string;
  deleteFailed: string;
  uploadFailed: string;
  checkingLogin: string;
};

function noun(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export const COPY: Record<Lang, Copy> = {
  zh: {
    siteName: SITE_NAME,
    roman: SITE_ROMAN,
    description: "做过的菜，按菜名或食材查找，打开就能按步骤做。",
    homeTitle: `${SITE_NAME} · 菜谱`,
    loginTitle: `登录 · ${SITE_NAME}`,
    newTitle: `新菜谱 · ${SITE_NAME}`,
    editTitle: `编辑菜谱 · ${SITE_NAME}`,
    missingTitle: `这页不在菜本里 · ${SITE_NAME}`,
    browse: "先随便看看",
    signedIn: "已登录 · 管理员",
    newRecipe: "＋ 新菜谱",
    edit: "编辑",
    logout: "退出",
    login: "登录",
    heroLead: "今天",
    heroTail: "吃",
    heroEm: "啥",
    intro: "抖音上刷到、自己做成功的菜，都记在这只饭盆里。",
    searchLabel: "搜索菜谱",
    searchPlaceholder: "搜菜名或食材，如「土豆」",
    searchButton: "搜索",
    tally: (total, week) => `共 ${total} 道 · 本周新增 ${week}`,
    found: (count) => `找到 ${count} 道`,
    loadingList: "正在加载菜谱…",
    listError: "菜谱没有加载出来。",
    retry: "重试",
    emptyLead: "还没有菜谱。",
    emptyAction: "添加第一道菜",
    emptyGuest: "还没有菜谱，登录后可编辑，添加第一道菜",
    noMatchBefore: "没有找到「",
    noMatchAfter: "」。",
    stepCount: (count) => `${count} 步`,
    notFound: "这页不在菜本里。",
    notFoundHome: "回全部菜谱",
    backAll: "← 全部菜谱",
    loginHeading: "管理员登录",
    loginIntro: "所有人都能看菜谱，登录后可编辑。",
    username: "账号",
    password: "密码",
    loggingIn: "登录中…",
    loginFailed: "登录失败",
    missingRecipe: "没有这道菜。",
    detailError: "这道菜没有加载出来。",
    loading: "正在加载…",
    meta: (date, ingredients, steps) => `${date} 录入 · ${ingredients} 种食材 · ${steps} 步`,
    watchVideo: "▶ 看原视频",
    ingredientsHeading: "备料",
    method: "做法",
    viewPhoto: (filename) => `查看截图 ${filename}`,
    backTo: "← 返回",
    newHeading: "新菜谱",
    editHeading: "编辑菜谱",
    dishName: "菜名",
    douyin: "抖音链接",
    douyinHint: "选填，详情页会显示「看原视频」",
    ingredientsLabel: "食材",
    oneIngredient: "一行一种",
    stepsLabel: "步骤",
    oneStep: "一行一步",
    photos: "截图",
    photosHint: (count) => `最多 8 张，每张不超过 2MB · 已传 ${count} / 8 · 按顺序跟步骤`,
    removePhoto: "删除这张截图",
    addPhoto: "添加截图",
    confirmDelete: "再点一次，确认删除",
    deleteRecipe: "删除这道菜",
    cancel: "取消",
    saving: "保存中…",
    saveChanges: "保存修改",
    saveRecipe: "保存这道菜",
    saveFailed: "没有保存成功。",
    deleteFailed: "没有删掉。",
    uploadFailed: "图片没有传上去。",
    checkingLogin: "正在确认登录…",
  },
  en: {
    siteName: SITE_NAME_EN,
    roman: SITE_ROMAN_EN,
    description: "Dishes I've cooked. Search by name or ingredient, then follow the steps.",
    homeTitle: `${SITE_NAME_EN} · Recipes`,
    loginTitle: `Log in · ${SITE_NAME_EN}`,
    newTitle: `New recipe · ${SITE_NAME_EN}`,
    editTitle: `Edit recipe · ${SITE_NAME_EN}`,
    missingTitle: `Page not found · ${SITE_NAME_EN}`,
    browse: "Just look around",
    signedIn: "Signed in · Admin",
    newRecipe: "＋ New recipe",
    edit: "Edit",
    logout: "Log out",
    login: "Log in",
    heroLead: "What's",
    heroTail: "for ",
    heroEm: "dinner",
    intro: "Dishes I saved from Douyin and cooked myself, kept in this bowl.",
    searchLabel: "Search recipes",
    searchPlaceholder: "Search a dish or ingredient, such as potato",
    searchButton: "Search",
    tally: (total, week) =>
      `${noun(total, "recipe", "recipes")} · ${week} added this week`,
    found: (count) => `${count} found`,
    loadingList: "Loading recipes…",
    listError: "The recipes didn't load.",
    retry: "Try again",
    emptyLead: "No recipes yet. ",
    emptyAction: "Add the first one",
    emptyGuest: "No recipes yet. Log in to add the first one.",
    noMatchBefore: "No match for “",
    noMatchAfter: "”.",
    stepCount: (count) => noun(count, "step", "steps"),
    notFound: "This page isn't in the book.",
    notFoundHome: "Back to all recipes",
    backAll: "← All recipes",
    loginHeading: "Admin login",
    loginIntro: "Anyone can read the recipes. Log in to edit.",
    username: "Username",
    password: "Password",
    loggingIn: "Logging in…",
    loginFailed: "Couldn't log in.",
    missingRecipe: "That recipe isn't here.",
    detailError: "This recipe didn't load.",
    loading: "Loading…",
    meta: (date, ingredients, steps) =>
      `Added ${date} · ${noun(ingredients, "ingredient", "ingredients")} · ${noun(steps, "step", "steps")}`,
    watchVideo: "▶ Watch the video",
    ingredientsHeading: "Ingredients",
    method: "Steps",
    viewPhoto: (filename) => `View photo ${filename}`,
    backTo: "← Back to ",
    newHeading: "New recipe",
    editHeading: "Edit recipe",
    dishName: "Dish name",
    douyin: "Douyin link",
    douyinHint: "Optional. The recipe page shows “Watch the video”.",
    ingredientsLabel: "Ingredients",
    oneIngredient: "One per line",
    stepsLabel: "Steps",
    oneStep: "One per line",
    photos: "Photos",
    photosHint: (count) => `Up to 8 photos, 2MB each · ${count} / 8 uploaded · Photos follow the steps in order`,
    removePhoto: "Remove this photo",
    addPhoto: "Add a photo",
    confirmDelete: "Click again to confirm delete",
    deleteRecipe: "Delete this recipe",
    cancel: "Cancel",
    saving: "Saving…",
    saveChanges: "Save changes",
    saveRecipe: "Save this recipe",
    saveFailed: "Couldn't save.",
    deleteFailed: "Couldn't delete it.",
    uploadFailed: "The photo didn't upload.",
    checkingLogin: "Checking login…",
  },
};

export function pageTitle(lang: Lang, route: RecipeRoute, detailTitle?: string | null): string {
  const text = COPY[lang];
  if (route.kind === "detail") {
    if (typeof detailTitle === "string" && detailTitle) return `${detailTitle} · ${text.siteName}`;
    if (detailTitle === null) return text.missingTitle;
  }
  if (route.kind === "login") return text.loginTitle;
  if (route.kind === "new") return text.newTitle;
  if (route.kind === "edit") return text.editTitle;
  if (route.kind === "other") return text.missingTitle;
  return text.homeTitle;
}
