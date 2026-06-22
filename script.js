const COLS = 10;
const ROWS = 20;

const PIECES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: "I",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "O",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "T",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: "S",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: "Z",
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "J",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "L",
  },
};

const PIECE_TYPES = Object.keys(PIECES);
const DROP_INTERVAL = 800;
const LINE_SCORES = [0, 100, 300, 500, 800];

const boardElement = document.getElementById("board");
const scoreElement = document.getElementById("score");
const gameStatusElement = document.getElementById("game-status");
const startButton = document.getElementById("start-btn");
const restartButton = document.getElementById("restart-btn");

let score = 0;
let isPlaying = false;
let isGameOver = false;
let isResolvingDrop = false;
let board = [];
let currentPiece = null;
let dropTimerId = null;

function createEmptyBoardData() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function initBoardDOM() {
  boardElement.innerHTML = "";

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.row = row;
      cell.dataset.col = col;
      boardElement.appendChild(cell);
    }
  }
}

function createPiece(type) {
  const pieceType = type ?? PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  const { shape, color } = PIECES[pieceType];

  return {
    type: pieceType,
    shape: shape.map((row) => [...row]),
    color,
    row: 0,
    col: Math.floor((COLS - shape[0].length) / 2),
  };
}

function rotateMatrix(matrix) {
  const rowCount = matrix.length;
  const colCount = matrix[0].length;
  const rotated = Array.from({ length: colCount }, () => Array(rowCount).fill(0));

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      rotated[col][rowCount - 1 - row] = matrix[row][col];
    }
  }

  return rotated;
}

function forEachOccupiedCell(piece, callback) {
  for (let row = 0; row < piece.shape.length; row++) {
    for (let col = 0; col < piece.shape[row].length; col++) {
      if (!piece.shape[row][col]) {
        continue;
      }

      callback(piece.row + row, piece.col + col);
    }
  }
}

function isWithinBoard(boardRow, boardCol) {
  return (
    boardRow >= 0 &&
    boardRow < ROWS &&
    boardCol >= 0 &&
    boardCol < COLS
  );
}

function drawPiece(boardData, piece) {
  const newBoard = boardData.map((row) => [...row]);

  forEachOccupiedCell(piece, (boardRow, boardCol) => {
    if (isWithinBoard(boardRow, boardCol)) {
      newBoard[boardRow][boardCol] = piece.color;
    }
  });

  return newBoard;
}

function renderBoard(boardData) {
  const cells = boardElement.querySelectorAll(".cell");

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = cells[row * COLS + col];
      const value = boardData[row][col];

      cell.className = value ? `cell piece-${value}` : "cell";
    }
  }
}

function showBoard() {
  const displayBoard = currentPiece ? drawPiece(board, currentPiece) : board;
  renderBoard(displayBoard);
}

function isRowFull(row) {
  return row.every((cell) => cell !== null);
}

function clearFullLines() {
  const remainingRows = board.filter((row) => !isRowFull(row));
  const linesCleared = ROWS - remainingRows.length;

  while (remainingRows.length < ROWS) {
    remainingRows.unshift(Array(COLS).fill(null));
  }

  board = remainingRows;
  return linesCleared;
}

function addLineScore(linesCleared) {
  if (linesCleared <= 0) {
    return;
  }

  const points = LINE_SCORES[linesCleared] ?? linesCleared * 100;
  score += points;
  updateScoreDisplay();
}

function canMove(piece, deltaCol, deltaRow, matrix) {
  let canPlace = true;

  forEachOccupiedCell(piece, (boardRow, boardCol) => {
    if (!canPlace) {
      return;
    }

    const nextRow = boardRow + deltaRow;
    const nextCol = boardCol + deltaCol;

    if (nextCol < 0 || nextCol >= COLS) {
      canPlace = false;
      return;
    }

    if (nextRow >= ROWS) {
      canPlace = false;
      return;
    }

    if (nextRow >= 0 && matrix[nextRow][nextCol] !== null) {
      canPlace = false;
    }
  });

  return canPlace;
}

