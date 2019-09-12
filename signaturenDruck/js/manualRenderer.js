// required for ipc calls to the main process
const { ipcRenderer, remote } = require('electron')

const config = remote.getGlobal('config')

const f = require('./classes/Formats')
let formats = new f()

let object = {
  manual: []
}

// currentID
let id = 0
let max = 1

window.onload = function () {
  pushFormatsToSelect()
  createByFormat(getFormatSelected().lines)
  disableBtnPrevious()
}

ipcRenderer.on('objMan', function (event, objMan, edit) {
  if (objMan !== null) {
    if (objMan.length > 0) {
      object.manual = objMan
      id = objMan.length
      max = objMan.length + 1
      setCounters()
      enableBtnPrevious()
    }
  }
  if (edit) {
    deleteData()
  }
  setCounters()
})

function pushFormatsToSelect () {
  let select = document.getElementById('formatSelect')
  formats.selectOptions.forEach(format => {
    let option = document.createElement('option')
    option.value = format
    option.innerHTML = format
    select.appendChild(option)
  })
  select.onchange = function () { createByFormat(getFormatSelected().lines) }
}

function createByFormat (numberOfLines) {
  removeInputLines()
  removePreviewLines()
  createInputLines(numberOfLines)
  createPreviewLines(numberOfLines)
  applyFormatStyle()
  addEventListener(numberOfLines)

  function addEventListener (numberOfLines) {
    for (let i = 1; i <= numberOfLines; i++) {
      let input = document.getElementById('inputLine_' + i)
      let line = document.getElementById('line_' + i)
      input.addEventListener('keyup', function (event) {
        line.innerHTML = input.value
      })
    }
  }
  function applyFormatStyle () {
    let format = getFormatSelected()
    document.getElementById('previewBox').className = 'format_' + format.name
  }
  function createPreviewLines (numberOfLines) {
    let innerPreviewBox = document.getElementById('innerPreviewBox')
    let i = 1
    while (i <= numberOfLines) {
      let line = document.createElement('p')
      line.id = 'line_' + i
      line.className = 'line_' + i
      innerPreviewBox.appendChild(line)
      i++
    }
  }
  function createInputLines (numberOfLines) {
    let box = document.getElementById('editorBox')
    let i = 1
    while (i <= numberOfLines) {
      let input = document.createElement('input')
      input.id = 'inputLine_' + i
      input.className = 'input'
      input.placeholder = 'Zeile ' + i
      input.type = 'text'
      box.appendChild(input)
      if (i !== numberOfLines) {
        box.appendChild(document.createElement('br'))
      }
      i++
    }
  }
}

function removePreviewLines () {
  removeChildsOf('innerPreviewBox')
}

function removeInputLines () {
  removeChildsOf('editorBox')
}

function removeChildsOf (parent) {
  let myNode = document.getElementById(parent)
  while (myNode.firstChild) {
    myNode.removeChild(myNode.firstChild)
  }
}

function getFormatSelected () {
  return formats.formats[document.getElementById('formatSelect').value]
}

function setFormatSelected () {
  document.getElementById('formatSelect').value = object.manual[id].format
}

function disableBtnPrevious () {
  document.getElementById('btn_previous').disabled = true
}

function enableBtnPrevious () {
  document.getElementById('btn_previous').disabled = false
}

function setCounters () {
  document.getElementById('countCurrent').innerHTML = id + 1
  document.getElementById('countMax').innerHTML = max
}

function focusFirst () {
  document.getElementById('line_1').focus()
}

function loadData () {
  setFormatSelected()
  createByFormat(getFormatSelected().lines)
  let i = 1
  while (i <= object.manual[id].txtLength) {
    let txt = object.manual[id].modes[0].lines[i - 1]
    document.getElementById('inputLine_' + i).value = txt
    document.getElementById('line_' + i).innerHTML = txt
    i++
  }
  document.getElementById('chkbx_removeIndent').checked = !!object.manual[id].removeIndent
  toggleIndent()
}

