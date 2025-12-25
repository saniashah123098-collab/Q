/**
 * Rafay Multi-Group Name Locker Bot (STABLE VERSION)
 * Developer: Rafay
 * Optimized by ChatGPT
 * Auto Console Clear: Every 30 Minutes (FIXED)
 * Updated API: @dongdev/fca-unofficial
 */

// 🔄 CHANGED: Updated to @dongdev/fca-unofficial
const login = require("@dongdev/fca-unofficial");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 20490;

app.use(express.urlencoded({ extended: true }));

/**
 * tasks = {
 *   taskID: {
 *     api,
 *     lockedGroups: [{id,name}],
 *     intervals: [],
 *     logs: [],
 *     listenerStarted: false
 *   }
 * }
 */
let tasks = {};
let lastCreatedTaskID = null;

// GLOBAL ERROR HANDLER - کراش سے بچنے کے لیے
process.on('uncaughtException', (error) => {
  console.error('🛑 [GLOBAL] Uncaught Exception:', error.message);
  // Program continue rahega, crash nahi hoga
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🛑 [GLOBAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// AUTO CONSOLE CLEAR SETUP (SAFE VERSION)
let consoleClearInterval = null;

function setupConsoleClear() {
  // Pehle existing interval clear karein
  if (consoleClearInterval) {
    clearInterval(consoleClearInterval);
  }
  
  // SAFE console clear with try-catch
  consoleClearInterval = setInterval(() => {
    try {
      console.clear();
      const now = new Date();
      const timeString = now.toLocaleTimeString();
      const dateString = now.toLocaleDateString();
      
      console.log(`🧹 [${dateString} ${timeString}] Console auto-cleared`);
      console.log(`📊 Active Tasks: ${Object.keys(tasks).length}`);
      console.log(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      console.log(`⏰ Uptime: ${Math.round(process.uptime())} seconds`);
      console.log(`----------------------------------------`);
    } catch (error) {
      console.log('⚠️ Console clear failed, continuing...');
    }
  }, 30 * 60 * 1000); // 30 minutes
  
  console.log('✅ Auto console clear scheduler started');
}

/* ===================== HELPERS ===================== */
function generateTaskId() {
  return Math.random().toString(36).substring(2, 9);
}

function logTask(taskID, msg) {
  if (!tasks[taskID]) return;
  const time = new Date().toLocaleTimeString();
  tasks[taskID].logs.push(`[${time}] ${msg}`);

  // logs limit (memory safe)
  if (tasks[taskID].logs.length > 200) {
    tasks[taskID].logs.shift();
  }

  console.log(`Task ${taskID}: ${msg}`);
}

function safeSetTitle(api, title, threadID, taskID) {
  try {
    api.setTitle(title, threadID, err => {
      if (err) {
        logTask(taskID, `❌ Failed: ${threadID} - ${err.message}`);
      } else {
        logTask(taskID, `🔒 Locked: ${threadID}`);
      }
    });
  } catch (error) {
    logTask(taskID, `⚠️ safeSetTitle Error: ${error.message}`);
  }
}

/* ===================== POLLING (LOW LOAD) ===================== */
function startPolling(api, group, taskID) {
  const interval = setInterval(() => {
    try {
      api.getThreadInfo(group.id, (err, info) => {
        if (err) {
          logTask(taskID, `📡 Polling error for ${group.id}: ${err.message}`);
          return;
        }
        
        if (!info) {
          logTask(taskID, `⚠️ No info for ${group.id}`);
          return;
        }
        
        const currentName = info.name || info.threadName || "";
        if (currentName !== group.name) {
          safeSetTitle(api, group.name, group.id, taskID);
        }
      });
    } catch (error) {
      logTask(taskID, `💥 Polling crash: ${error.message}`);
    }
  }, 60000); // ⬅ 60 sec (LOW LOAD)
  
  return interval;
}

/* ===================== EVENT LISTENER (ONE TIME) ===================== */
function startEventListener(api, taskID) {
  if (tasks[taskID].listenerStarted) return;
  tasks[taskID].listenerStarted = true;

  api.listenMqtt((err, event) => {
    if (err || !event?.logMessageType) return;

    const threadID =
      event.threadID ||
      event.logMessageData?.threadID ||
      event.logMessageData?.threadId;

    const task = tasks[taskID];
    if (!task) return;

    const group = task.lockedGroups.find(g => g.id === threadID);
    if (!group) return;

    if (event.logMessageType.includes("thread")) {
      safeSetTitle(api, group.name, group.id, taskID);
    }
  });
}

/* ===================== WEB PANEL ===================== */
app.get("/", (req, res) => {
  let taskIdHtml = "";
  if (lastCreatedTaskID) {
    taskIdHtml = `
      <div class="alert">
        ✅ Task Created: <b>${lastCreatedTaskID}</b>
      </div>`;
    lastCreatedTaskID = null;
  }

  const tasksHtml = Object.entries(tasks)
    .map(([id, task]) => {
      const groups = task.lockedGroups
        .map(g => `<li>${g.id} → "${g.name}"</li>`)
        .join("");
      return `
        <div class="task">
          <b>🔒 Active Lock</b>
          <ul>${groups}</ul>
        </div>`;
    })
    .join("") || "<p>No active tasks</p>";

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rafay Locker</title>
<style>
body{
  background:radial-gradient(circle at top, #0b1020, #020617 70%);
  color:#f8fafc;
  font-family:'Segoe UI', Arial, sans-serif;
  padding:20px;
}

.card{
  background:linear-gradient(145deg, #0f172a, #020617);
  padding:22px;
  border-radius:20px;
  margin-bottom:18px;
  border:1px solid rgba(251,191,36,0.25);
  box-shadow:
    0 0 15px rgba(251,191,36,0.25),
    inset 0 0 20px rgba(255,255,255,0.03);
}

input,textarea{
  width:100%;
  margin-top:12px;
  padding:14px;
  border-radius:14px;
  border:1px solid rgba(251,191,36,0.25);
  background:#020617;
  color:#f8fafc;
  outline:none;
  box-shadow:inset 0 0 8px rgba(0,0,0,0.8);
}

button{
  width:100%;
  margin-top:14px;
  padding:14px;
  border-radius:16px;
  border:none;
  background:linear-gradient(135deg,#fbbf24,#f59e0b);
  color:#020617;
  font-weight:700;
  cursor:pointer;
  box-shadow:0 0 18px rgba(251,191,36,0.6);
  transition:all 0.3s ease;
}

button:hover{
  transform:translateY(-2px);
  box-shadow:0 0 28px rgba(251,191,36,0.9);
}

.alert{
  background:linear-gradient(135deg,#16a34a,#22c55e);
  padding:12px;
  border-radius:12px;
  font-weight:600;
  box-shadow:0 0 15px rgba(34,197,94,0.6);
}

.task{
  background:linear-gradient(145deg,#020617,#020617);
  padding:12px;
  border-radius:12px;
  border:1px solid rgba(251,191,36,0.15);
  box-shadow:inset 0 0 12px rgba(0,0,0,0.9);
}

.status-box {
  background: linear-gradient(135deg, #1e40af, #3b82f6);
  padding: 10px 15px;
  border-radius: 10px;
  margin-top: 15px;
  text-align: center;
  font-size: 13px;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}
</style>
</head>
<body>

<div class="card">
<h2>👑 Rafay Multi-Group Locker (STABLE)</h2>
<p style="color:#94a3b8; font-size:14px;">API: @dongdev/fca-unofficial | Auto Console Clear: Every 30 minutes | Crash Protection: Enabled</p>
${taskIdHtml}
<form method="POST" action="/add">
<textarea name="appstate" placeholder="AppState JSON" required></textarea>
<input name="uid" placeholder="Group ID" required>
<input name="name" placeholder="Lock Name" required>
<button>Add / Start</button>
</form>
</div>

<div class="card">
<h3>Active Tasks (${Object.keys(tasks).length})</h3>
${tasksHtml}
</div>

<div class="card">
<h3>Management</h3>
<form action="/stop">
<input name="taskID" placeholder="Task ID">
<button>Stop Task</button>
</form>
<form action="/console">
<input name="taskID" placeholder="Task ID">
<button>View Console</button>
</form>
<form action="/clear">
<input name="taskID" placeholder="Task ID">
<button>Clear Console</button>
</form>

<div class="status-box">
<div style="display:flex; justify-content:space-between; margin-bottom:5px;">
  <span>🛡️ Crash Protection:</span>
  <span style="color:#22c55e; font-weight:bold;">ACTIVE</span>
</div>
<div style="display:flex; justify-content:space-between;">
  <span>🧹 Auto Clear:</span>
  <span style="color:#fbbf24; font-weight:bold;">EVERY 30 MIN</span>
</div>
<div style="display:flex; justify-content:space-between; margin-top:5px;">
  <span>📦 API Version:</span>
  <span style="color:#3b82f6; font-weight:bold;">@dongdev/fca-unofficial</span>
</div>
</div>
</div>

</body>
</html>
`);
});

/* ===================== ADD TASK ===================== */
app.post("/add", (req, res) => {
  let appState;
  try {
    appState = JSON.parse(req.body.appstate);
  } catch {
    return res.send("Invalid AppState");
  }

  const taskID = generateTaskId();
  lastCreatedTaskID = taskID;

  tasks[taskID] = {
    api: null,
    lockedGroups: [{ id: req.body.uid.trim(), name: req.body.name.trim() }],
    intervals: [],
    logs: [],
    listenerStarted: false
  };

  // 🔄 CHANGED: Using @dongdev/fca-unofficial login
  login({ appState }, (err, api) => {
    if (err) {
      delete tasks[taskID];
      return res.send("Login Failed: " + err.message);
    }

    tasks[taskID].api = api;

    // Start polling with try-catch
    try {
      const interval = startPolling(api, tasks[taskID].lockedGroups[0], taskID);
      tasks[taskID].intervals.push(interval);
    } catch (error) {
      logTask(taskID, `⚠️ Polling start error: ${error.message}`);
    }

    startEventListener(api, taskID);
    
    logTask(taskID, "✅ Task Started Successfully with @dongdev/fca-unofficial");
    res.redirect("/");
  });
});

/* ===================== STOP TASK (IMPROVED) ===================== */
app.get("/stop", (req, res) => {
  const taskID = req.query.taskID;
  const task = tasks[taskID];
  
  if (!task) {
    return res.send(`
      <div style="background:#0f172a;color:#f8fafc;padding:20px;border-radius:10px">
        <h3 style="color:#ef4444">❌ Task not found: ${taskID}</h3>
        <a href="/" style="color:#fbbf24">Go Back</a>
      </div>
    `);
  }

  logTask(taskID, "🛑 Stopping Task...");
  
  // Clear all intervals safely
  task.intervals.forEach(i => {
    if (i && typeof i === 'object') {
      clearInterval(i);
    }
  });
  
  // Close API connection if exists
  if (task.api) {
    try {
      if (task.api.close) task.api.close();
    } catch (e) {}
  }
  
  // Clean up task
  task.intervals = [];
  task.lockedGroups = [];
  task.logs = [];
  task.listenerStarted = false;
  
  delete tasks[taskID];
  logTask(taskID, "✅ Task Stopped Successfully");
  
  res.redirect("/");
});

/* ===================== VIEW CONSOLE ===================== */
app.get("/console", (req, res) => {
  const task = tasks[req.query.taskID];
  if (!task) return res.send("Task not found");

  res.send(`
  <div style="background:#0f172a;color:#f8fafc;padding:20px;min-height:100vh">
    <h3 style="color:#fbbf24">📋 Console for Task: ${req.query.taskID}</h3>
    <div style="background:rgba(0,0,0,0.7);color:#0f0;padding:15px;border-radius:10px;margin-top:20px;font-family:monospace;max-height:500px;overflow-y:auto;">
      ${task.logs.length > 0 ? task.logs.join("<br>") : "No logs yet"}
    </div>
    <div style="margin-top:20px">
      <a href="/" style="color:#fbbf24;text-decoration:none">← Back to Dashboard</a>
      <a href="/clear?taskID=${req.query.taskID}" style="color:#ef4444;margin-left:20px">🗑️ Clear Logs</a>
    </div>
  </div>
  `);
});

/* ===================== CLEAR CONSOLE (SAFE) ===================== */
app.get("/clear", (req, res) => {
  const task = tasks[req.query.taskID];
  if (!task) return res.send("Task not found");

  const logsCount = task.logs.length;
  task.logs = [];
  
  logTask(req.query.taskID, `🗑️ Console cleared (${logsCount} logs removed)`);
  res.redirect(`/console?taskID=${req.query.taskID}`);
});

/* ===================== SERVER STATUS ===================== */
app.get("/status", (req, res) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const status = {
    server: {
      uptime: `${hours}h ${minutes}m ${seconds}s`,
      memory: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      tasks: Object.keys(tasks).length,
      consoleClear: "Active (30 min)",
      crashProtection: "Enabled",
      apiVersion: "@dongdev/fca-unofficial"
    },
    tasks: Object.keys(tasks).map(id => ({
      id: id.substring(0, 6) + '...',
      groups: tasks[id].lockedGroups.length,
      logs: tasks[id].logs.length
    }))
  };
  
  res.json(status);
});

/* ===================== PING ENDPOINT ===================== */
app.get("/ping", (req, res) => {
  res.send("OK - Server is running with @dongdev/fca-unofficial");
});

/* ===================== SERVER START ===================== */
app.listen(PORT, () => {
  console.log(`🚀 STABLE Server running on ${PORT}`);
  console.log(`📦 API: @dongdev/fca-unofficial`);
  console.log(`🛡️  Crash Protection: ENABLED`);
  console.log(`🧹 Auto Console Clear: EVERY 30 MINUTES`);
  console.log(`💾 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log(`----------------------------------------`);
  
  // Start console clear safely
  setupConsoleClear();
});

/* ===================== CLEANUP ON EXIT ===================== */
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  
  // Clear console interval
  if (consoleClearInterval) {
    clearInterval(consoleClearInterval);
  }
  
  // Clear all task intervals
  Object.keys(tasks).forEach(taskID => {
    const task = tasks[taskID];
    if (task && task.intervals) {
      task.intervals.forEach(i => clearInterval(i));
    }
  });
  
  console.log('✅ Cleanup completed. Exiting.');
  process.exit(0);
});