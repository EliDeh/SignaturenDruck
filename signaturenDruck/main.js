const { BrowserWindow, app, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const _ = require('lodash')
const Store = require('electron-store')
// requires the username-module
// const username = require('username')
// const defaultProgramPath = 'C:/Users/' + username.sync() + '/SignaturenDruck/'

const defaultProgramPath = 'C:\\SignaturenDruck'
// Use a default path
const config = new Store({ cwd: defaultProgramPath })

const Shell = require('node-powershell')

require('electron-context-menu')({
  prepend: (params, BrowserWindow) => [{
    visible: false
  }],
  labels: {
    cut: 'Ausschneiden',
    copy: 'Kopieren',
    paste: 'Einfügen'
  }
})

// default main config settings
const configNew = {
  defaultDownloadPath: 'C:/Export/download.dnl',
  sortByPPN: false,
  useK10plus: true,
  showMenu: false,
  filterByLoc: true,
  example: {
    shelfmark: 'PÄD:TG:1420:Dan::2017',
    location: 'MAG',
    regex: '^(.*):(.*):(.*):(.*):(.*):(.*)$',
    delimiter: ':'
  },
  modal: {
    showModal: true,
    modalTxt: 'Die ausgewählten Signaturen wurden gedruckt.'
  },
  SRU: {
    useSRU: false,
    printImmediately: false,
    SRUAddress: 'http://sru.k10plus.de/opac-de-27',
    QueryPart1: '?version=1.1&operation=searchRetrieve&query=pica.bar=',
    QueryPart1EPN: '?version=1.1&operation=searchRetrieve&query=pica.epn=',
    QueryPart2: '&maximumRecords=1&recordSchema=picaxml'
  },
  print: {
    printCoverLabel: true
  },
  mode: {
    defaultMode: 'defaultMode'
  },
  devMode: false
}

const template = [
  {
    label: 'Datei',
    submenu: [
      {
        label: 'Schließen',
        role: 'close'
      }
    ]
  },
  {
    label: 'Bearbeiten',
    submenu: [
      {
        label: 'Format',
        accelerator: 'Control+Shift+C',
        click () {
          createConfigWindow()
        }
      },
      {
        label: 'Modus',
        accelerator: 'Control+Shift+E',
        click () {
          createEditorWindow()
        }
      }
    ]
  }
]

const menu = Menu.buildFromTemplate(template)

// name of signature storage json
const sigJSONFile = 'signaturen.json'

const DataFromSRU = require('./js/classes/DataFromSRU.js')
let sruData = new DataFromSRU()

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow, manualSignaturesWindow, configWindow, editorWindow

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})

// starts the printing process
ipcMain.on('print', (event, dataAll, printImmediately = false) => {
  let i = 1
  let nrOfFormats = dataAll.length

  _.each(dataAll, (data) => {
    let last = false
    // console.warn(data.formatInformation)
    // console.warn(data.printInformation)
    if (nrOfFormats === i) {
      last = true
    }
    setTimeout(function () {
      printData(data.formatInformation, data.printInformation, printImmediately, last)
    }, (i * 1000))
    i++
  })
})

app.on('close', () => {
  mainWindow.close()
  mainWindow = null
  manualSignaturesWindow.close()
  manualSignaturesWindow = null
  configWindow.close()
  configWindow = null
  editorWindow.close()
  editorWindow = null
  app.quit()
})

// closes the application
ipcMain.on('close', function (event) {
  mainWindow.close()
  mainWindow = null
  app.quit()
})

// listens on openManualSignaturesWindow, invokes the opening process
ipcMain.on('openManualSignaturesWindow', function (event, data, edit = false) {
  createManualSignaturesWindow(data, edit)
})

// listens on closeManual, closes the manualSignaturesWindow and invokes the removeManual process
ipcMain.on('closeManualSignaturesWindow', function (event) {
  manualSignaturesWindow.close()
  manualSignaturesWindow = null
  mainWindow.webContents.send('removeManualSignatures')
})

// listens on saveManualSignatures, closes the manualSignaturesWindow and passes the data along
ipcMain.on('saveManualSignatures', function (event, data) {
  manualSignaturesWindow.close()
  manualSignaturesWindow = null
  mainWindow.webContents.send('addManualSignatures', data)
})

// listens on loadFromSRU, invokes the loadAndAddFromSRU function with the provided barcode
ipcMain.on('loadFromSRU', function (event, key, mode) {
  if (key !== '') {
    sruData.loadData(key, mode).then(function (data) {
      mainWindow.webContents.send('addSRUdata', data, key, mode)
    })
  }
})

