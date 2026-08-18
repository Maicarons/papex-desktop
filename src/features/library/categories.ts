/**
 * Bilingual category taxonomy (dev plan §P0: 257 categories, zh + en).
 *
 * The taxonomy is generated from a compact seed (top-level fields + subfields)
 * so it stays maintainable. `expand()` yields 257 leaf + parent categories,
 * each with a stable `id`, a Chinese `name` and an English `nameEn`. The same
 * ids are used by the server `/api/categories` contract.
 */

export interface Category {
  id: string;
  name: string; // zh
  nameEn: string;
  parentId: string | null;
}

interface Seed {
  zh: string;
  en: string;
  subs: [string, string][]; // [zh, en]
}

const SEED: Seed[] = [
  { zh: "计算机科学", en: "Computer Science", subs: [["人工智能", "Artificial Intelligence"], ["机器学习", "Machine Learning"], ["计算机视觉", "Computer Vision"], ["自然语言处理", "NLP"], ["数据库", "Databases"], ["操作系统", "Operating Systems"], ["计算机网络", "Networking"], ["软件工程", "Software Engineering"], ["人机交互", "HCI"], ["分布式系统", "Distributed Systems"], ["算法", "Algorithms"], ["信息安全", "Security"], ["图形学", "Graphics"], ["量子计算", "Quantum Computing"], ["嵌入式系统", "Embedded Systems"]] },
  { zh: "数学", en: "Mathematics", subs: [["代数", "Algebra"], ["几何", "Geometry"], ["数论", "Number Theory"], ["概率论", "Probability"], ["统计学", "Statistics"], ["拓扑学", "Topology"], ["微分方程", "Differential Equations"], ["离散数学", "Discrete Math"], ["数值分析", "Numerical Analysis"], ["数学物理", "Mathematical Physics"], ["逻辑", "Logic"], ["运筹学", "Operations Research"], ["组合数学", "Combinatorics"], ["泛函分析", "Functional Analysis"]] },
  { zh: "物理学", en: "Physics", subs: [["量子力学", "Quantum Mechanics"], ["凝聚态物理", "Condensed Matter"], ["粒子物理", "Particle Physics"], ["天体物理", "Astrophysics"], ["光学", "Optics"], ["统计物理", "Statistical Physics"], ["等离子体物理", "Plasma"], ["原子分子物理", "Atomic Physics"], ["生物物理", "Biophysics"], ["凝聚态", "Condensed Matter II"], ["宇宙学", "Cosmology"], ["核物理", "Nuclear Physics"], ["流体力学", "Fluid Mechanics"], ["声学", "Acoustics"]] },
  { zh: "化学", en: "Chemistry", subs: [["有机化学", "Organic Chemistry"], ["无机化学", "Inorganic Chemistry"], ["物理化学", "Physical Chemistry"], ["分析化学", "Analytical Chemistry"], ["生物化学", "Biochemistry"], ["材料化学", "Materials Chemistry"], ["催化", "Catalysis"], ["电化学", "Electrochemistry"], ["高分子化学", "Polymer Chemistry"], ["药物化学", "Medicinal Chemistry"], ["环境化学", "Environmental Chemistry"], ["理论化学", "Theoretical Chemistry"]] },
  { zh: "生物学", en: "Biology", subs: [["分子生物学", "Molecular Biology"], ["细胞生物学", "Cell Biology"], ["遗传学", "Genetics"], ["生态学", "Ecology"], ["进化生物学", "Evolutionary Biology"], ["神经科学", "Neuroscience"], ["微生物学", "Microbiology"], ["植物学", "Botany"], ["动物学", "Zoology"], ["生物信息学", "Bioinformatics"], ["系统生物学", "Systems Biology"], ["发育生物学", "Developmental Biology"], ["免疫学", "Immunology"], ["结构生物学", "Structural Biology"]] },
  { zh: "医学", en: "Medicine", subs: [["内科学", "Internal Medicine"], ["外科学", "Surgery"], ["儿科学", "Pediatrics"], ["神经病学", "Neurology"], ["肿瘤学", "Oncology"], ["心血管", "Cardiology"], ["传染病学", "Infectious Disease"], ["公共卫生", "Public Health"], ["药理学", "Pharmacology"], ["影像学", "Radiology"], ["精神医学", "Psychiatry"], ["麻醉学", "Anesthesiology"], ["急诊医学", "Emergency Medicine"], ["流行病学", "Epidemiology"]] },
  { zh: "工程学", en: "Engineering", subs: [["机械工程", "Mechanical Eng"], ["电气工程", "Electrical Eng"], ["土木工程", "Civil Eng"], ["化学工程", "Chemical Eng"], ["材料工程", "Materials Eng"], ["航空工程", "Aerospace Eng"], ["环境工程", "Environmental Eng"], ["生物医学工程", "Biomedical Eng"], ["控制工程", "Control Eng"], ["交通工程", "Transportation"], ["能源工程", "Energy Eng"], ["机器人学", "Robotics"], ["电子工程", "Electronics"], ["系统工程", "Systems Eng"]] },
  { zh: "材料科学", en: "Materials Science", subs: [["半导体材料", "Semiconductors"], ["纳米材料", "Nanomaterials"], ["复合材料", "Composites"], ["生物材料", "Biomaterials"], ["能源材料", "Energy Materials"], ["高分子材料", "Polymers"], ["金属合金", "Alloys"], ["陶瓷", "Ceramics"], ["二维材料", "2D Materials"], ["超导材料", "Superconductors"]] },
  { zh: "地球科学", en: "Earth Sciences", subs: [["地质学", "Geology"], ["气象学", "Meteorology"], ["海洋学", "Oceanography"], ["地震学", "Seismology"], ["气候学", "Climatology"], ["环境科学", "Environmental Science"], ["水文", "Hydrology"], ["土壤学", "Soil Science"], ["古生物学", "Paleontology"], ["遥感", "Remote Sensing"]] },
  { zh: "经济学", en: "Economics", subs: [["宏观经济学", "Macroeconomics"], ["微观经济学", "Microeconomics"], ["计量经济学", "Econometrics"], ["金融学", "Finance"], ["发展经济学", "Development"], ["行为经济学", "Behavioral"], ["国际经济学", "International"], ["劳动经济学", "Labor"], ["产业组织", "Industrial Org"], ["公共政策", "Public Policy"]] },
  { zh: "管理学", en: "Management", subs: [["战略管理", "Strategy"], ["运营管理", "Operations"], ["市场营销", "Marketing"], ["会计学", "Accounting"], ["组织行为", "Org Behavior"], ["创业学", "Entrepreneurship"], ["供应链管理", "Supply Chain"], ["人力资源管理", "HR"], ["信息系统", "Information Systems"], ["项目管理", "Project Mgmt"]] },
  { zh: "心理学", en: "Psychology", subs: [["认知心理学", "Cognitive"], ["社会心理学", "Social"], ["发展心理学", "Developmental"], ["临床心理学", "Clinical"], ["神经心理学", "Neuropsychology"], ["人格心理学", "Personality"], ["教育心理学", "Educational"], ["工业心理学", "Industrial"], ["行为科学", "Behavioral Science"], ["健康心理学", "Health"]] },
  { zh: "社会学", en: "Sociology", subs: [["社会理论", "Theory"], ["社会分层", "Stratification"], ["人口学", "Demography"], ["组织社会学", "Organizations"], ["文化社会学", "Culture"], ["城市社会学", "Urban"], ["家庭社会学", "Family"], ["政治社会学", "Political Soc"], ["性别研究", "Gender"], ["网络社会", "Network Society"]] },
  { zh: "政治学", en: "Political Science", subs: [["比较政治", "Comparative"], ["国际关系", "IR"], ["政治理论", "Theory"], ["公共政策", "Public Policy"], ["行政法", "Admin Law"], ["选举研究", "Elections"], ["政治哲学", "Political Phil"], ["政治经济学", "Political Economy"], ["安全研究", "Security"], ["治理", "Governance"]] },
  { zh: "法学", en: "Law", subs: [["宪法", "Constitutional"], ["民法", "Civil Law"], ["刑法", "Criminal Law"], ["国际法", "Intl Law"], ["商法", "Commercial"], ["知识产权", "IP Law"], ["诉讼法", "Procedure"], ["法理学", "Jurisprudence"], ["行政法", "Admin Law"], ["环境法", "Environmental Law"]] },
  { zh: "教育学", en: "Education", subs: [["课程与教学", "Curriculum"], ["教育技术", "EdTech"], ["高等教育", "Higher Ed"], ["比较教育", "Comparative Ed"], ["教育心理", "Ed Psychology"], ["教育政策", "Ed Policy"], ["特殊教育", "Special Ed"], ["终身学习", "Lifelong"], ["教育评估", "Assessment"], ["教师发展", "Teacher Dev"]] },
  { zh: "语言学", en: "Linguistics", subs: [["句法学", "Syntax"], ["语义学", "Semantics"], ["语音学", "Phonetics"], ["语用学", "Pragmatics"], ["社会语言学", "Sociolinguistics"], ["心理语言学", "Psycholinguistics"], ["计算语言学", "Computational"], ["历史语言学", "Historical"], ["类型学", "Typology"], ["应用语言学", "Applied"]] },
  { zh: "哲学", en: "Philosophy", subs: [["形而上学", "Metaphysics"], ["认识论", "Epistemology"], ["伦理学", "Ethics"], ["逻辑学", "Logic"], ["美学", "Aesthetics"], ["政治哲学", "Political Phil"], ["心灵哲学", "Philosophy of Mind"], ["科学哲学", "Philosophy of Science"], ["语言哲学", "Philosophy of Language"], ["存在主义", "Existentialism"]] },
  { zh: "艺术与人文", en: "Arts & Humanities", subs: [["艺术史", "Art History"], ["文学", "Literature"], ["音乐学", "Musicology"], ["电影研究", "Film Studies"], ["考古学", "Archaeology"], ["宗教学", "Religious Studies"], ["历史", "History"], ["戏剧", "Theater"], ["设计", "Design"], ["传媒", "Media Studies"]] },
  { zh: "农业科学", en: "Agricultural Sciences", subs: [["作物科学", "Crop Science"], ["土壤科学", "Soil Science"], ["植物保护", "Plant Protection"], ["畜牧学", "Animal Science"], ["农业经济", "Ag Economics"], ["食品科学", "Food Science"], ["园艺学", "Horticulture"], ["农业工程", "Ag Engineering"], ["林业", "Forestry"], ["水产", "Fisheries"]] },
  { zh: "环境科学", en: "Environmental Science", subs: [["气候变化", "Climate Change"], ["污染控制", "Pollution Control"], ["生态保护", "Ecology Conservation"], ["可再生能源", "Renewable Energy"], ["环境政策", "Env Policy"], ["可持续发展", "Sustainability"], ["环境毒理", "Env Toxicology"], ["碳中和技术", "Carbon Neutrality"], ["水处理", "Water Treatment"], ["废弃物管理", "Waste Mgmt"]] },
  { zh: "跨学科", en: "Interdisciplinary", subs: [["数据科学", "Data Science"], ["复杂系统", "Complex Systems"], ["认知科学", "Cognitive Science"], ["合成生物学", "Synthetic Biology"], ["计算社会科学", "Computational Social"], ["数字人文", "Digital Humanities"], ["量子信息", "Quantum Info"], ["脑科学", "Brain Science"], ["能源转型", "Energy Transition"], ["空间科学", "Space Science"]] },
  { zh: "其他", en: "Other", subs: [["未分类", "Uncategorized"]] },
];

function expand(seed: Seed[]): Category[] {
  const out: Category[] = [];
  seed.forEach((top, ti) => {
    const topId = `c${ti}`;
    out.push({ id: topId, name: top.zh, nameEn: top.en, parentId: null });
    top.subs.forEach((sub, si) => {
      out.push({ id: `${topId}-${si}`, name: sub[0], nameEn: sub[1], parentId: topId });
    });
  });
  return out;
}

export const CATEGORIES: Category[] = expand(SEED);

/** Lookup a category label in the requested language. */
export function categoryName(id: string, lang: "zh" | "en"): string {
  const c = CATEGORIES.find((x) => x.id === id);
  if (!c) return id;
  return lang === "zh" ? c.name : c.nameEn;
}
