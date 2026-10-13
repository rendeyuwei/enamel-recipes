import type { Repo } from "./repo.ts";
import { validateWrite, type RecipeWrite } from "../../shared/domain.ts";

const samples: { write: RecipeWrite; createdAt: string; updatedAt: string }[] = [
  {
    createdAt: "2026-10-08T02:00:00.000Z",
    updatedAt: "2026-10-12T08:00:00.000Z",
    write: {
      title: "番茄炒蛋",
      douyinUrl: "https://v.douyin.com/iRk8aXc/",
      ingredientLines: ["番茄 2 个", "鸡蛋 3 个", "小葱 1 根", "白糖 1 小勺", "盐 适量"],
      stepLines: [
        "番茄顶部划十字，开水烫 30 秒后去皮，切滚刀块。",
        "鸡蛋加一小撮盐打散，热锅多放油，倒入蛋液，凝固就盛出。",
        "锅里留底油，下番茄中火翻炒出汁，加白糖。",
        "倒回鸡蛋，翻匀后加盐调味，撒葱花出锅。",
      ],
      imageKeys: [],
    },
  },
  {
    createdAt: "",
    updatedAt: "2026-10-12T07:00:00.000Z",
    write: {
      title: "麻婆豆腐",
      douyinUrl: "",
      ingredientLines: ["嫩豆腐 1 盒", "牛肉末 80 克", "郫县豆瓣 1 勺", "蒜苗 2 根", "花椒 少许"],
      stepLines: [
        "豆腐切小块，盐水焯一下沥干。",
        "牛肉末加一点料酒拌匀。",
        "热锅凉油，中小火把豆瓣炒出红油。",
        "下牛肉末炒散，加蒜姜末。",
        "倒半碗水，放豆腐，小火煮 3 分钟。",
        "勾薄芡，撒花椒面。",
        "最后下蒜苗段，翻两下出锅。",
      ],
      imageKeys: [],
    },
  },
  {
    createdAt: "",
    updatedAt: "2026-10-12T06:00:00.000Z",
    write: {
      title: "酸辣土豆丝",
      douyinUrl: "",
      ingredientLines: ["土豆 1 个", "干辣椒 4 个", "白醋 1 勺", "蒜 2 瓣", "盐 适量"],
      stepLines: [
        "土豆去皮切细丝，清水冲掉淀粉。",
        "干辣椒剪段，蒜切片。",
        "热油先炸辣椒和蒜，闻到香再下土豆丝。",
        "大火翻炒到断生，沿锅边淋白醋。",
        "加盐翻匀，立刻出锅，保持脆。",
      ],
      imageKeys: [],
    },
  },
  {
    createdAt: "",
    updatedAt: "2026-10-12T05:00:00.000Z",
    write: {
      title: "红烧肉",
      douyinUrl: "",
      ingredientLines: ["五花肉 500 克", "冰糖 15 克", "老抽 1 勺", "生抽 1 勺", "姜 4 片", "葱 1 段", "料酒 1 勺"],
      stepLines: [
        "五花肉切 3 厘米块，冷水下锅焯出血沫。",
        "锅中少油，小火把冰糖炒到枣红色。",
        "下肉块翻炒，裹上糖色。",
        "加料酒、生抽、老抽和姜葱。",
        "加热水没过肉，大火烧开。",
        "转小火盖盖炖 40 分钟。",
        "打开盖，中火收汁到发亮。",
        "尝一下咸淡，出锅前拣出姜葱。",
      ],
      imageKeys: [],
    },
  },
  {
    createdAt: "2026-10-08T03:00:00.000Z",
    updatedAt: "2026-10-12T04:00:00.000Z",
    write: {
      title: "宫保鸡丁",
      douyinUrl: "",
      ingredientLines: ["鸡腿肉 300 克", "花生 一把", "干辣椒 8 个", "黄瓜 半根", "葱 2 段"],
      stepLines: [
        "鸡腿肉切丁，加生抽和一点淀粉抓匀。",
        "花生小火炒香盛出。黄瓜切丁。",
        "干辣椒剪段。碗里调糖、醋、生抽、淀粉。",
        "热油滑熟鸡丁，变色就盛出。",
        "底油爆香辣椒和花椒。",
        "倒回鸡丁和黄瓜，淋碗汁。",
        "撒花生和葱段，翻匀出锅。",
      ],
      imageKeys: [],
    },
  },
  {
    createdAt: "2026-09-01T02:00:00.000Z",
    updatedAt: "2026-10-12T03:00:00.000Z",
    write: {
      title: "清蒸鲈鱼",
      douyinUrl: "",
      ingredientLines: ["鲈鱼 1 条", "姜 6 片", "蒸鱼豉油 2 勺", "小葱 2 根"],
      stepLines: [
        "鲈鱼收拾干净，两面划刀，抹一点盐。",
        "鱼身垫姜片，水开后上锅蒸 8 分钟。",
        "倒掉蒸出的腥水，拣出旧姜。",
        "铺上新姜丝和葱丝，淋蒸鱼豉油。",
        "烧一勺热油浇在葱丝上。",
      ],
      imageKeys: [],
    },
  },
];

export function seedIfEmpty(repo: Repo, now = new Date()) {
  if (repo.countRecipes() > 0) return;
  const recent = now.toISOString();
  const older = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  for (const sample of samples) {
    const parsed = validateWrite(sample.write);
    if (!parsed.ok) throw new Error(parsed.error);
    let createdAt = sample.createdAt;
    if (!createdAt) {
      createdAt = sample.write.title === "麻婆豆腐" || sample.write.title === "红烧肉" ? recent : older;
    }
    const saved = repo.create(parsed.value, createdAt, sample.updatedAt);
    if (!saved.ok) throw new Error(saved.error);
  }
}
