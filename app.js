const {
  app,
  BrowserWindow,
  BrowserView,
  session,
  Menu,
  MenuItem,
  ipcMain,
} = require("electron");
const http = require("http");
const path = require("path");
const fs = require("fs");
const download = require("download");
const { URL } = require("url");
const { exec } = require('child_process');

let mainWindow;
let userInterfaceWindows = [];
let tabsWindows = [];
let leftPanels_Windows_arr = [];

let tabCount = 0;
var currentTabId = 1;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    frame:false,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
    },
  });
  mainWindow.webContents.loadURL('http://localhost:8000/src/loadingPage.html')
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const mimeTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };

  const server = http
    .createServer((req, res) => {
      const filePath = path.join(app.getAppPath(), req.url);
      const fileExt = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[fileExt] || "application/octet-stream";

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end(`Error loading ${filePath}`);
        } else {
          res.writeHead(200, { "Content-Type": contentType });
          res.end(content);
        }
      });
    })
    .listen(8000);

  //user interface //user interface //user interface //user interface //user interface //user interface
  createUserWindow(
    "http://localhost:8000/src/titleBar.html",
    0,
    0,
    mainWindow.getSize()[0],
    100
  );
  createUserWindow(
    "http://localhost:8000/src/userPanel.html",
    0,
    0,
    50,
    mainWindow.getSize()[1]
  );
  //userInterfaceWindows[1].webContents.openDevTools({mode : 'detach'})

  function createUserWindow(url, x, y, width, height) {
    userInterfaceWindow = new BrowserView({
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false,
      },
    });

    userInterfaceWindow.setBounds({ x: x, y: y, width: width, height: height });
    userInterfaceWindow.setAutoResize({ width: true, height: true });

    userInterfaceWindow.webContents.loadURL(url);
    mainWindow.addBrowserView(userInterfaceWindow);
    userInterfaceWindows.push(userInterfaceWindow);
  }

  mainWindow.on("resize", () => {
    userInterfaceWindows[0].setBounds({
      x: 0,
      y: 0,
      width: Math.floor(mainWindow.getSize()[0]),
      height: 89,
    });
    userInterfaceWindows[1].setBounds({
      x: 0,
      y: 0,
      width: 50,
      height: Math.floor(mainWindow.getSize()[1]),
    });
  });
  //user interface //user interface //user interface //user interface //user interface //user interface
  mainWindow.maximize();

  //tabs//tabs//tabs//tabs//tabs//tabs//tabs//tabs//tabs//tabs//tabs//tabs
  function createTabWindow(url, x, y, width, height) {
    tabCount++;
    let tabWindow = new BrowserView({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false,
      },
    });

    tabWindow.setBounds({ x: x, y: y, width: width, height: height });
    tabWindow.setAutoResize({ width: true, height: true });

    tabWindow.webContents.loadURL(url);
    mainWindow.addBrowserView(tabWindow);

    windowStartLoad(tabWindow)
    windowEndLoad(tabWindow)

    tabWindow.webContents.on('did-create-window', (window, url) => {
      createTabWindow(
        url.url,
        50,
        89,
        mainWindow.getSize()[0] - 67,
        mainWindow.getSize()[1] - 105
      );
      currentTabId = tabCount;
      userInterfaceWindows[0].webContents.send("createtab", currentTabId);
  
      const tab = tabsWindows.find((item) => item.id === currentTabId);
      if (tab) {
        currentTabId = tab.id;
        tab.tabW.webContents.on("did-navigate", (event, url) => {
          userInterfaceWindows[0].webContents.send("url-change", url);
          GetUrlInfo(url);
        });
      }
      return window.destroy()
    });

    tabWindow.webContents.on("did-navigate", (event, currentUrl, tabId) => {
      tabId = currentTabId
      userInterfaceWindows[0].webContents.send("url-change", currentUrl , parseInt(tabId));

      tabWindow.webContents.on('page-title-updated', (event, title)=>{
        userInterfaceWindows[0].webContents.send('titleUpdate', title, tabId)
    })
    });

    let tab = {
      id: tabCount,
      tabW: tabWindow,
    };

    tabsWindows.push(tab);
  }

  createTabWindow(
    "http://localhost:8000/src/main.html",
    50,
    89,
    mainWindow.getSize()[0] - 67,
    mainWindow.getSize()[1] - 105
  );

  ipcMain.on("createTab", (event) => {
    createTabWindow(
      "https://www.google.com/",
      50,
      89,
      mainWindow.getSize()[0] - 67,
      mainWindow.getSize()[1] - 105
    );

    currentTabId = tabCount;
    userInterfaceWindows[0].webContents.send("createtab", currentTabId);
      
    const tab = tabsWindows.find((item) => item.id === currentTabId);
    if (tab) {
      currentTabId = tab.id;
      tab.tabW.webContents.on("did-navigate", (event, currentUrl) => {
        userInterfaceWindows[0].webContents.send("url-change", currentUrl);
        GetUrlInfo(currentUrl);
      });
    }
  });

  ipcMain.on("tabClicked", (event, tabId, currentUrl) => {
    tabsWindows.forEach((item) => {
      mainWindow.removeBrowserView(item.tabW);
    });

    const tab = tabsWindows.find((item) => item.id === tabId);
    if (tab) {
      mainWindow.addBrowserView(tab.tabW);
      currentTabId = tab.id;

      currentUrl = tab.tabW.webContents.getURL();
      userInterfaceWindows[0].webContents.send("url-change", currentUrl);
      GetUrlInfo(currentUrl);
    }
  });

  ipcMain.on("tabDelete", (event, tabId) => {
    const tab = tabsWindows.find((item) => item.id === tabId);

    if (tab) {
      tab.tabW.webContents.destroy();
      mainWindow.removeBrowserView(tab.tabW);
      tabsWindows.splice(
        tabsWindows.findIndex((item) => item.id === tabId),
        1
      );

      mainWindow.addBrowserView(tabsWindows[0].tabW);
      currentTabId = tabsWindows[0].id;
    }
  });

  ipcMain.on("tabUrlChange", (event, url) => {
    const tab = tabsWindows.find((item) => item.id === currentTabId);
    if (tab) {
      GetUrlInfo(url);
      tab.tabW.webContents.loadURL('https://www.google.com/search?q= '+url);
    }
  });

  function GetUrlInfo(url) {
    try {
      let Purl = new URL(url);
      userInterfaceWindows[0].webContents.send(
        "tabUrl-changeInfo",
        Purl
      );
    } catch (error) {}
  }

  function windowStartLoad(win) {
    win.webContents.on('did-start-loading', (event)=>{
      win.webContents.insertCSS('html { cursor: wait; }');
      userInterfaceWindows[1].webContents.send("startLoad", currentTabId);
    })}

  function windowEndLoad(win) {
    win.webContents.on('did-stop-loading', (event)=>{
      win.webContents.insertCSS('html { cursor: default; }');
      userInterfaceWindows[1].webContents.send("stopLoad", currentTabId);
  })
  }
  ipcMain.on('app-hide', (event) => {
    console.log('asf')
    mainWindow.minimize()
  })
  ipcMain.on('app-close', (event) => {
    mainWindow.destroy()
  })

  ipcMain.on('page-back', (event)=>{
    const tab = tabsWindows.find((item) => item.id === currentTabId);
    if (tab) {
      tab.tabW.webContents.goBack()
    }
  })

  ipcMain.on('page-forward', (event)=>{
    const tab = tabsWindows.find((item) => item.id === currentTabId);
    if (tab) {
      tab.tabW.webContents.goForward()
    }
  })

  ipcMain.on('page-refresh', (event)=>{
    const tab = tabsWindows.find((item) => item.id === currentTabId);
    if (tab) {
      tab.tabW.webContents.reload()
    }
  })

  ipcMain.on('createTabFromMain', (event, url)=>{
    createTabWindow(
      url,
      50,
      89,
      mainWindow.getSize()[0] - 67,
      mainWindow.getSize()[1] - 105
    );

    currentTabId = tabCount;
    userInterfaceWindows[0].webContents.send("createtab", currentTabId);
      
    const tab = tabsWindows.find((item) => item.id === currentTabId);
    if (tab) {
      currentTabId = tab.id;
      tab.tabW.webContents.on("did-navigate", (event, currentUrl) => {
        userInterfaceWindows[0].webContents.send("url-change", currentUrl);
        GetUrlInfo(currentUrl);
      });
    }
  })

  ipcMain.on('openAppFromMain', (event, link)=>{
    exec(link, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Command stderr: ${stderr}`);
        return;
      }
    });
  })


  function leftPanels_Windows(url, x, y, width, height) {
    leftPanel_Window = new BrowserView({
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false,
      },
    });

    leftPanel_Window.setBounds({ x: x, y: y, width: width, height: height });
    leftPanel_Window.setAutoResize({ width: true, height: true });

    leftPanel_Window.webContents.loadURL(url);
    mainWindow.addBrowserView(leftPanel_Window);
    leftPanels_Windows_arr.push(leftPanel_Window);
  }

    // ==== = = = = == TASKS  = = == = = == =
    leftPanels_Windows(
      "http://localhost:8000/src/userPanelLeft_windows/task.html",
      -450,
      100,
      400,
      620
  );    
        const winForTask = leftPanels_Windows_arr[0]
        const taskSrc = './data/userTasks/tasks.json'
        winForTask.webContents.on('did-finish-load', () => {
        const taskj = fs.readFileSync(taskSrc, 'utf-8');
        winForTask.webContents.send('data', taskj);
      });

      ipcMain.on('taks_add', (event, task_name, task_date, task_desc) => {
        const currentTasksJson = fs.readFileSync(taskSrc, 'utf-8')
        const currentTasks= JSON.parse(currentTasksJson);

        if(task_name.length === 0){
          return;
        }else{
        }
        
        const newTasks = {
          id:Date.now(),
          name : task_name,
          date: task_date,
          description: task_desc,
          curdate:  new Date().getDay() + new Date().getMonth()  + new Date().getYear(),
          done: false
        }

        currentTasks.push(newTasks)
        const updateTask = JSON.stringify(currentTasks)
        fs.writeFileSync(taskSrc, updateTask, 'utf-8')

        const taskj = fs.readFileSync(taskSrc, 'utf-8');
        event.reply('data', taskj);
      });

      ipcMain.on('taks_dell', (event, task_id) => {
        const currentTasksJson = fs.readFileSync(taskSrc, 'utf-8')
        const currentTasks = JSON.parse(currentTasksJson);
        const updatedTasks = currentTasks.filter(task => task.id !== parseInt(task_id));

        fs.writeFileSync(taskSrc, JSON.stringify(updatedTasks));

        const taskj = fs.readFileSync(taskSrc, 'utf-8');
        event.reply('data', taskj);
      });

      ipcMain.on('leftUserPanelTaskClose', (event) => {
        console.log('aasfassf')
        winForTask.setBounds({
          x: -450,
          y: 100,
          width: 400,
          height:620,
        });
      });
      ipcMain.on('openLeftPanelTaskWindow', (event) => {
        winForTask.setBounds({
          x: 50,
          y: 100,
          width: 400,
          height:620,
        });
      });
    // ==== = = = = == TASKS  = = == = = == = 


    // leftPanels_Windows_arr[0].webContents.openDevTools({mode:'detach'})
}
app.on("ready", () => {
  createMainWindow();
});