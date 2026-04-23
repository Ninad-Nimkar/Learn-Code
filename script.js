const explorerToggle = document.querySelector(".explorer-toggle");
const fileList = document.querySelector(".file-list");

const tabs = document.querySelectorAll(".tab");
const outputTab = tabs[0];
const aiTab = tabs[1];

const outputContent = document.querySelector(".output-content");
const aiContent = document.querySelector(".ai-content");

const outputPre = document.querySelector(".output-content pre");
const aiParagraph = document.querySelector(".ai-content p");

const editor = document.querySelector(".code-editor");
const lineNumbers = document.querySelector(".line-numbers");

const topbarButtons = Array.from(document.querySelectorAll(".topbar-actions button"));
const runButton = topbarButtons.find((btn) => btn.textContent.trim() === "Run Code");
const explainButton = topbarButtons.find((btn) => btn.textContent.trim() === "Explain Code");

function setActiveTab(tabName) {
  const isOutput = tabName === "output";

  outputTab.classList.toggle("active", isOutput);
  aiTab.classList.toggle("active", !isOutput);

  outputContent.hidden = !isOutput;
  aiContent.hidden = isOutput;
}

function updateLineNumbers() {
  const lines = editor.value.split("\n").length;
  let numbers = "";

  for (let i = 1; i <= lines; i += 1) {
    numbers += `${i}\n`;
  }

  lineNumbers.textContent = numbers.trimEnd() || "1";
}

function runFakeCode() {
  const code = editor.value.trim();
  const message = code
    ? "[Running...]\nProgram executed successfully.\nOutput: Hello from GhostScreen!"
    : "[Running...]\nNo code provided.";

  outputPre.textContent = message;
  setActiveTab("output");
}

function explainFakeCode() {
  const code = editor.value.trim();
  const explanation = code
    ? "This code runs line by line, stores values in variables, and executes instructions in order."
    : "Add some code in the editor, then click Explain Code to generate an explanation.";

  aiParagraph.textContent = explanation;
  setActiveTab("ai");
}

if (explorerToggle && fileList) {
  explorerToggle.addEventListener("click", () => {
    fileList.hidden = !fileList.hidden;
  });
}

if (outputTab && aiTab) {
  outputTab.addEventListener("click", () => setActiveTab("output"));
  aiTab.addEventListener("click", () => setActiveTab("ai"));
}

if (editor && lineNumbers) {
  editor.addEventListener("input", updateLineNumbers);
  editor.addEventListener("scroll", () => {
    lineNumbers.scrollTop = editor.scrollTop;
  });
  updateLineNumbers();
}

if (runButton) {
  runButton.addEventListener("click", runFakeCode);
}

if (explainButton) {
  explainButton.addEventListener("click", explainFakeCode);
}

setActiveTab("output");
