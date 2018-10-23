// This file is required by the print.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

// requires the fs-module
const fs = require('fs')

// requires the lodash-module
const _ = require('lodash')

// requires the username-module
const username = require('username')

// required for ipc calls to the main process
const ipc = require('electron').ipcRenderer

// requires the electron-store module and initializes it
const Store = require('electron-store')
const config = new Store({cwd: 'C:\\Export\\SignaturenDruck'})

let formats = []

window.onload = function () {
  addStyleLinks()
  loadFormats()

  function addStyleLinks () {
    let files = fs.readdirSync('C:\\Export\\SignaturenDruck\\FormateCSS')
    for (let file of files) {
      let fileName = file.split('.css')[0]
      let cssLink = document.createElement('link')
      cssLink.rel = 'stylesheet'
      cssLink.type = 'text/css'
      cssLink.href = 'C:/Export/SignaturenDruck/FormateCSS/' + fileName + '.css'
      document.head.appendChild(cssLink)
    }
  }
}

ipc.on('toPrint', function (event, format, data, dataMan) {
  main(format, data, dataMan)
  ipc.send('printed', true)
})

function main (format, data, dataMan) {
  let file = ''
  if (fs.existsSync('signaturen.json')) {
    file = fs.readFileSync('signaturen.json', 'utf8')
  }
  addUsername()
  addDate()

  createPage(format, data, dataMan, file)
}

function createPage (format, data, dataMan, file) {
  addStyle(format)
  _.forEach(data, function (value) {
    for (let count = 0; count < value.count; count++) {
      let div = document.createElement('div')
      div.className = 'innerBox'
      div.id = value.id
      let linesData = getData(value.id, value, formats[format].lines)
      if (String(value.id).includes('m_')) {
        if (dataMan[value.id.split('m_')[1]].removeIndent) {
          div.className = 'innerBox noIndent'
        }
      }
      if (Number(formats[format].lines) === 1) {
        let p = document.createElement('p')
        p.className = 'line_1'
        p.innerHTML = linesData
        div.appendChild(p)
      } else {
        let i = 1
        linesData.forEach(line => {
          let p = document.createElement('p')
          p.className = 'line_' + i
          if (line === '') {
            p.appendChild(document.createElement('br'))
          } else {
            p.innerHTML = line
          }
          div.appendChild(p)
          i++
        })
      }
      document.getElementById('toPrint').appendChild(div)
    }
  })

  function getData (id, data, lines) {
    if (id.includes('m_')) {
      if (Number(lines) === 1) {
        return dataMan[id.split('m_')[1]].lineTxts.join(' ')
      } else {
        return dataMan[id.split('m_')[1]].lineTxts
      }
    } else {
      let shelfmarkData = _.find(JSON.parse(file), { 'id': Number(id) })
      if (shelfmarkData.txtLength <= 2 && config.get('thulbMode')) {
        if (data.isShort) {
          return shelfmarkData.txt
        } else {
          let tmp = []
          tmp[0] = shelfmarkData.txtOneLine
          return tmp
        }
      } else {
        if (Number(lines) === 1) {
          return shelfmarkData.txtOneLine
        } else {
          return shelfmarkData.txt
        }
      }
    }
  }

  function addStyle (fileName) {
    document.getElementById('toPrint').className = 'format_' + fileName
  }
}

function addUsername () {
  document.getElementById('currentUsername').innerHTML = username.sync()
}

function addDate () {
  let today = new Date()
  let dd = today.getDate()
  let mm = today.getMonth() + 1
  let yyyy = today.getFullYear()

  if (dd < 10) {
    dd = '0' + dd
  }

  if (mm < 10) {
    mm = '0' + mm
  }

  today = dd + '.' + mm + '.' + yyyy
  document.getElementById('currentDate').innerHTML = today
}

function loadFormats () {
  let files = fs.readdirSync('C:\\Export\\SignaturenDruck\\Formate')
  for (let file of files) {
    let fileName = file.split('.json')[0]
    formats[fileName] = JSON.parse(fs.readFileSync('C:\\Export\\SignaturenDruck\\Formate\\' + file, 'utf8'))
  }
}
