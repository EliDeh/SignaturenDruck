const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const ipc = require('electron').ipcMain
const path = require('path')
const url = require('url')
const fs = require('fs')
const Store = require('electron-store')
const config = new Store({cwd: 'C:\\Export\\SignaturenDruck'})
const Shell = require('node-powershell')
require('electron-context-menu')({
  prepend: (params, BrowserWindow) => [{
    visible: false,
  }],
  labels: {
    cut: 'Ausschneiden',
    copy: 'Kopieren',
    paste: 'Einfügen'
  }
})

// requires lodash
const _ = require('lodash')

// default main config settings
const configNew = {
  'defaultPath': 'C://Export/download.dnl',
  'defaultFormat': 'thulb_gross',
  'modalTxt': 'Die ausgewählten Signaturen wurden gedruckt.',
  'sortByPPN': false,
  'newLineAfter': ':',
  'useSRU': false,
  'SRUaddress': 'http://sru.gbv.de/opac-de-27',
  'thulbMode': true,
  'devMode': false
}

// name of signature storage json
const sigJSON = 'signaturen.json'
// requires the loadDataFromSRU-module
const loadFromSRU = require('./js/loadDataFromSRU.js')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let winManual
let winConfig

let formats = []

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
ipc.on('print', function (event, data, dataMan) {
  loadFormats()
  let usedFormats = []
  _.forEach(data, function (key, value) {
    usedFormats.push(value)
  })
  usedFormats.forEach(element => {
    printData(element, data[element], dataMan)
  })
})

app.on('close', () => {
  mainWindow.close()
  mainWindow = null
  winManual.close()
  winManual = null
  winConfig.close()
  winConfig = null
  app.quit()
})

// closes the application
ipc.on('close', function (event) {
  mainWindow.close()
  mainWindow = null
  app.quit()
})

// listens on openManually, invokes the opening process
ipc.on('openManually', function (event, objMan) {
  createManualWindow(objMan)
})

// listens on closeManual, closes the winManual and invokes the removeManual process
ipc.on('closeManual', function (event) {
  winManual.close()
  winManual = null
  mainWindow.webContents.send('removeManual')
})

// listens on saveManual, closes the winManual and passes the data along
ipc.on('saveManual', function (event, data) {
  winManual.close()
  winManual = null
  mainWindow.webContents.send('manual', data)
})

// listens on loadFromSRU, invokes the loadAndAddFromSRU function with the provided barcode
ipc.on('loadFromSRU', function (event, barcode) {
  if (barcode !== '') {
    loadFromSRU(barcode).then(function (objSRU) {
      mainWindow.webContents.send('addSRUdata', objSRU)
    })
  }
})

ipc.on('newConfig', function (event) {
  mainWindow.reload()
})

// listens on openConfigWindow, invokes the createConfigWindow function
ipc.on('openConfigWindow', function (event) {
  createConfigWindow()
})

// listens on closeWinConfig, invokes the closeWinConfig function
ipc.on('closeWinConfig', function (event) {
  closeWinConfig()
})

function closeWinConfig () {
  winConfig.close()
  winConfig = null
}

function loadFormats () {
  let files = fs.readdirSync('C:\\Export\\SignaturenDruck\\Formate')
  for (let file of files) {
    let fileName = file.split('.json')[0]
    formats[fileName] = JSON.parse(fs.readFileSync('C:\\Export\\SignaturenDruck\\Formate\\' + file, 'utf8'))
  }
}

// creates the mainWindow
function createWindow () {
  checkDir('./tmp')
  checkDir('C:\\Export\\SignaturenDruck')
  checkDir('C:\\Export\\SignaturenDruck\\Formate')
  checkDir('C:\\Export\\SignaturenDruck\\FormateCSS')
  checkConfig()
  // Create the browser window.
  if (!config.store.devMode) {
    mainWindow = new BrowserWindow({width: 800, height: 520, backgroundColor: '#f0f0f0'})
  } else {
    mainWindow = new BrowserWindow({width: 800, height: 550, backgroundColor: '#f0f0f0'})
  }

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '/html/index.html'),
    protocol: 'file:',
    slashes: true
  }))
  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    mainWindow = null
    winManual = null
    winConfig = null
    deleteJSON()
  })
}

