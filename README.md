# CodeLens

CodeLens 是一个浏览器优先的 AI 代码学习工具。目标用户不需要会跑本地项目：打开网页，填写自己的 DeepSeek API Key，选择本地代码文件夹，就可以开始问局部代码和全局架构问题。

## 给使用者

1. 打开部署后的 GitHub Pages 网址。
2. 点右侧栏的设置按钮，填写 DeepSeek API Key。
3. 点左侧的文件夹按钮，选择要学习的代码目录。
4. 在编辑器里圈选一段代码后右键提问，或在右侧输入框问整个项目。

设置只保存在当前浏览器的 `localStorage`，不会写入仓库。由于 GitHub Pages 是纯静态网页，AI 请求会从浏览器直接发到 DeepSeek。如果浏览器提示跨域失败，可以在设置里把 `API Base URL` 改成你自己的 OpenAI-compatible 代理地址。

## 给维护者

```bash
npm install
npm run dev
```

常用检查：

```bash
npm run typecheck
npm run lint
npm run build
```

`npm run build` 会生成静态站点到 `out/`，可以部署到任意静态托管服务。

## GitHub Pages 部署

仓库已包含 `.github/workflows/deploy-pages.yml`。推送到 `main` 后，GitHub Actions 会：

1. 安装依赖。
2. 设置 `NEXT_PUBLIC_BASE_PATH=/<仓库名>`。
3. 执行 `npm run build`。
4. 上传 `out/` 并部署到 GitHub Pages。

第一次使用时需要在 GitHub 仓库的 `Settings -> Pages` 中把 Source 设为 `GitHub Actions`。

如果你使用自定义域名，不需要仓库子路径，可以把 workflow 里的 `NEXT_PUBLIC_BASE_PATH` 删除或设为空。

## 当前边界

- 推荐 Chromium 系浏览器使用文件夹选择能力；Safari/Firefox 对 File System Access API 支持较弱。
- GitHub Pages 模式没有服务端，API Key 必须在浏览器端使用。
- 本地 `.env.local` 不再是普通用户路径的一部分，保留给未来本地增强模式。
