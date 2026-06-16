# ChartCore 重构计划（Phase 5）

> 状态：**核心已落地（2026-06-16）**。`chartBaseConfig()` 已建，bar-chart/chart-fx/multi-line 已接入（快照逐字节不变）；pie 有意不接入；可选的 `chartBaseThemePair()` 未做。
> 目标：抽 `chart-fx / multi-line / bar-chart / pie-chart` 四个图表里**图表无关**的重复 config/预设到 `shared/chart-core.js`，根除「副本漂移」（改一个通用默认值要同步改 4 个文件）。
> 原则：**只去重、不改任何生效默认值**；数据模型与各图表本体渲染**不动**。

---

## 一、重复代码（抽取候选）

四个文件 `config` 默认值里，大块**近乎逐字相同**且与图表类型无关：

| 配置块 | chart-fx | multi-line | bar-chart | pie-chart | 备注 |
|---|:-:|:-:|:-:|:-:|---|
| 标题（18 键） | ✓ | ✓ | ✓ | ✓ | 逐字相同 |
| 入场动画 entrance（12 键） | ✓ | ✓ | ✓ | ✓ | 逐字相同 |
| 卡片漂浮核心（rotate/shadow/card/float） | ✓ | ✓ | ✓ | ◐ | pie 缺 border/glow |
| 动画（animDuration/Easing） | ✓ | ✓ | ✓ | ◐ | pie 值=2.5 others=3.5 |
| 纸张纹理（noiseGrain/vignette） | ✓ | ✓ | ✓ | ◐ | pie 多 textureEnabled |
| 卡面材质 glass*（7 键） | ✓ | ✓ | ✓ | ✗ | pie 无 |
| cardBorder/cardGlow（7 键） | ✓ | ✓ | ✓ | ✗ | pie 无 |
| 网格坐标 grid/axis | ✓ | ✓ | ✓ | ✗ | 饼图无坐标轴 |
| MODE_PRESETS 纸张/赛博 | ✓ | ✓ | ✓ | ✗ | pie 无双风格 |

除 config 外，这些**代码块**在 3 个笛卡尔图里也重复：`switchMode()` 应用预设、`renderTable/addRow/deleteRow` 数据 CRUD、WebGL 合成调用。
（标题面板 `buildChartTitlePanel`、入场面板 `buildEntryAnimationPanel` 此前已抽到 controls.js 的 SHARED_PANELS。）

**真正"四家通吃"的只有 标题 + 入场动画 + 卡片漂浮核心 + 动画 + 纸张 这 5 块（约 50–60 键）。**

## 二、有意的差异（❌ 重构绝不能抹平）

1. **数据模型四者根本不同**：
   - chart-fx：`{label, barValue, lineValue}`（折线+柱状混合）
   - bar-chart：`{label, value}`
   - pie-chart：`{label, value, color, scale}` + 行内上移/下移/删除
   - multi-line：矩阵 `{labels[], lineSeries[{name,color,values[]}]}` + 三表冻结列布局
2. **pie 没有纸张/赛博双模式**（无 MODE_PRESETS）——有意。
3. **pie 无坐标轴/网格/柱/线**；中心文字 + 引导线标签是它独有。
4. **图例语义不同**：chart-fx 双图例（barLegend/lineLegend）、multi-line 每系列自动图例、bar/pie 各异。
5. **chart-fx 有双 Y 轴**（yAxisMode2/yMin2/yMax2），multi-line/bar 单轴。
6. **默认值的"刻意差异"**：subTitleSize（chart-fx 36 / bar 46）、animDuration（pie 2.5 / 其余 3.5）、pointSpacing、valueSize/valueColor、subTitleX…… 是各图表单独调好的，抽 base 时必须能被覆盖、且**保留每一个现有生效默认值**。

## 三、抽取边界（低风险）

- ✅ **抽**：`chartBaseConfig()`（上面 5 块图表无关默认）+ `chartBaseThemePair()`（MODE_PRESETS 里图表无关的主题键：标题色/卡片边框光晕/cardBg/glowBlur）。各图表 `{...chartBaseConfig(), ...自己的覆盖}`，主题键同理 extend。
- ❌ **不抽**：数据模型、renderTable、坐标轴/饼图/柱/线渲染——各图表本体。

---

## 四、我认为要改什么（具体改动清单）

按"从最安全、收益最大"排序。每步独立可验证、可单独提交。**任何一步导致快照变化都说明动到了生效默认值，必须回退。**

### 第 0 步（前置）：控件默认值快照 ——✅ 已就位（2026-06-16 核实）
- 安全网**已存在**：`defaults.spec.js` 遍历所有 `effects/*.html`、缺快照时自动生成；`tests/snapshots/` 下 10 个效果快照齐全，4 图表分别 chart-fx=126 / multi-line=110 / bar-chart=104 / pie-chart=105 个控件，当前全绿。
- **作用**：这是整个重构的安全网——之后每步都跑快照，逐字节不变才算"只去重没改值"。
- 无需新增，直接进第 1 步。

### 第 1 步：建 `shared/chart-core.js`，导出 `chartBaseConfig()`
- 内容 = 标题 + 入场动画 + 卡片漂浮核心 + 动画 + 纸张 这 5 块的**默认对象工厂**（返回新对象，避免共享引用）。
- 取值以 chart-fx 当前默认为基准；凡各图表有差异的键（如 animDuration、subTitleSize、textureEnabled），**不放进 base**，留各图表自己写——base 只放四家完全一致的键。
- 此步**不改任何效果文件**，只新增模块 + 单元自测。

### 第 2 步：逐个图表接入 base（一次一个文件、跑快照）
- 把每个图表 `config` 里与 base 重复的键删掉，改成 `const config = { ...chartBaseConfig(), /* 本图表特有 + 覆盖 */ };`。
- **顺序**：bar-chart（最简）→ chart-fx → multi-line → pie-chart（部分共享，只接它真有的块）。
- 每接一个：跑该图表快照 + 纸张↔赛博往返，必须全绿不变，再提交。

### 第 3 步（可选、谨慎）：抽 `chartBaseThemePair()`
- 把 MODE_PRESETS 里图表无关的主题键（标题色/cardBg/cardBorder/cardGlow/glowBlur/subTitleGlow）抽成基础预设对，各图表 `definePresetPair` 时 extend 自己的 bar*/line* 键。
- 风险比第 2 步高（预设键对称性敏感，见 definePresetPair 校验）。pie 不涉及。
- 若收益不抵风险，**可不做**——第 2 步已拿到大部分去重价值。

### 不做
- 不碰数据模型、renderTable、各图表渲染函数。
- 不强行让 pie 用上 base 里它没有的块。
- 不"顺手"统一各图表的刻意默认值差异。

## 五、验证闸门（每步必过）
1. 4 图表控件默认值快照逐字节不变（已存在于 tests/snapshots/）。
2. 纸张↔赛博↔纸张往返无残留（已有 smoke）。
3. `npm test` 全绿。
4. 目测：4 图表预览与重构前像素一致（WebGL 合成，注意截 offscreen 而非 glCanvas）。