ipcMain.on('newConfig', function (event) {
  mainWindow.reload()
})

// listens on openConfigWindow, invokes the createConfigWindow function
ipcMain.on('openConfigWindow', function (event) {
  createConfigWindow()
})

// listens on closeWinConfig, invokes the closeWinConfig function
ipcMain.on('closeConfigWindow', function (event) {
  closeConfigWindow()
})

// listens on createNewModeFormat, invokes the createEditorWindows function
ipcMain.on('createNewModeFormat', function (event, data) {
  createEditorWindow(data)
})

function closeConfigWindow () {
  configWindow.close()
  configWindow = null
}

// listens on openConfigWindow, invokes the createEditorWindow function
ipcMain.on('openEditorWindow', function (event) {
  createEditorWindow()
})

// listens on closeEditorWindow, invokes the closeEditorWindow function
ipcMain.on('closeEditorWindow', function (event) {
  closeEditorWindow()
})

function closeEditorWindow () {
  editorWindow.close()
  editorWindow = null
}

// creates the mainWindow
function createWindow () {
  /*
  Pass config STORE as global variable to all other js files
   */
  global.config = config
  global.defaultProgramPath = defaultProgramPath
  global.sigJSONFile = sigJSONFile

  // checkDir('./tmp')
  checkDir(defaultProgramPath)
  checkDir(defaultProgramPath + '\\Formate')
  checkDir(defaultProgramPath + '\\FormateCSS')
  checkDir(defaultProgramPath + '\\Modi')
  checkConfig()
  // Create the browser window.
  if (!config.store.devMode) {
    mainWindow = new BrowserWindow({ width: 850, height: 570, backgroundColor: '#f0f0f0', webPreferences: { nodeIntegration: true } })
  } else {
    mainWindow = new BrowserWindow({ width: 850, height: 600, backgroundColor: '#f0f0f0', webPreferences: { nodeIntegration: true } })
  }
  if (config.store.showMenu) {
    Menu.setApplicationMenu(menu)
  }
  // set the mainwindow title (name + version from package.json)
  mainWindow.setTitle('Signaturendruck v' + app.getVersion())
  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '/html/index.html'),
    protocol: 'file:',
    slashes: true
  }))
  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    mainWindow = null
    manualSignaturesWindow = null
    configWindow = null
    editorWindow = null
    deleteJSON()
  })
}

// deletes the signature storage json
function deleteJSON () {
  if (fs.existsSync(sigJSONFile)) {
    fs.unlink(sigJSONFile, function (err) {
      if (err) {
        throw err
      }
    })
  }
}

// checks if config file exists, else creates one
function checkConfig () {
  if (fs.existsSync(defaultProgramPath + '\\config.json')) {
    if (!config.has('defaultDownloadPath')) {
      fs.renameSync(defaultProgramPath + '\\config.json', defaultProgramPath + '\\config_invalid.json')
      dialog.showErrorBox('Die Konfigurationsdatei:\n    ' + defaultProgramPath + '\\config.json\nwar fehlerhaft und wurde in config_invalid.json umbenannt.\n\nDas Program hat eine valide Standardversion erstellt.', '')
      createConfig()
    }
  } else {
    createConfig()
  }
  if (config.get('mode.defaultMode') === 'thulbMode') {
    createModeFiles('thulbMode', ['thulb_gross', 'thulb_klein', 'thulb_klein_1'])
  } else if (config.get('mode.defaultMode') === 'defaultMode') {
    createModeFiles('defaultMode', ['default_klein', 'default_gross'])
  }
}

function createModeFiles (modeName, subModeNames) {
  checkAndCreate(defaultProgramPath + '\\Modi\\', modeName, '.json')
  subModeNames.forEach(fileName => {
    checkAndCreate(defaultProgramPath + '\\Formate\\', fileName, '.json')
    checkAndCreate(defaultProgramPath + '\\FormateCSS\\', fileName, '.css')
  })
}

function checkAndCreate (pathName, fileName, ending) {
  if (!fs.existsSync(pathName + fileName + ending)) {
    let file = fs.readFileSync(path.join(__dirname, 'defaultFiles/' + fileName + ending), 'utf8')
    fs.writeFileSync(pathName + fileName + ending, file, 'utf8')
  }
}

