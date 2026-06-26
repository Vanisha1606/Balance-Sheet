// User prompt and input functions
import { Capacitor } from "@capacitor/core";
import { Dialog } from "@capacitor/dialog";
import {
  toLatinInput,
  filterWesternNumeric,
  sanitizeCellInput,
} from "../../../../utils/english-input";
import { showFormattingButtons } from "./utils.js";

const SocialCalc = new Proxy({}, {
  get: (target, prop) => {
    const sc = typeof window !== "undefined" && window.SocialCalc 
      ? window.SocialCalc 
      : (typeof global !== "undefined" && global.SocialCalc ? global.SocialCalc : null);
    if (sc) {
      const val = sc[prop];
      if (typeof val === "function") {
        return val.bind(sc);
      }
      return val;
    }
    return undefined;
  },
  set: (target, prop, value) => {
    const sc = typeof window !== "undefined" && window.SocialCalc 
      ? window.SocialCalc 
      : (typeof global !== "undefined" && global.SocialCalc ? global.SocialCalc : null);
    if (sc) {
      sc[prop] = value;
      return true;
    }
    return false;
  }
});

const CHECKMARK_HTML = '<div><img src="/checkmark.png" height="15" width="15"></img></div>';
const UNCHECKED_HTML = '<div>&nbsp;</div>';

function getConstraintKey(editor, coord) {
  const sheetname = editor?.workingvalues?.currentsheet;
  if (!sheetname) return null;
  return sheetname + "!" + (coord || editor.ecell.coord);
}

export function isToggleCheckboxCell(editor, coord) {
  if (!SocialCalc.EditableCells?.constraints || !editor) return false;
  const key = getConstraintKey(editor, coord);
  if (!key) return false;
  const constraint = SocialCalc.EditableCells.constraints[key];
  return !!(constraint && constraint[0] === "tc");
}

function getBalanceSheetLayout(sheetname) {
  const cells = SocialCalc.EditableCells?.cells;
  if (!cells || !sheetname) return null;
  let hasB = false;
  let hasE = false;
  const prefix = `${sheetname}!`;
  for (const key of Object.keys(cells)) {
    if (!key.startsWith(prefix)) continue;
    const col = key.slice(prefix.length).replace(/[0-9]/g, "");
    if (col === "B") hasB = true;
    if (col === "E") hasE = true;
  }
  if (hasE) return "tablet";
  if (hasB) return "mobile";
  return null;
}

function isBalanceSheetNumericCell(sheetname, cellRef) {
  const balanceSheets = new Set([
    "BalanceSheet",
    "sheet3",
    "sheet4",
    "sheet5",
    "sheet6",
  ]);
  if (!balanceSheets.has(sheetname)) return false;

  const layout = getBalanceSheetLayout(sheetname);
  const col = cellRef.replace(/[0-9]/g, "");

  if (layout === "mobile") {
    if (col === "B") return false;
    if (cellRef === "C4" || cellRef === "D4" || cellRef === "C5") return false;
    if (col === "C" || col === "D") return true;
    return false;
  }

  if (layout === "tablet") {
    if (col === "C" || col === "D") return false;
    if (cellRef === "E4" || cellRef === "F4" || cellRef === "E5" || cellRef === "F5") return false;
    if (col === "E" || col === "F") return true;
  }

  return false;
}

function isNumericCell(editor, coord) {
  if (!editor?.context?.sheetobj) return false;
  const sheetname = editor?.workingvalues?.currentsheet;
  const cellRef = coord || editor.ecell.coord;
  const col = cellRef.replace(/[0-9]/g, "");
  // Budget sheet (list1): Budget (D) and Actual (E) columns — numbers only
  if (sheetname === "list1" && (col === "D" || col === "E")) {
    return true;
  }
  if (isBalanceSheetNumericCell(sheetname, cellRef)) {
    return true;
  }
  return false;
}