// deletes the signature storage json
function deleteJSON () {
  if (fs.existsSync(sigJSON)) {
    fs.unlink(sigJSON, function (err) {
      if (err) {
        throw err
      }
    })
  }
}

// checks if config file exists, else creates one
function checkConfig () {
  if (fs.existsSync('C:\\Export\\SignaturenDruck\\config.json')) {
    if (!config.has('defaultPath')) {
      createConfig()
    }
  } else {
    createConfig()
  }
  let defaultConfigs = ['thulb_gross', 'thulb_klein', 'thulb_klein_1']
  defaultConfigs.forEach(fileName => {
    checkAndCreate('C:\\Export\\SignaturenDruck\\Formate\\', fileName, '.json')
    checkAndCreate('C:\\Export\\SignaturenDruck\\FormateCSS\\', fileName, '.css')
  })
  function checkAndCreate (pathName, fileName, ending) {
    if (!fs.existsSync(pathName + fileName + ending)) {
      let file = fs.readFileSync(path.join(__dirname, 'defaultFiles/' + fileName + ending), 'utf8')
      fs.writeFileSync(pathName + fileName + ending, file, 'utf8')
    }
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

function printData (format, data, dataMan) {
  let winPrint = null
  winPrint = new BrowserWindow({width: 899, height: 900, show: false})
  winPrint.loadURL(url.format({
    pathname: path.join(__dirname, 'html/print.html'),
    protocol: 'file:',
    slashes: true
  }))
  winPrint.once('ready-to-show', () => {
    winPrint.webContents.send('toPrint', format, data, dataMan)
    winPrint.webContents.printToPDF({marginsType: 1, landscape: true, pageSize: { width: formats[format].paper.height, height: formats[format].paper.width }}, (error, data) => {
      if (error) throw error
      let fileName = formats[format].name + '_' + new Date().getTime() + '.pdf'
      fs.writeFile('./tmp/' + fileName, data, (error) => {
        if (error) throw error
        let ps = new Shell({
          executionPolicy: 'Bypass',
          noProfile: true
        })
        if (!config.store.devMode) {
          ps.addCommand('Start-Process "' + path.join(__dirname, '.\\tmp\\' + fileName) + '" -Verb PrintTo "' + formats[format].printer + '" -PassThru | %{sleep 4;$_} | kill')
          ps.invoke().then(output => {
            fs.unlinkSync(path.join(__dirname, '.\\tmp\\' + fileName))
            mainWindow.webContents.send('printMsg', true)
          }).catch(err => {
            electron.dialog.showErrorBox('Es ist ein Fehler aufgetreten.', err)
            mainWindow.webContents.send('printMsg', false)
            ps.dispose()
          })
        } else {
          ps.addCommand('Start-Process "' + path.join(__dirname, '.\\tmp\\' + fileName) + '"')
          ps.invoke().then(output => { mainWindow.webContents.send('printMsg', true); ps.dispose() }).catch(err => {
            electron.dialog.showErrorBox('Es ist ein Fehler aufgetreten.', err)
            mainWindow.webContents.send('printMsg', false)
            ps.dispose()
          })
        }
      })
    })
    if (config.store.devMode) {
      winPrint.show()
    }
    winPrint = null
  })
}

// creates the winManual
function createManualWindow (objMan) {
  winManual = new BrowserWindow({width: 650, height: 420, show: false})
  winManual.loadURL(url.format({
    pathname: path.join(__dirname, 'html/manual_rework.html'),
    protocol: 'file',
    slashes: true
  }))
  winManual.once('ready-to-show', () => {
    winManual.show()
    winManual.webContents.send('objMan', objMan)
  })
}

// creates the winConfig
function createConfigWindow () {
  winConfig = new BrowserWindow({width: 800, height: 950, show: false})
  winConfig.loadURL(url.format({
    pathname: path.join(__dirname, 'html/config.html'),
    protocol: 'file',
    slashes: true
  }))
  winConfig.once('ready-to-show', () => {
    winConfig.show()
  })
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