function saveCurrent () {
  let lineTxts = []
  let i = 1
  let oneLineTxt = ''
  let removeIndent = false
  let format = getFormatSelected()
  if (document.getElementById('chkbx_removeIndent').checked) {
    removeIndent = true
  }
  while (i <= format.lines) {
    lineTxts.push(document.getElementById('inputLine_' + i).value)
    oneLineTxt += document.getElementById('inputLine_' + i).value + ' '
    i++
  }
  object.manual[id] = {
    'id': id,
    'format': format.name,
    'defaultSubMode': 0,
    'txtLength': parseInt(format.lines),
    'modes': [],
    'txtOneLine': oneLineTxt,
    'removeIndent': removeIndent
  }
  let data = {
    'format': '',
    'lines': ''
  }
  data.format = format.name
  data.lines = lineTxts
  object.manual[id].modes.push(data)
}

function next () {
  let i = 1
  let isEmpty = true
  while (i <= getFormatSelected().lines) {
    if (document.getElementById('inputLine_' + i).value !== '') {
      isEmpty = false
    }
    i++
  }
  if (!isEmpty) {
    saveCurrent()
    id++
    if (id === 1) {
      enableBtnPrevious()
    }
    if (object.manual[id] !== undefined) {
      loadData()
    } else {
      max++
    }
    setCounters()
  }
}

function previous () {
  saveCurrent()
  if (id === 1) {
    disableBtnPrevious()
  }
  id--
  loadData()
  setCounters()
}

function deleteData () {
  reset()
  changeOrder()

  function changeOrder () {
    let i = id + 1
    while (object.manual[i] !== undefined) {
      object.manual[i - 1] = object.manual[i]
      object.manual[i].id = i - 1
      i++
    }
    delete object.manual[i - 1]
    if (id > 0) {
      id--
      max--
    }
    setCounters()
    if (id === 0) {
      disableBtnPrevious()
    }
    if (object.manual[id] !== undefined) {
      loadData()
    } else {
      createByFormat(getFormatSelected().lines)
    }
  }
  function reset () {
    object.manual[id] = {}
  }
}

function deleteAndExit () {
  object.manual = null
  ipcRenderer.send('closeManualSignaturesWindow')
}

function saveAndExit () {
  saveCurrent()

  let isEmpty = true
  if (object.manual[object.manual.length - 1] !== undefined) {
    let i = 1
    while (i <= object.manual[object.manual.length - 1].txtLength) {
      if (object.manual[object.manual.length - 1].modes[0][i - 1] !== '') {
        isEmpty = false
      }
      i++
    }
  }
  if (isEmpty) {
    delete object.manual[object.manual.length - 1]
  }
  ipcRenderer.send('saveManualSignatures', object.manual)
}

function toggleIndent () {
  let chkbx = document.getElementById('chkbx_removeIndent')
  if (chkbx.checked) {
    document.getElementById('innerPreviewBox').className = 'innerBox noIndent'
  } else {
    document.getElementById('innerPreviewBox').className = 'innerBox'
  }
}

function fixLineBreak (eventKey) {
  let line = document.activeElement
  let curPos = line.selectionStart
  let part1 = line.value.substr(0, curPos)
  let part2 = line.value.substr(curPos)
  let curLineNr = line.id.split('_')[1]
  let nextLineNr = Number(curLineNr) + 1
  let prevLineNr = Number(curLineNr) - 1
  if (eventKey === 'Enter') {
    if (document.getElementById('inputLine_' + nextLineNr)) {
      line.value = part1
      document.getElementById('inputLine_' + nextLineNr).value = part2 + document.getElementById('inputLine_' + nextLineNr).value
    }
  } else {
    if (curLineNr > 1) {
      line.value = part2
      document.getElementById('inputLine_' + prevLineNr).value = document.getElementById('inputLine_' + prevLineNr).value + part1
    }
  }
}

function lineSplit (event) {
  if (event.altKey) {
    if (event.key === 'Backspace' || event.key === 'Enter') {
      fixLineBreak(event.key)
    }
  }
}

document.getElementById('btn_next').addEventListener('click', next)
document.getElementById('btn_previous').addEventListener('click', previous)
document.getElementById('btn_delete').addEventListener('click', deleteData)
document.getElementById('btn_deleteAndExit').addEventListener('click', deleteAndExit)
document.getElementById('btn_saveAndExit').addEventListener('click', saveAndExit)
document.getElementById('chkbx_removeIndent').addEventListener('change', toggleIndent)
document.addEventListener('keydown', lineSplit)