function tryMove(deltaCol, deltaRow) {
  if (!isPlaying || !currentPiece) {
    return false;
  }

  if (!canMove(currentPiece, deltaCol, deltaRow, board)) {
    return false;
  }

  currentPiece.row += deltaRow;
  currentPiece.col += deltaCol;
  showBoard();
  return true;
}

function tryRotate() {
  if (!isPlaying || !currentPiece) {
    return false;
  }

  const rotatedShape = rotateMatrix(currentPiece.shape);
  const rotatedPiece = {
    ...currentPiece,
    shape: rotatedShape,
  };

  if (!canMove(rotatedPiece, 0, 0, board)) {
    return false;
  }

  currentPiece.shape = rotatedShape;
  showBoard();
  return true;
}

function hardDrop() {
  if (!isPlaying || !currentPiece) {
    return;
  }

  while (tryMove(0, 1)) {}

  dropStep();
}

function lockPiece() {
  if (!currentPiece) {
    return;
  }

  forEachOccupiedCell(currentPiece, (boardRow, boardCol) => {
    if (isWithinBoard(boardRow, boardCol)) {
      board[boardRow][boardCol] = currentPiece.color;
    }
  });
}

function resolveLockedPiece() {
  lockPiece();

  const linesCleared = clearFullLines();
  addLineScore(linesCleared);
  spawnNextPiece();
}

function spawnNextPiece() {
  currentPiece = createPiece();

  if (!canMove(currentPiece, 0, 0, board)) {
    endGame();
  }
}

function dropStep() {
  if (!isPlaying || !currentPiece || isResolvingDrop) {
    return;
  }

  if (tryMove(0, 1)) {
    return;
  }

  isResolvingDrop = true;

  try {
    resolveLockedPiece();

    if (isPlaying) {
      showBoard();
    }
  } finally {
    isResolvingDrop = false;
  }
}

function endGame() {
  if (isGameOver) {
    return;
  }

  isPlaying = false;
  isGameOver = true;
  currentPiece = null;
  stopDropTimer();
  updateGameOverDisplay();
  updateButtons();
  showBoard();
}

function startDropTimer() {
  stopDropTimer();
  dropTimerId = setInterval(dropStep, DROP_INTERVAL);
}

function stopDropTimer() {
  if (dropTimerId !== null) {
    clearInterval(dropTimerId);
    dropTimerId = null;
  }
}

function updateScoreDisplay() {
  scoreElement.textContent = score;
}

function updateGameOverDisplay() {
  if (!gameStatusElement) {
    return;
  }

  gameStatusElement.hidden = !isGameOver;
  gameStatusElement.textContent = isGameOver ? "게임 오버" : "";
}

function updateButtons() {
  startButton.disabled = isPlaying;
  restartButton.disabled = !isPlaying && !isGameOver;
}

function resetGameState() {
  stopDropTimer();
  isResolvingDrop = false;
  score = 0;
  board = createEmptyBoardData();
  currentPiece = createPiece();
  isPlaying = true;
  isGameOver = false;
  updateScoreDisplay();
  updateGameOverDisplay();
  updateButtons();
  showBoard();
  startDropTimer();
}

function startGame() {
  resetGameState();
}

function restartGame() {
  resetGameState();
}

function handleKeyDown(event) {
  if (!isPlaying || !currentPiece) {
    return;
  }

  switch (event.code) {
    case "ArrowLeft":
      event.preventDefault();
      tryMove(-1, 0);
      break;
    case "ArrowRight":
      event.preventDefault();
      tryMove(1, 0);
      break;
    case "ArrowDown":
      event.preventDefault();
      dropStep();
      break;
    case "ArrowUp":
      event.preventDefault();
      tryRotate();
      break;
    case "Space":
      event.preventDefault();
      hardDrop();
      break;
    default:
      break;
  }
}

let controlsInitialized = false;

function initControls() {
  if (controlsInitialized) {
    return;
  }

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", restartGame);
  document.addEventListener("keydown", handleKeyDown);
  controlsInitialized = true;
}

initBoardDOM();
initControls();
board = createEmptyBoardData();
currentPiece = createPiece();
showBoard();
updateScoreDisplay();
updateButtons();