function isValidBudgetNumber(value) {
  if (value === "" || value === "-" || value === ".") return true;
  return /^-?\d+(\.\d+)?$/.test(value) || /^-?\d*\.\d+$/.test(value);
}

/** Web overlay with lang=en-US so iOS shows English keyboard, not Hindi */
function showEnglishCellPrompt({ title, message, text, inputType, okfn, cleanup }) {
  if (typeof document === "undefined") return;

  window.__cellEditModalActive = true;

  const isNumeric = inputType === "number";
  const overlay = document.createElement("div");
  overlay.id = "vp-cell-edit-overlay";
  overlay.setAttribute("lang", "en-US");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99999",
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  });

  const titleEl = document.createElement("div");
  titleEl.textContent = title;
  Object.assign(titleEl.style, {
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "8px",
    color: "#111",
  });

  const messageEl = document.createElement("div");
  messageEl.textContent = message;
  Object.assign(messageEl.style, {
    fontSize: "14px",
    color: "#555",
    marginBottom: "12px",
  });

  const input = document.createElement("input");
  input.lang = "en-US";
  input.setAttribute("autocorrect", "off");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("enterkeyhint", "done");
  input.type = isNumeric ? "tel" : "text";
  input.inputMode = isNumeric ? "decimal" : "text";
  if (isNumeric) input.setAttribute("pattern", "[0-9]*");
  input.value = isNumeric ? filterWesternNumeric(text) : toLatinInput(text);
  Object.assign(input.style, {
    width: "100%",
    boxSizing: "border-box",
    fontSize: "16px",
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    marginBottom: "16px",
  });

  const sanitizeLive = () => {
    const next = isNumeric
      ? filterWesternNumeric(input.value)
      : toLatinInput(input.value);
    if (next !== input.value) {
      const pos = input.selectionStart;
      input.value = next;
      if (pos != null) {
        try {
          input.setSelectionRange(pos, pos);
        } catch (_) {
          /* ignore */
        }
      }
    }
  };

  input.addEventListener("input", sanitizeLive);
  input.addEventListener("compositionend", sanitizeLive);

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
  });

  const closeOverlay = (runCleanup) => {
    window.__cellEditModalActive = false;
    overlay.remove();
    if (runCleanup) cleanup();
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  Object.assign(cancelBtn.style, {
    padding: "8px 16px",
    fontSize: "16px",
    border: "none",
    background: "transparent",
    color: "#007aff",
  });
  cancelBtn.onclick = () => closeOverlay(true);

  const okBtn = document.createElement("button");
  okBtn.type = "button";
  okBtn.textContent = "OK";
  Object.assign(okBtn.style, {
    padding: "8px 16px",
    fontSize: "16px",
    border: "none",
    background: "transparent",
    color: "#007aff",
    fontWeight: "600",
  });

  okBtn.onclick = () => {
    const val = isNumeric
      ? filterWesternNumeric(input.value)
      : toLatinInput(input.value);
    if (isNumeric && val !== "" && !isValidBudgetNumber(val)) {
      void Dialog.alert({
        title: "Invalid Input",
        message: "Budget fields only accept numbers.",
      });
      return;
    }
    okfn(val);
    closeOverlay(true);
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      okBtn.click();
    }
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(okBtn);
  panel.appendChild(titleEl);
  panel.appendChild(messageEl);
  panel.appendChild(input);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    input.focus();
    const len = input.value.length;
    try {
      input.setSelectionRange(len, len);
    } catch (_) {
      /* ignore */
    }
  });
}

