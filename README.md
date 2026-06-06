# 重生之我偷看了面试官的剧本 🎮

> 一场"有限回合制"的心理博弈战 — 知己知彼、有限出牌、征服人心

## 项目概述

这不是模拟面试，这是一场关于**信息判断**和**策略选择**的智力游戏。玩家将扮演拥有"预知未来"能力的求职者，在面试中通过策略性回答和心理博弈，赢得面试官好感并获取理想offer。

## ✨ 已实现功能

### 🎮 核心玩法
- **三关Boss战系统** - 每关独立Boss HP，HP机制实时计算
- **4种策略选择** - 保守/进取/创新/察言观色，影响伤害和防御
- **5种回答类型** - 坦诚型/包装型/反问型/数据驱动型/幽默化解型
- **5张能力卡牌收集** - 根据回答质量自动判定收集
- **多维度状态指标** - 演技值、精神疲劳度、专注力、信任值(独立)
- **11种结局** - 5种评级(S/A/B/C/D) + 6种隐藏结局

### 🎲 Roguelike系统
- **10人面试官池** - 随机抽取+固定Boss混合组合
- **6种随机事件** - 沉默时刻、技术突袭、意外盟友等
- **剧本偷看系统** - 偷看面试官内心，风险与收益并存
- **8种天赋** - 可装备，影响游戏策略和难度
- **每日挑战模式** - 每日固定场景+主题

### 🤖 AI集成
- **LLM智能评分** - OpenAI API兼容，自动分析回答质量
- **AI面试报告** - 游戏结束后生成详细复盘报告
- **AI头像生成** - 面试官头像自动生成
- **自由文本输入** - 支持自由回答+AI智能分析

### 💾 数据存储
- **Supabase集成** - 支持数据库持久化
- **本地内存模式** - 无需配置即可运行

## 项目结构

```
├── frontend/          # React 19 + Vite 8 + Tailwind CSS 4 前端
├── backend/           # Node.js + Fastify 后端 API
├── specs/             # 产品文档 (PRD.md)
└── .trae/skills/      # AI 辅助技能
```

## 快速开始

### 前置要求

- Node.js >= 18
- npm >= 9

### 启动后端

```bash
cd backend
cp .env.example .env   # 配置环境变量
npm install
npm run dev            # http://localhost:3001
```

### 启动前端

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

### 配置环境变量

编辑 `backend/.env`，填入以下信息：

| 变量 | 说明 | 获取方式 |
|------|------|---------|
| `SUPABASE_URL` | Supabase 项目 URL | Supabase Dashboard |
| `SUPABASE_SERVICE_KEY` | Supabase 服务角色密钥 | Supabase Dashboard |
| `OPENAI_API_KEY` | OpenAI API 密钥 | platform.openai.com |

> **提示**：不配置 OpenAI Key 也能运行游戏，只是面试官回应会使用内置默认文案。

### 数据库初始化

在 Supabase SQL Editor 中执行 `backend/src/db/schema.sql` 创建表结构。

## 技术栈

| 层 | 技术 | 部署 |
|----|------|------|
| 前端 | React 19 + Vite 8 + Tailwind CSS 4 | Vercel (免费) |
| 后端 | Node.js + Fastify | Render (免费) |
| 数据库 | Supabase (PostgreSQL) | Supabase (免费) |
| AI | OpenAI API (GPT-4o-mini) | 按量计费 |

## API端点

```
POST /api/game/start          # 开始游戏
POST /api/game/round          # 提交回答(选择题/自由文本)
POST /api/game/script         # 剧本偷看
POST /api/game/daily          # 每日挑战
GET  /api/game/report/:gameId # AI面试报告
GET  /api/game/result/:gameId # 游戏结算
```

## 开发路线

- [x] Phase 1: 核心机制 (Boss战、卡牌收集、策略选择)
- [x] Phase 2: 沉浸增强 (随机事件、剧本系统、天赋、AI报告)
- [ ] Phase 3: 内容丰富 (问题变体、移动端适配、统计回顾)
- [ ] Phase 4: 优化打磨 (音效、性能优化、部署上线)

## 文档

- [产品需求文档 (PRD)](specs/PRD.md) - 详细的产品设计文档
- [数据库Schema](backend/src/db/schema.sql) - Supabase表结构定义