// creates directory (if not already there)
function checkDir (path) {
  try {
    fs.mkdirSync(path)
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}

// creates new config.json
function createConfig () {
  config.set(configNew)
}

function printData (formatInformation, printInformation, printImmediately, last = false) {
  let winPrint = null
  winPrint = new BrowserWindow({ width: 899, height: 900, show: false, webPreferences: { nodeIntegration: true } })
  winPrint.loadURL(url.format({
    pathname: path.join(__dirname, 'html/print.html'),
    protocol: 'file:',
    slashes: true
  }))
  winPrint.once('ready-to-show', () => {
    winPrint.webContents.send('toPrint', formatInformation, printInformation, printImmediately, last)
    if (config.store.devMode) {
      winPrint.show()
    }
  })
}

ipcMain.on('readyToPrint', function (event, formatInformation, printImmediately, last) {
  let winPrint = BrowserWindow.fromWebContents(event.sender)
  winPrint.webContents.printToPDF({ marginsType: 1, landscape: true, pageSize: { height: formatInformation.paper.width, width: formatInformation.paper.height } }, (error, data) => {
    if (error) throw error
    let fileName = formatInformation.name + new Date().getTime() + '.pdf'
    fs.writeFile(defaultProgramPath + '\\' + fileName, data, (error) => {
      if (error) throw error
      let ps = new Shell({
        executionPolicy: 'Bypass',
        noProfile: true
      })
      if (!config.store.devMode) {
        if (last) {
          ps.addCommand('Start-Process -file "' + defaultProgramPath + '\\' + fileName + '"-WindowStyle Minimized -Verb PrintTo "' + formatInformation.printer + '" -PassThru | %{start-sleep 11;$_} | kill')
        } else {
          ps.addCommand('Start-Process -file "' + defaultProgramPath + '\\' + fileName + '"-WindowStyle Minimized -Verb PrintTo "' + formatInformation.printer + '" -PassThru | %{start-sleep 11;$_} | kill')
        }
        ps.invoke().then(output => {
          ps.dispose()
          winPrint.close()
          winPrint = null
          if (!printImmediately) {
            mainWindow.webContents.send('printMsg', last)
          }
          setTimeout(function () {
            try {
              fs.unlinkSync(defaultProgramPath + '\\' + fileName)
            } catch (error) {
              if (error.code === 'EBUSY') {
                mainWindow.webContents.send('couldNotDelete', defaultProgramPath)
              } else {
                throw error
              }
              winPrint.close()
              winPrint = null
            }
          }, 10000)
        }).catch(err => {
          dialog.showErrorBox('Es ist ein Fehler aufgetreten.', err)
          ps.dispose()
        })
      } else {
        if (last) {
          ps.addCommand('Start-Process -file "' + defaultProgramPath + '\\' + fileName + '"-WindowStyle Minimized -PassThru | %{start-sleep 11;$_} | kill')
        } else {
          ps.addCommand('Start-Process -file "' + defaultProgramPath + '\\' + fileName + '"-WindowStyle Minimized -PassThru | %{start-sleep 11;$_} | kill')
        }
        ps.invoke().then(output => {
          ps.dispose()
          if (!printImmediately) {
            mainWindow.webContents.send('printMsg', last)
          }
        }).catch(err => {
          dialog.showErrorBox('Es ist ein Fehler aufgetreten.', err)
          ps.dispose()
        })
      }
    })
  })
})

// creates the manualSignaturesWindow
function createManualSignaturesWindow (objMan, edit) {
  manualSignaturesWindow = new BrowserWindow({ width: 650, height: 420, show: false, webPreferences: { nodeIntegration: true } })
  manualSignaturesWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'html/manual.html'),
    protocol: 'file',
    slashes: true
  }))
  manualSignaturesWindow.once('ready-to-show', () => {
    manualSignaturesWindow.show()
    manualSignaturesWindow.webContents.send('objMan', objMan, edit)
  })
}

// creates the configWindow
function createConfigWindow () {
  configWindow = new BrowserWindow({ width: 800, height: 950, show: false, webPreferences: { nodeIntegration: true } })
  configWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'html/config.html'),
    protocol: 'file',
    slashes: true
  }))
  configWindow.once('ready-to-show', () => {
    configWindow.show()
  })
}

// creates the editorConfig
function createEditorWindow (formatName = '', nrOfLines = '') {
  editorWindow = new BrowserWindow({ width: 800, height: 950, show: false, webPreferences: { nodeIntegration: true } })
  editorWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'html/editor.html'),
    protocol: 'file',
    slashes: true
  }))
  editorWindow.once('ready-to-show', () => {
    editorWindow.show()
    editorWindow.webContents.send('newModeFormat', formatName, nrOfLines)
  })
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