function stripHtmlForDisplay(text) {
  if (!text) return "";
  if (text.includes("checkmark.png") || text.includes("&nbsp;")) return "";
  return text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function isNowFormulaCell(cellobj, rawText) {
  const trimmed = (rawText || "").trim();
  if (/^=now\(\)$/i.test(trimmed)) return true;
  return !!(
    cellobj?.datatype === "f" &&
    typeof cellobj.formula === "string" &&
    /^now\(\)$/i.test(cellobj.formula.trim())
  );
}

function getCellEditText(editor, coord) {
  const sheetobj = editor.context.sheetobj;
  const cellobj = sheetobj.cells[coord];
  let text = SocialCalc.GetCellContents(sheetobj, coord);
  text = stripHtmlForDisplay(text);

  if (isNowFormulaCell(cellobj, text)) {
    const cellEl = SocialCalc.GetEditorCellElement(
      editor,
      editor.ecell.row,
      editor.ecell.col
    );
    const visible = stripHtmlForDisplay(cellEl?.textContent || "");
    if (visible) {
      text = visible;
    } else if (cellobj?.datatype === "t" && cellobj.datavalue) {
      text = String(cellobj.datavalue);
    } else if (SocialCalc.FormatValueForDisplay) {
      text = stripHtmlForDisplay(
        SocialCalc.FormatValueForDisplay(sheetobj, cellobj.datavalue, coord, "")
      );
    }
  }

  if (
    SocialCalc.Constants.SCNoQuoteInInputBox &&
    text.substring(0, 1) === "'"
  ) {
    text = text.substring(1);
  }

  return toLatinInput(text);
}

export function mustshowprompt(coord) {
  var control = SocialCalc.GetCurrentWorkBookControl();
  var editor = control.workbook.spreadsheet.editor;
  var cellname = getConstraintKey(editor, coord);
  var constraint = cellname ? SocialCalc.EditableCells.constraints[cellname] : null;
  if (constraint && constraint[0] === "tc") {
    return false;
  }
  if (constraint && constraint[0].slice(0, 6) === "prompt") {
    return true;
  }
  return true;
}

export function getinputtype(coord) {
  var control = SocialCalc.GetCurrentWorkBookControl();
  var editor = control.workbook.spreadsheet.editor;
  var cellname = getConstraintKey(editor, coord);
  var constraint = cellname ? SocialCalc.EditableCells.constraints[cellname] : null;
  if (constraint) {
    if (constraint[0].slice(0, 5) === "input") {
      var inptype = constraint[0].slice(5);
      if (inptype === "numeric") {
        return "number";
      }
    }
  }
  if (isNumericCell(editor, coord)) {
    return "number";
  }
  return null;
}

export function prompttype(coord) {
  var control = SocialCalc.GetCurrentWorkBookControl();
  var editor = control.workbook.spreadsheet.editor;
  var cellname = getConstraintKey(editor, coord);
  var constraint = cellname ? SocialCalc.EditableCells.constraints[cellname] : null;

  if (constraint) {
    if (constraint[0].slice(0, 6) === "prompt") {
      var inptype = constraint[0].slice(6);
      if (inptype === "numeric") {
        return "numberpad";
      }
    }
  }
  if (isNumericCell(editor, coord)) {
    return "numberpad";
  }
  return null;
}

export function showprompt(coord) {
  // Use the enhanced prompt with formatting buttons
  return enhancedShowPrompt(coord);
}

export function enhancedShowPrompt(coord, initialText) {
  if (
    (typeof window !== "undefined" && window.__cellEditModalActive) ||
    document.querySelector("ion-modal.show-modal")
  ) {
    return false;
  }
  var control = SocialCalc.GetCurrentWorkBookControl();
  var editor = control.workbook.spreadsheet.editor;
  var cellname = getConstraintKey(editor, coord);
  var constraint = cellname ? SocialCalc.EditableCells.constraints[cellname] : null;
  var highlights = editor.context.highlights;

  if (constraint && constraint[0] === "tc") {
    return false;
  }

  var wval = editor.workingvalues;
  if (wval.eccord) {
    wval.ecoord = null;
    return;
  }
  wval.ecoord = coord;
  if (!coord) coord = editor.ecell.coord;
  var text = getCellEditText(editor, coord);
  if (initialText != null && initialText !== "") {
    text = toLatinInput(initialText);
  }

  if (
    SocialCalc.Constants.SCNoQuoteInInputBox &&
    text.substring(0, 1) === "'"
  ) {
    text = text.substring(1);
  }

  var cell = SocialCalc.GetEditorCellElement(
    editor,
    editor.ecell.row,
    editor.ecell.col
  );

  const inputType = getinputtype(coord);

  var okfn = function (val) {
    if (val === null || val === undefined) return;

    var callbackfn = function () {
      let normalized = sanitizeCellInput(val, inputType === "number");
      if (inputType === "number" && normalized !== "" && !isValidBudgetNumber(normalized)) {
        return;
      }

      // Create command to set cell text/value
      var cmd = "";
      var cellRef = editor.ecell.coord;
      const isDateTextCell =
        constraint?.[0] === "prompttext" &&
        constraint?.[3] === "Date" &&
        (cellRef === "F5" || cellRef === "C5");

      if (isDateTextCell) {
        cmd =
          normalized === ""
            ? "set " + cellRef + " empty"
            : "set " + cellRef + " text t " + normalized;
      } else {
      // Determine if value is number or text
      var numVal = parseFloat(normalized);
      if (
        inputType === "number" &&
        normalized !== "" &&
        !isNaN(numVal) &&
        isFinite(numVal)
      ) {
        cmd = "set " + cellRef + " value n " + numVal;
      } else if (
        inputType === "number" &&
        normalized === ""
      ) {
        cmd = "set " + cellRef + " empty";
      } else if (
        inputType !== "number" &&
        !isNaN(numVal) &&
        isFinite(normalized) &&
        normalized.toString().trim() === numVal.toString()
      ) {
        cmd = "set " + cellRef + " value n " + numVal;
      } else {
        var strVal = normalized.toString();
        cmd = "set " + cellRef + " text t " + strVal;
      }
      }

      if (editor.context && editor.context.sheetobj) {
        if (control && control.ExecuteWorkBookControlCommand) {
          var commandObj = {
            cmdtype: "scmd",
            id: control.currentSheetButton ? control.currentSheetButton.id : "sheet1",
            cmdstr: cmd,
            saveundo: true
          };
          control.ExecuteWorkBookControlCommand(commandObj, false);
        } else {
          editor.EditorScheduleSheetCommands(cmd, true, false);
        }
      }
    };
    const safeCallbackfn = function () {
      try {
        callbackfn();
      } catch (e) {
        console.error("Error in cell edit callback:", e);
      }
    };
    safeCallbackfn();
  };

  // highlight the cell
  delete highlights[editor.ecell.coord];
  highlights[editor.ecell.coord] = "cursor";
  editor.UpdateCellCSS(cell, editor.ecell.row, editor.ecell.col);

  var celltext = "Enter Value";
  var title = "Input";
  if (constraint && constraint.length > 3) {
    celltext = constraint[3];
  }
  if (constraint && constraint.length > 4) {
    title = constraint[4];
  }

  const cleanup = function () {
    wval.ecoord = null;
    delete highlights[editor.ecell.coord];
    editor.UpdateCellCSS(cell, editor.ecell.row, editor.ecell.col);
  };

  // Native: English-only web input (lang=en-US) — iOS system dialog uses device Hindi keyboard
  if (Capacitor.isNativePlatform()) {
    showEnglishCellPrompt({
      title,
      message: celltext,
      text,
      inputType,
      okfn,
      cleanup,
    });
    return true;
  }

  // Browser dev fallback: React modal with formatting controls
  const cellEditEvent = new CustomEvent("socialcalc:cell-edit-request", {
    detail: {
      coord: coord,
      text: text,
      inputType: inputType,
      okfn: okfn,
      cleanup: cleanup,
    },
  });
  window.dispatchEvent(cellEditEvent);

  return true;
}

export { CHECKMARK_HTML, UNCHECKED_HTML };
