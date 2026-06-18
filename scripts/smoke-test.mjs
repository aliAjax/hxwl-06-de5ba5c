import { spawn, execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

const PREVIEW_PORT = 4173;
const PREVIEW_HOST = "0.0.0.0";

function log(message) {
  console.log(`[smoke-test] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkServerReady(url, timeout = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await sleep(1000);
  }
  return false;
}

async function stopServer(childProcess) {
  if (!childProcess || childProcess.exitCode !== null) return;
  log("正在停止预览服务器...");
  childProcess.kill("SIGTERM");
  await sleep(2000);
  if (childProcess.exitCode === null) {
    childProcess.kill("SIGKILL");
    await sleep(500);
  }
  log("预览服务器已停止");
}

async function main() {
  log("开始冒烟测试...");

  let exitCode = 0;
  let previewProcess = null;

  log("步骤 1/4: 构建生产版本...");
  try {
    execSync("npm run build", {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, CI: "true" },
    });
  } catch (error) {
    log("构建失败！");
    process.exitCode = 1;
    return;
  }

  log("步骤 2/4: 启动预览服务器...");
  previewProcess = spawn(
    "npx",
    ["vite", "preview", "--host", PREVIEW_HOST, "--port", String(PREVIEW_PORT)],
    {
      cwd: projectRoot,
      stdio: "pipe",
      env: { ...process.env, CI: "true" },
    }
  );

  previewProcess.stdout.on("data", (data) => {
    process.stdout.write(`[preview] ${data}`);
  });

  previewProcess.stderr.on("data", (data) => {
    process.stderr.write(`[preview:err] ${data}`);
  });

  try {
    log("步骤 3/4: 等待服务器启动...");
    const serverUrl = `http://localhost:${PREVIEW_PORT}`;
    const isReady = await checkServerReady(serverUrl);

    if (!isReady) {
      log("服务器启动超时！");
      exitCode = 1;
      return;
    }
    log("服务器已就绪");

    log("步骤 4/4: 执行冒烟检查...");

    const response = await fetch(serverUrl);
    if (!response.ok) {
      log(`首页访问失败: HTTP ${response.status}`);
      exitCode = 1;
      return;
    }
    log(`首页访问成功: HTTP ${response.status}`);

    const html = await response.text();
    if (!html.includes("<div id=\"root\"></div>")) {
      log("页面未包含 root 挂载点");
      exitCode = 1;
      return;
    }
    log("页面包含 root 挂载点");

    if (!html.includes("<script")) {
      log("页面未包含 JavaScript 脚本");
      exitCode = 1;
      return;
    }
    log("页面包含 JavaScript 脚本");

    const assetMatch = html.match(/<link[^>]*href="([^"]+\.css)"[^>]*>/);
    if (!assetMatch) {
      log("警告: 未找到 CSS 资源链接");
    } else {
      const cssUrl = new URL(assetMatch[1], serverUrl).href;
      const cssResponse = await fetch(cssUrl);
      if (!cssResponse.ok) {
        log(`CSS 资源加载失败: HTTP ${cssResponse.status}`);
        exitCode = 1;
        return;
      }
      log("CSS 资源加载成功");
    }

    log("");
    log("✅ 冒烟测试全部通过！");
  } catch (error) {
    log(`冒烟测试失败: ${error.message}`);
    exitCode = 1;
  } finally {
    await stopServer(previewProcess);
  }

  process.exitCode = exitCode;
}

main();
